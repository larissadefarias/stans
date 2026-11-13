import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError, errorMessage, mediaUrl, type Profile as P, type ReportTarget, type WallPost } from '../api';
import { useAuth } from '../auth';
import { Avatar } from './Avatar';
import { Credits } from './Credits';
import { RatingButtons } from './RatingButtons';
import { OptionsSheet, ReportSheet, type Option } from './Sheet';
import { Button, Card, ErrorText, Field, GradientHeader } from './ui';
import type { RatingType } from '../ratings';
import { colors, radius, font } from '../theme';

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: 'Não expira', hours: null },
  { label: '24 horas', hours: 24 },
  { label: '7 dias', hours: 24 * 7 },
];

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const confirmAction = (msg: string, action: string, onYes: () => void) => {
  if (Platform.OS === 'web') { if (globalThis.confirm?.(msg)) onYes(); return; }
  Alert.alert(msg, undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: action, style: 'destructive', onPress: onYes }]);
};

export function ProfileView({ username }: { username: string }) {
  const { user, logout } = useAuth();
  const isMe = user?.username === username;
  const navigation = useNavigation();

  const [profile, setProfile] = useState<P | null>(null);
  const [wall, setWall] = useState<WallPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<Option[] | null>(null);
  const [report, setReport] = useState<{ type: ReportTarget; id: string } | null>(null);

  const [editingStatus, setEditingStatus] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusEmoji, setStatusEmoji] = useState('');
  const [statusHours, setStatusHours] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, w] = await Promise.all([api.profile(username), api.wall(username)]);
      setProfile(p);
      setWall(w);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [username]);

  // Recarrega ao voltar de outra tela (ex.: "Editar perfil")
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await fn(); await load(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };

  const profileMenu = (): Option[] => !profile ? [] : [
    profile.iBlocked
      ? { label: 'Desbloquear', onPress: () => run(() => api.unblock(username)) }
      : {
        label: 'Bloquear', destructive: true,
        onPress: () => confirmAction(`Bloquear @${username}? Vocês deixam de se seguir e ele não poderá te mandar recados, mensagens nem ver seu perfil.`,
          'Bloquear', () => run(() => api.block(username))),
      },
    { label: 'Denunciar perfil', destructive: true, onPress: () => setReport({ type: 'user', id: profile.id }) },
  ];

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isMe ? 'Meu perfil' : `@${username}`,
      headerRight: () => isMe ? (
        <Pressable onPress={async () => { await logout(); router.replace('/login'); }} hitSlop={10} style={{ marginRight: 16 }}>
          <Text style={{ color: colors.violet, fontWeight: '700' }}>Sair</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => setMenu(profileMenu())} hitSlop={10} style={{ marginRight: 16 }} accessibilityLabel="Mais opções">
          <Text style={{ color: colors.violet, fontWeight: '800', fontFamily: font.title, fontSize: 22 }}>⋯</Text>
        </Pressable>
      ),
    });
  }); // sem deps: o menu precisa do perfil mais recente

  const rate = async (type: RatingType) => {
    setError(null);
    try {
      await api.rate(username, type);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'weekly_limit' && profile) setProfile({ ...profile, canRateAt: e.body.retryAt });
      setError(errorMessage(e));
    }
  };

  const saveStatus = async (clear = false) => {
    setError(null);
    try {
      await api.setStatus(clear ? null : statusText.trim() || null, clear ? null : statusEmoji.trim() || null, clear ? null : statusHours);
      setEditingStatus(false);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.postWall(username, message.trim());
      setMessage('');
      setWall(await api.wall(username));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const openDm = () => run(async () => {
    const { roomId } = await api.openDm(username);
    router.push({ pathname: '/chat/[roomId]', params: { roomId, title: `@${username}` } });
  });

  const removeWall = (id: number) => confirmAction('Apagar este recado?', 'Apagar', async () => {
    try {
      await api.deleteWall(id);
      setWall((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.violet} />}
      </View>
    );
  }

  const blocked = profile.iBlocked;

  const header = (
    <View>
      <GradientHeader imageUrl={mediaUrl(profile.cover_url)}>
        <Avatar url={profile.avatar_url} name={profile.display_name} size={88} style={s.avatar} />
        <Text style={s.name}>{profile.display_name}</Text>
        <Text style={s.handle}>@{profile.username}{profile.followsMe && !isMe ? '  ·  segue você' : ''}</Text>
        <View style={s.counts}>
          <Pressable onPress={() => router.push({ pathname: '/u/[username]/follows', params: { username, kind: 'followers' } })}>
            <Text style={s.countText}><Text style={s.countNum}>{profile.followers}</Text> seguidores</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: '/u/[username]/follows', params: { username, kind: 'following' } })}>
            <Text style={s.countText}><Text style={s.countNum}>{profile.following}</Text> seguindo</Text>
          </Pressable>
        </View>
        {(profile.status_text || profile.status_emoji) && (
          <View style={s.statusPill}>
            <Text style={s.statusText}>{profile.status_emoji} {profile.status_text}</Text>
          </View>
        )}
        {!!profile.bio && <Text style={s.bio}>{profile.bio}</Text>}
      </GradientHeader>

      <View style={{ padding: 16, gap: 12 }}>
        {isMe && <Button title="Editar perfil" onPress={() => router.push('/settings')} />}

        {!isMe && blocked && (
          <Card>
            <Text style={s.section}>Você bloqueou este fã</Text>
            <Text style={[s.muted, { marginBottom: 12 }]}>Ele não pode te seguir, mandar recados nem mensagens.</Text>
            <Button title="Desbloquear" variant="ghost" loading={busy} onPress={() => run(() => api.unblock(username))} />
          </Card>
        )}

        {!isMe && !blocked && (
          <View style={s.actions}>
            <View style={{ flex: 1 }}>
              <Button title={profile.isFollowing ? 'Seguindo ✓' : 'Seguir'} variant={profile.isFollowing ? 'ghost' : 'primary'}
                loading={busy} onPress={() => run(() => profile.isFollowing ? api.unfollow(username) : api.follow(username))} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Mensagem" variant="ghost" onPress={openDm} />
            </View>
          </View>
        )}

        {isMe && (
          <Card>
            {editingStatus ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Field label="Emoji" value={statusEmoji} onChangeText={setStatusEmoji} maxLength={8} style={{ width: 64, textAlign: 'center' }} />
                  <View style={{ flex: 1 }}>
                    <Field label="Status" value={statusText} onChangeText={setStatusText} maxLength={80} placeholder="Ouvindo o novo álbum…" />
                  </View>
                </View>
                <View style={s.chips}>
                  {DURATIONS.map((d) => (
                    <Pressable key={d.label} onPress={() => setStatusHours(d.hours)}
                      style={[s.chip, statusHours === d.hours && s.chipActive]}>
                      <Text style={[s.chipText, statusHours === d.hours && { color: colors.white }]}>{d.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Button title="Salvar status" onPress={() => saveStatus()} />
                <View style={{ height: 8 }} />
                <Button title="Limpar status" variant="ghost" onPress={() => saveStatus(true)} />
              </>
            ) : (
              <Button title="Editar status" variant="ghost" onPress={() => {
                setStatusText(profile.status_text ?? '');
                setStatusEmoji(profile.status_emoji ?? '');
                setEditingStatus(true);
              }} />
            )}
          </Card>
        )}

        {!blocked && (
          <Card>
            <Text style={s.section}>{isMe ? 'Como os fãs te avaliam' : `Avalie @${profile.username}`}</Text>
            {profile.ratings === null && <Text style={s.muted}>Este fã ocultou as avaliações recebidas.</Text>}
            <RatingButtons counts={profile.ratings} canRateAt={profile.canRateAt} onRate={rate} isOwnProfile={isMe} />
            {!isMe && !profile.canRateAt && <Text style={[s.muted, { marginTop: 8 }]}>1 voto por semana para cada perfil. Seu voto é anônimo.</Text>}
          </Card>
        )}

        {profile.fandoms.length > 0 && (
          <Card>
            <Text style={s.section}>Fandoms</Text>
            <View style={s.chips}>
              {profile.fandoms.map((f) => (
                <Pressable key={f.id} style={s.chip} onPress={() => router.push({ pathname: '/c/[id]', params: { id: f.id, name: f.name } })}>
                  <Text style={s.chipText}>{f.name}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        )}

        <ErrorText>{error}</ErrorText>

        {/* O mural é para os outros fãs escreverem; no próprio perfil só se lê e apaga */}
        {isMe ? (
          <Text style={[s.section, { marginBottom: 0 }]}>Recados que você recebeu</Text>
        ) : !blocked && (
          <Card>
            <Text style={s.section}>Mural de recados</Text>
            <TextInput
              value={message} onChangeText={setMessage} maxLength={300} multiline
              placeholder={`Deixe um recado para @${profile.username}…`}
              placeholderTextColor={colors.muted} style={s.composer}
            />
            <Text style={s.counter}>{message.length}/300</Text>
            <Button title="Enviar recado" onPress={send} loading={sending} disabled={!message.trim()} />
          </Card>
        )}
      </View>
    </View>
  );

  return (
    <>
      <FlatList
        data={blocked ? [] : wall}
        keyExtractor={(w) => String(w.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={blocked ? undefined : (
          <Text style={[s.muted, { textAlign: 'center' }]}>
            {isMe ? 'Você ainda não recebeu recados.' : 'Nenhum recado ainda. Seja o primeiro!'}
          </Text>
        )}
        ListFooterComponent={<Credits />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const mine = item.authorUsername === user?.username;
          const options: Option[] = [
            ...(isMe || mine ? [{ label: 'Apagar recado', destructive: true, onPress: () => removeWall(item.id) }] : []),
            ...(!mine ? [{ label: 'Denunciar recado', destructive: true, onPress: () => setReport({ type: 'wall', id: String(item.id) }) }] : []),
          ];
          return (
            <View style={{ paddingHorizontal: 16, marginBottom: 10, marginLeft: item.parentId ? 32 : 0 }}>
              <Card style={{ padding: 12 }}>
                <View style={s.row}>
                  <Pressable onPress={() => router.push(`/u/${item.authorUsername}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Avatar url={item.authorAvatar} name={item.authorUsername} size={28} />
                    <Text style={s.author}>@{item.authorUsername}</Text>
                  </Pressable>
                  <Text style={s.muted}>{when(item.createdAt)}</Text>
                  {options.length > 0 && (
                    <Pressable onPress={() => setMenu(options)} hitSlop={10} accessibilityLabel="Opções do recado" style={{ marginLeft: 8 }}>
                      <Text style={{ color: colors.muted, fontWeight: '800', fontFamily: font.title, fontSize: 18 }}>⋯</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={s.wallText}>{item.content}</Text>
              </Card>
            </View>
          );
        }}
      />
      <OptionsSheet visible={!!menu} options={menu ?? []} onClose={() => setMenu(null)} />
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </>
  );
}

const s = StyleSheet.create({
  avatar: { alignSelf: 'center', borderWidth: 3, borderColor: colors.white },
  name: { textAlign: 'center', fontSize: 22, fontWeight: '800', fontFamily: font.title, color: colors.white, marginTop: 10 },
  handle: { textAlign: 'center', color: colors.white, opacity: 0.9 },
  counts: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 },
  countText: { color: colors.white, opacity: 0.95 },
  countNum: { fontWeight: '800', fontFamily: font.title },
  statusPill: { alignSelf: 'center', marginTop: 10, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  statusText: { color: colors.ink, fontWeight: '600' },
  bio: { textAlign: 'center', color: colors.white, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  section: { fontSize: 16, fontWeight: '800', fontFamily: font.title, color: colors.ink, marginBottom: 10 },
  muted: { fontSize: 12, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.skyBg, borderWidth: 1, borderColor: colors.babyBlue },
  chipActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  composer: {
    minHeight: 72, backgroundColor: colors.skyBg, borderRadius: 12, borderWidth: 1, borderColor: colors.babyBlue,
    padding: 12, fontSize: 15, color: colors.ink, textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: colors.muted, marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  author: { fontWeight: '800', fontFamily: font.title, color: colors.violet },
  wallText: { marginTop: 6, color: colors.ink, lineHeight: 20 },
});
