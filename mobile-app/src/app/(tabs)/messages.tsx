import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage, type Room } from '../../api';
import { Avatar } from '../../components/Avatar';
import { timeAgo } from '../../components/PostCard';
import { Button, Card, ErrorText } from '../../components/ui';
import { useRealtime } from '../../realtime';
import { colors } from '../../theme';

const titleOf = (r: Room) => (r.kind === 'dm' ? `@${r.peer ?? 'fã'}` : r.communityName ?? 'Comunidade');

export default function Messages() {
  const { socket, refreshCounts } = useRealtime();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try { setRooms(await api.rooms()); } catch (e) { setError(errorMessage(e)); } finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); refreshCounts(); }, [load, refreshCounts]));

  // Mensagem nova em qualquer sala: atualiza a prévia e o contador
  useEffect(() => {
    if (!socket) return;
    const onMsg = () => { void load(); };
    socket.on('message:new', onMsg);
    return () => { socket.off('message:new', onMsg); };
  }, [socket, load]);

  return (
    <FlatList
      data={rooms}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.violet} />}
      ListHeaderComponent={<ErrorText>{error}</ErrorText>}
      ListEmptyComponent={!refreshing ? (
        <Card style={{ margin: 4 }}>
          <Text style={s.emptyTitle}>Nenhuma conversa ainda</Text>
          <Text style={s.emptyText}>
            Abra o perfil de um fã e toque em "Mensagem", ou entre no chat de uma comunidade pelo botão 💬 Chat.
          </Text>
          <Button title="Explorar comunidades" onPress={() => router.navigate('/communities')} />
        </Card>
      ) : undefined}
      renderItem={({ item }) => (
        <Pressable style={s.row} accessibilityRole="button"
          onPress={() => router.push({ pathname: '/chat/[roomId]', params: { roomId: item.id, title: titleOf(item) } })}>
          {item.kind === 'dm'
            ? <Avatar url={item.peerAvatar} name={item.peer ?? '?'} size={50} />
            : <View style={s.groupIcon}><Text style={{ fontSize: 22 }}>👥</Text></View>}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[s.title, item.unread > 0 && { color: colors.violet }]} numberOfLines={1}>{titleOf(item)}</Text>
              {item.lastAt && <Text style={s.time}>{timeAgo(item.lastAt)}</Text>}
            </View>
            <Text style={[s.preview, item.unread > 0 && { color: colors.ink, fontWeight: '600' }]} numberOfLines={1}>
              {item.lastMessage ?? (item.kind === 'dm' ? 'Diga oi! 👋' : 'Chat da comunidade')}
            </Text>
          </View>
          {item.unread > 0 && <View style={s.unread}><Text style={s.unreadText}>{item.unread}</Text></View>}
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.white, marginBottom: 8 },
  groupIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.babyBlue, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontWeight: '800', color: colors.ink, fontSize: 15 },
  time: { color: colors.muted, fontSize: 12, marginLeft: 8 },
  preview: { color: colors.muted, marginTop: 2 },
  unread: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  emptyText: { color: colors.muted, marginBottom: 14, lineHeight: 20 },
});
