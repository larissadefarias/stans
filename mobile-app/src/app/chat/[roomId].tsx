import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorMessage, type Message } from '../../api';
import { useAuth } from '../../auth';
import { ErrorText } from '../../components/ui';
import { useRealtime } from '../../realtime';
import { colors, radius, font } from '../../theme';

const hour = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

export default function Chat() {
  const { roomId, title } = useLocalSearchParams<{ roomId: string; title?: string }>();
  const { user } = useAuth();
  const { socket, setActiveRoom, refreshCounts } = useRealtime();
  // A lista é invertida: o índice 0 é a mensagem mais nova (fica embaixo)
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const noMore = useRef(false);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRead = useCallback((list: Message[]) => {
    const newest = list[0];
    if (newest) api.markRoomRead(roomId, newest.id).then(refreshCounts).catch(() => {});
  }, [roomId, refreshCounts]);

  // Histórico + marca esta sala como "aberta" (não conta como não lida)
  useEffect(() => {
    setActiveRoom(roomId);
    api.messages(roomId)
      .then((list) => { setMessages(list); noMore.current = list.length < 30; markRead(list); })
      .catch((e) => setError(errorMessage(e)));
    return () => setActiveRoom(null);
  }, [roomId, setActiveRoom, markRead]);

  // Tempo real: mensagens novas e "digitando…"
  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: Message) => {
      if (m.roomId !== roomId) return;
      setMessages((prev) => {
        if (!prev || prev.some((x) => x.id === m.id)) return prev;
        const next = [m, ...prev];
        markRead(next);
        return next;
      });
      setTyping(false);
    };
    const onTyping = (p: { roomId: string }) => {
      if (p.roomId !== roomId) return;
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3000);
    };
    socket.on('message:new', onMessage);
    socket.on('typing', onTyping);
    return () => { socket.off('message:new', onMessage); socket.off('typing', onTyping); };
  }, [socket, roomId, markRead]);

  const loadOlder = async () => {
    if (!messages?.length || noMore.current || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const older = await api.messages(roomId, messages[messages.length - 1].id);
      noMore.current = older.length < 30;
      setMessages((prev) => [...(prev ?? []), ...older]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingOlder(false);
    }
  };

  const onChangeText = (v: string) => {
    setText(v);
    // Avisa "digitando…" no máximo a cada 2 s
    if (socket && Date.now() - lastTypingSent.current > 2000) {
      lastTypingSent.current = Date.now();
      socket.emit('typing', { roomId });
    }
  };

  const send = () => {
    const content = text.trim();
    if (!content || !socket) return;
    setError(null);
    setText('');
    socket.emit('message:send', { roomId, content }, (r: { ok: boolean; error?: string }) => {
      if (!r?.ok) {
        setText(content);
        setError(r?.error === 'rate_limited' ? 'Calma! Você está enviando rápido demais.'
          : r?.error === 'offensive_content' ? 'Essa mensagem tem palavras que não são permitidas no Stans.'
          : r?.error === 'dm_requires_mutual_follow' ? 'Vocês precisam se seguir um ao outro para trocar mensagens.'
          : 'Não foi possível enviar. Tente de novo.');
      }
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{
        title: title ?? 'Chat',
        headerTitle: () => (
          <Pressable disabled={!title?.startsWith('@')} onPress={() => router.push(`/u/${title!.slice(1)}`)}>
            <Text style={s.headerTitle}>{title ?? 'Chat'}</Text>
            {typing && <Text style={s.typing}>digitando…</Text>}
          </Pressable>
        ),
      }} />

      {!messages ? (
        error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 12, gap: 4 }}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingOlder ? <ActivityIndicator color={colors.violet} /> : undefined}
          ListEmptyComponent={<Text style={s.empty}>Nenhuma mensagem ainda. Diga oi! 👋</Text>}
          renderItem={({ item, index }) => {
            const mine = item.senderUsername === user?.username;
            const older = messages[index + 1];
            const newDay = !older || new Date(older.createdAt).toDateString() !== new Date(item.createdAt).toDateString();
            const showName = !mine && (!older || older.senderUsername !== item.senderUsername || newDay);
            return (
              <View>
                {newDay && <Text style={s.day}>{day(item.createdAt)}</Text>}
                <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                  {showName && (
                    <Text style={s.sender} onPress={() => router.push(`/u/${item.senderUsername}`)}>@{item.senderUsername}</Text>
                  )}
                  <Text style={[s.text, mine && { color: colors.white }]}>{item.content}</Text>
                  <Text style={[s.time, mine && { color: 'rgba(255,255,255,0.75)' }]}>{hour(item.createdAt)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {messages && <ErrorText>{error}</ErrorText>}
      <View style={s.composer}>
        <TextInput value={text} onChangeText={onChangeText} maxLength={2000} multiline placeholder="Mensagem"
          placeholderTextColor={colors.muted} style={s.input} onSubmitEditing={send} blurOnSubmit={false} />
        <Pressable onPress={send} disabled={!text.trim() || !socket} accessibilityRole="button" accessibilityLabel="Enviar"
          style={[s.send, (!text.trim() || !socket) && { opacity: 0.5 }]}>
          <Text style={s.sendText}>➤</Text>
        </Pressable>
      </View>
      {!socket && <Text style={s.offline}>Conectando ao chat…</Text>}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  headerTitle: { fontWeight: '800', fontFamily: font.title, color: colors.ink, fontSize: 17 },
  typing: { color: colors.violet, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginVertical: 24, transform: [{ scaleY: -1 }] },
  day: { alignSelf: 'center', color: colors.muted, fontSize: 12, marginVertical: 10, textTransform: 'capitalize' },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, marginVertical: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.violet, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.babyBlue },
  sender: { color: colors.violet, fontWeight: '800', fontFamily: font.title, fontSize: 12, marginBottom: 2 },
  text: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  time: { color: colors.muted, fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  composer: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.babyBlue, alignItems: 'flex-end' },
  input: {
    flex: 1, maxHeight: 120, backgroundColor: colors.skyBg, borderRadius: 20, borderWidth: 1, borderColor: colors.babyBlue,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: colors.ink,
  },
  send: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.white, fontSize: 18, fontWeight: '800', fontFamily: font.title },
  offline: { textAlign: 'center', color: colors.muted, fontSize: 12, paddingBottom: 6, backgroundColor: colors.surface },
});
