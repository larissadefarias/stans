import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage, mediaUrl, type ModReport } from '../api';
import { timeAgo } from '../components/PostCard';
import { confirmAction } from '../components/ProfileView';
import { Button, Card, ErrorText } from '../components/ui';
import { colors, font, radius } from '../theme';

const TYPE_LABEL: Record<ModReport['targetType'], string> = { post: 'Post', comment: 'Comentário', wall: 'Recado', user: 'Perfil' };
const TABS = [['open', 'Abertas'], ['reviewed', 'Resolvidas'], ['dismissed', 'Ignoradas']] as const;

/** Fila de denúncias para moderadores: ignorar, apagar o conteúdo ou banir quem fez. */
export default function Moderation() {
  const [status, setStatus] = useState<(typeof TABS)[number][0]>('open');
  const [items, setItems] = useState<ModReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setItems(await api.modReports(status)); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const decide = (r: ModReport, action: 'dismiss' | 'remove' | 'ban') => {
    const run = async () => {
      setBusy(r.id);
      setError(null);
      try { await api.modDecide(r.id, action); await load(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
    };
    if (action === 'dismiss') return void run();
    const msg = action === 'ban'
      ? `Banir @${r.targetUser}? A conta perde o acesso na hora${r.targetType !== 'user' ? ' e este conteúdo é apagado' : ''}.`
      : 'Apagar este conteúdo? Não dá para desfazer.';
    confirmAction(msg, action === 'ban' ? 'Banir' : 'Apagar', run);
  };

  const unban = async (username: string) => {
    try { await api.unban(username); await load(); } catch (e) { setError(errorMessage(e)); }
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.violet} />}
      ListHeaderComponent={
        <>
          <View style={s.tabs}>
            {TABS.map(([key, label]) => (
              <Pressable key={key} onPress={() => setStatus(key)} accessibilityRole="tab" accessibilityState={{ selected: status === key }}
                style={[s.chip, status === key && s.chipActive]}>
                <Text style={[s.chipText, status === key && { color: colors.white }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <ErrorText>{error}</ErrorText>
        </>
      }
      ListEmptyComponent={!loading ? <Card><Text style={s.muted}>Nenhuma denúncia aqui. 🎉</Text></Card> : undefined}
      renderItem={({ item: r }) => {
        const gone = r.targetType !== 'user' && r.content == null; // conteúdo já apagado
        const image = mediaUrl(r.imageUrl);
        return (
          <Card>
            <View style={s.head}>
              <Text style={s.badge}>{TYPE_LABEL[r.targetType]}</Text>
              {r.timesReported > 1 && <Text style={[s.badge, s.hot]}>{r.timesReported} denúncias</Text>}
              <Text style={[s.muted, { marginLeft: 'auto' }]}>{timeAgo(r.createdAt)}</Text>
            </View>
            {r.targetUser && (
              <Pressable onPress={() => router.push(`/u/${r.targetUser}`)}>
                <Text style={s.user}>@{r.targetUser}{r.targetBanned ? '  ·  banida(o)' : ''}</Text>
              </Pressable>
            )}
            {gone ? <Text style={s.muted}>(conteúdo já apagado)</Text>
              : r.content != null && <Text style={s.content}>{r.content}</Text>}
            {image && !gone && <Image source={{ uri: image }} style={s.image} resizeMode="cover" />}
            <Text style={s.reason}>Motivo: {r.reason}</Text>
            <Text style={s.muted}>Denunciado por @{r.reporter}</Text>

            {r.status === 'open' && (
              <View style={s.actions}>
                <View style={{ flex: 1 }}><Button title="Ignorar" variant="ghost" onPress={() => decide(r, 'dismiss')} disabled={busy === r.id} /></View>
                {r.targetType !== 'user' && !gone && (
                  <View style={{ flex: 1 }}><Button title="Apagar" variant="ghost" onPress={() => decide(r, 'remove')} disabled={busy === r.id} /></View>
                )}
                {!!r.targetUser && !r.targetBanned && (
                  <View style={{ flex: 1 }}><Button title="Banir" onPress={() => decide(r, 'ban')} loading={busy === r.id} /></View>
                )}
              </View>
            )}
            {r.targetBanned && r.targetUser && (
              <View style={{ marginTop: 10 }}><Button title={`Desbanir @${r.targetUser}`} variant="ghost" onPress={() => unban(r.targetUser!)} /></View>
            )}
          </Card>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.babyBlue },
  chipActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  badge: { fontSize: 12, fontWeight: '800', color: colors.violet, backgroundColor: colors.skyBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  hot: { color: colors.danger },
  user: { fontWeight: '800', fontFamily: font.title, color: colors.ink, marginBottom: 4 },
  content: { fontSize: 15, color: colors.ink, lineHeight: 21, marginBottom: 6 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, marginBottom: 6, backgroundColor: colors.skyBg },
  reason: { color: colors.ink, fontWeight: '700', marginTop: 4 },
  muted: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
