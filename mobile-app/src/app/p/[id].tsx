import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorMessage, type Comment } from '../../api';
import { useAuth } from '../../auth';
import { Avatar } from '../../components/Avatar';
import { timeAgo } from '../../components/PostCard';
import { OptionsSheet, ReportSheet, type Option } from '../../components/Sheet';
import { ErrorText } from '../../components/ui';
import { colors, radius, font } from '../../theme';

export default function Comments() {
  const { id, author, community } = useLocalSearchParams<{ id: string; author?: string; community?: string }>();
  const { user } = useAuth();
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<Option[] | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setList(await api.comments(id)); } catch (e) { setError(errorMessage(e)); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.addComment(id, text.trim());
      setText('');
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const optionsFor = (c: Comment): Option[] => {
    const mine = c.authorUsername === user?.username;
    const canDelete = mine || author === user?.username; // autor do post também pode apagar
    return [
      ...(canDelete ? [{ label: 'Apagar comentário', destructive: true, onPress: async () => {
        try { await api.deleteComment(c.id); setList((l) => l?.filter((x) => x.id !== c.id) ?? null); }
        catch (e) { setError(errorMessage(e)); }
      } }] : []),
      ...(!mine ? [{ label: 'Denunciar comentário', destructive: true, onPress: () => setReport(c.id) }] : []),
    ];
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: 'Comentários' }} />
      {!list ? <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          ListHeaderComponent={author ? (
            <Text style={s.context}>Post de @{author}{community ? ` em ${community}` : ''}</Text>
          ) : undefined}
          ListEmptyComponent={<Text style={s.empty}>Nenhum comentário ainda. Comece a conversa!</Text>}
          renderItem={({ item }) => {
            const opts = optionsFor(item);
            return (
              <View style={s.comment}>
                <Pressable onPress={() => router.push(`/u/${item.authorUsername}`)}>
                  <Avatar url={item.authorAvatar} name={item.authorUsername} size={34} />
                </Pressable>
                <View style={s.bubble}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={s.author} onPress={() => router.push(`/u/${item.authorUsername}`)}>@{item.authorUsername}</Text>
                    <Text style={s.time}> · {timeAgo(item.createdAt)}</Text>
                    {opts.length > 0 && (
                      <Pressable onPress={() => setMenu(opts)} hitSlop={10} style={{ marginLeft: 'auto' }} accessibilityLabel="Opções do comentário">
                        <Text style={s.more}>⋯</Text>
                      </Pressable>
                    )}
                  </View>
                  <Text style={s.text}>{item.content}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <ErrorText>{error}</ErrorText>
      <View style={s.composer}>
        <TextInput value={text} onChangeText={setText} maxLength={500} multiline placeholder="Escreva um comentário…"
          placeholderTextColor={colors.muted} style={s.input} />
        <Pressable onPress={send} disabled={sending || !text.trim()} accessibilityRole="button"
          style={[s.send, (sending || !text.trim()) && { opacity: 0.5 }]}>
          {sending ? <ActivityIndicator color={colors.white} /> : <Text style={s.sendText}>Enviar</Text>}
        </Pressable>
      </View>

      <OptionsSheet visible={!!menu} options={menu ?? []} onClose={() => setMenu(null)} />
      <ReportSheet target={report ? { type: 'comment', id: report } : null} onClose={() => setReport(null)} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  context: { color: colors.muted, marginBottom: 6 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bubble: { flex: 1, backgroundColor: colors.white, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.babyBlue },
  author: { fontWeight: '800', fontFamily: font.title, color: colors.violet },
  time: { color: colors.muted, fontSize: 12 },
  more: { color: colors.muted, fontWeight: '800', fontFamily: font.title, fontSize: 16 },
  text: { color: colors.ink, marginTop: 4, lineHeight: 20 },
  composer: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.babyBlue, alignItems: 'flex-end' },
  input: {
    flex: 1, maxHeight: 120, backgroundColor: colors.skyBg, borderRadius: 18, borderWidth: 1, borderColor: colors.babyBlue,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: colors.ink,
  },
  send: { backgroundColor: colors.violet, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10, minWidth: 76, alignItems: 'center' },
  sendText: { color: colors.white, fontWeight: '800', fontFamily: font.title },
});
