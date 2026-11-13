import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorMessage, type Category, type Community, type UserSummary } from '../../api';
import { useAuth } from '../../auth';
import { CATEGORIES as ALL, categoryLabel as labelOf } from '../../categories';
import { Card, ErrorText } from '../../components/ui';
import { UserRow } from '../../components/UserRow';
import { colors, radius, font } from '../../theme';

const CATEGORIES: { key: Category | null; label: string }[] = [{ key: null, label: 'Todas' }, ...ALL];

export default function Communities() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [items, setItems] = useState<Community[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<{ users: UserSummary[]; communities: Community[] } | null>(null);
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Comunidades',
      headerRight: () => (
        <Pressable onPress={() => router.push('/new-community')} hitSlop={10} style={{ marginRight: 16 }} accessibilityRole="button">
          <Text style={{ color: colors.violet, fontWeight: '800', fontFamily: font.title }}>+ Criar</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  // Busca enquanto digita (espera 300 ms sem digitar para não chamar a API a cada letra)
  useEffect(() => {
    const t = term.trim();
    if (!t) { setResults(null); return; }
    const timer = setTimeout(() => {
      api.search(t).then(setResults).catch((e) => setError(errorMessage(e)));
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

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

  // Recarrega ao voltar (ex.: depois de criar uma comunidade ou entrar numa)
  useFocusEffect(useCallback(() => { void load(); }, [load]));

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
      <View style={s.searchBox}>
        <Image source={require('../../../assets/search.png')} style={s.searchIcon} />
        <TextInput value={term} onChangeText={setTerm} placeholder="Buscar fãs e comunidades" placeholderTextColor={colors.muted}
          style={s.searchInput} autoCapitalize="none" autoCorrect={false} returnKeyType="search" accessibilityLabel="Buscar" />
        {!!term && (
          <Pressable onPress={() => setTerm('')} hitSlop={10} accessibilityLabel="Limpar busca">
            <Text style={{ color: colors.muted, fontWeight: '800', fontFamily: font.title }}>✕</Text>
          </Pressable>
        )}
      </View>

      {results ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Card>
            <Text style={s.section}>Fãs</Text>
            {results.users.length === 0 ? <Text style={s.emptySmall}>Nenhum fã encontrado.</Text>
              : results.users.map((u) => <UserRow key={u.username} user={u} />)}
          </Card>
          <Card>
            <Text style={s.section}>Comunidades</Text>
            {results.communities.length === 0 ? <Text style={s.emptySmall}>Nenhuma comunidade encontrada.</Text>
              : results.communities.map((c) => (
                <Pressable key={c.id} style={{ paddingVertical: 8 }}
                  onPress={() => router.push({ pathname: '/c/[id]', params: { id: c.id, name: c.name } })}>
                  <Text style={s.name}>{c.name}</Text>
                  <Text style={s.meta}>{labelOf(c.category)} · {c.members} {c.members === 1 ? 'fã' : 'fãs'}</Text>
                </Pressable>
              ))}
          </Card>
        </ScrollView>
      ) : (<>
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
      </>)}
    </View>
  );
}

const s = StyleSheet.create({
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14,
    backgroundColor: colors.white, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.babyBlue,
  },
  searchIcon: { width: 18, height: 18, tintColor: colors.muted },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.ink },
  section: { fontSize: 16, fontWeight: '800', fontFamily: font.title, color: colors.ink, marginBottom: 4 },
  emptySmall: { color: colors.muted, paddingVertical: 6 },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.babyBlue },
  chipActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontWeight: '700', color: colors.ink },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontSize: 17, fontWeight: '800', fontFamily: font.title, color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  desc: { marginTop: 8, color: colors.ink, lineHeight: 20 },
  join: { backgroundColor: colors.violet, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  joined: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.violet },
  joinText: { color: colors.white, fontWeight: '800', fontFamily: font.title, fontSize: 13 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
});
