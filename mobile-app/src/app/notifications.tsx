import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage, type Notification } from '../api';
import { Avatar } from '../components/Avatar';
import { timeAgo } from '../components/PostCard';
import { ErrorText } from '../components/ui';
import { useRealtime } from '../realtime';
import { colors, font } from '../theme';

// Avaliações são anônimas: a notificação não mostra quem avaliou
const describe = (n: Notification) => {
  switch (n.type) {
    case 'like': return { who: `@${n.actorUsername}`, what: `curtiu seu post${n.communityName ? ` em ${n.communityName}` : ''}` };
    case 'comment': return { who: `@${n.actorUsername}`, what: `comentou no seu post${n.communityName ? ` em ${n.communityName}` : ''}` };
    case 'wall': return { who: `@${n.actorUsername}`, what: 'deixou um recado no seu mural' };
    case 'follow': return { who: `@${n.actorUsername}`, what: 'começou a seguir você' };
    case 'rating': return { who: 'Alguém', what: 'avaliou seu perfil ⭐' };
  }
};

export default function Notifications() {
  const { clearNotifications } = useRealtime();
  const [list, setList] = useState<Notification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setList(await api.notifications());
      // Abriu a tela = viu tudo
      await api.markNotificationsRead();
      clearNotifications();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [clearNotifications]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const open = (n: Notification) => {
    if (n.type === 'like' || n.type === 'comment') {
      if (n.postId) router.push({ pathname: '/p/[id]', params: { id: n.postId, community: n.communityName ?? '' } });
    } else if (n.type === 'wall' || n.type === 'rating') {
      router.push('/me');
    } else {
      router.push(`/u/${n.actorUsername}`);
    }
  };

  if (!list) return error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} />;

  return (
    <FlatList
      data={list}
      keyExtractor={(n) => String(n.id)}
      contentContainerStyle={{ padding: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.violet} />}
      ListHeaderComponent={<ErrorText>{error}</ErrorText>}
      ListEmptyComponent={<Text style={s.empty}>Nada por aqui ainda. Quando alguém curtir, comentar, te seguir ou deixar um recado, aparece aqui.</Text>}
      renderItem={({ item }) => {
        const d = describe(item);
        const anonymous = item.type === 'rating';
        return (
          <Pressable onPress={() => open(item)} style={[s.item, !item.read && s.unread]} accessibilityRole="button">
            {anonymous
              ? <View style={s.anon}><Text style={{ fontSize: 18 }}>⭐</Text></View>
              : <Avatar url={item.actorAvatar} name={item.actorUsername} size={44} />}
            <View style={{ flex: 1 }}>
              <Text style={s.text}><Text style={s.who}>{d.who}</Text> {d.what}</Text>
              <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={s.dot} />}
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, marginBottom: 6 },
  unread: { backgroundColor: colors.white },
  anon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.babyBlue, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.ink, lineHeight: 20 },
  who: { fontWeight: '800', fontFamily: font.title },
  time: { color: colors.muted, fontSize: 12, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.violet },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
});
