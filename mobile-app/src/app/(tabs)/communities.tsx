import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage, type Category, type Community } from '../../api';
import { useAuth } from '../../auth';
import { Card, ErrorText } from '../../components/ui';
import { colors, radius } from '../../theme';

const CATEGORIES: { key: Category | null; label: string }[] = [
  { key: null, label: 'Todas' },
  { key: 'anime', label: 'Anime' },
  { key: 'kpop', label: 'K-pop' },
  { key: 'series', label: 'Séries' },
  { key: 'games', label: 'Games' },
  { key: 'music', label: 'Música' },
  { key: 'sports', label: 'Esportes' },
  { key: 'teams', label: 'Times' },
  { key: 'players', label: 'Jogadores' },
];
const labelOf = (c: Category) => CATEGORIES.find((x) => x.key === c)?.label ?? c;

export default function Communities() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [items, setItems] = useState<Community[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [list, me] = await Promise.all([api.communities(category ?? undefined), api.profile(user.username)]);
      setItems(list);
      setMine(new Set(me.fandoms.map((f) => f.id)));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [category, user]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (c: Community) => {
    const member = mine.has(c.id);
    try {
      if (member) await api.leaveCommunity(c.id);
      else await api.joinCommunity(c.id);
      setMine((prev) => {
        const next = new Set(prev);
        member ? next.delete(c.id) : next.add(c.id);
        return next;
      });
      setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, members: x.members + (member ? -1 : 1) } : x)));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!user) return null;

  return (
    <View style={{ flex: 1 }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {CATEGORIES.map((c) => {
            const active = c.key === category;
            return (
              <Pressable key={c.label} onPress={() => setCategory(c.key)}
                accessibilityRole="button" accessibilityState={{ selected: active }}
                style={[s.chip, active && s.chipActive]}>
                <Text style={[s.chipText, active && { color: colors.white }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ErrorText>{error}</ErrorText>

      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.violet} />}
        ListEmptyComponent={!loading ? <Text style={s.empty}>Nenhuma comunidade nesta categoria ainda.</Text> : undefined}
        renderItem={({ item }) => {
          const member = mine.has(item.id);
          return (
            // Área do nome/descrição e botão Entrar são irmãos (no navegador, botão dentro de botão é inválido)
            <Card style={s.cardRow}>
              <Pressable style={{ flex: 1 }} accessibilityRole="link" accessibilityLabel={`Abrir ${item.name}`}
                onPress={() => router.push({ pathname: '/c/[id]', params: { id: item.id, name: item.name } })}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.meta}>{labelOf(item.category)} · {item.members} {item.members === 1 ? 'fã' : 'fãs'}</Text>
                {!!item.description && <Text style={s.desc}>{item.description}</Text>}
              </Pressable>
              <Pressable onPress={() => toggle(item)} accessibilityRole="button"
                style={[s.join, member && s.joined]}>
                <Text style={[s.joinText, member && { color: colors.violet }]}>{member ? 'Membro ✓' : 'Entrar'}</Text>
              </Pressable>
            </Card>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.babyBlue },
  chipActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontWeight: '700', color: colors.ink },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontSize: 17, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  desc: { marginTop: 8, color: colors.ink, lineHeight: 20 },
  join: { backgroundColor: colors.violet, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  joined: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.violet },
  joinText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
});
