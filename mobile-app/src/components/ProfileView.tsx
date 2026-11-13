import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError, errorMessage, mediaUrl, type Profile as P, type WallPost } from '../api';
import { useAuth } from '../auth';
import { Avatar } from './Avatar';
import { Credits } from './Credits';
import { RatingButtons } from './RatingButtons';
import { Button, Card, ErrorText, Field, GradientHeader } from './ui';
import type { RatingType } from '../ratings';
import { colors, radius } from '../theme';

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: 'Não expira', hours: null },
  { label: '24 horas', hours: 24 },
  { label: '7 dias', hours: 24 * 7 },
];

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const confirm = (msg: string, onYes: () => void) => {
  if (Platform.OS === 'web') { if (globalThis.confirm?.(msg)) onYes(); return; }
  Alert.alert(msg, undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: onYes }]);
};

export function ProfileView({ username }: { username: string }) {
  const { user, logout } = useAuth();
  const isMe = user?.username === username;
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isMe ? 'Meu perfil' : `@${username}`,
      headerRight: isMe ? () => (
        <Pressable onPress={async () => { await logout(); router.replace('/login'); }} hitSlop={10} style={{ marginRight: 16 }}>
          <Text style={{ color: colors.violet, fontWeight: '700' }}>Sair</Text>
        </Pressable>
      ) : undefined,
    });
  }, [navigation, isMe, username, logout]);

  const [profile, setProfile] = useState<P | null>(null);
  const [wall, setWall] = useState<WallPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

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

  // Recarrega ao voltar da tela "Editar perfil"
  useFocusEffect(useCallback(() => { void load(); }, [load]));

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

  const remove = (id: number) => confirm('Apagar este recado?', async () => {
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

  const header = (
    <View>
      <GradientHeader imageUrl={mediaUrl(profile.cover_url)}>
        <Avatar url={profile.avatar_url} name={profile.display_name} size={88} style={s.avatar} />
        <Text style={s.name}>{profile.display_name}</Text>
        <Text style={s.handle}>@{profile.username}</Text>
        {(profile.status_text || profile.status_emoji) && (
          <View style={s.statusPill}>
            <Text style={s.statusText}>{profile.status_emoji} {profile.status_text}</Text>
          </View>
        )}
        {!!profile.bio && <Text style={s.bio}>{profile.bio}</Text>}
      </GradientHeader>

      <View style={{ padding: 16, gap: 12 }}>
        {isMe && <Button title="Editar perfil" onPress={() => router.push('/settings')} />}

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
                <View style={s.durations}>
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

        <Card>
          <Text style={s.section}>{isMe ? 'Como os fãs te avaliam' : `Avalie @${profile.username}`}</Text>
          {profile.ratings === null && <Text style={s.muted}>Este fã ocultou as avaliações recebidas.</Text>}
          <RatingButtons counts={profile.ratings} canRateAt={profile.canRateAt} onRate={rate} isOwnProfile={isMe} />
          {!isMe && !profile.canRateAt && <Text style={[s.muted, { marginTop: 8 }]}>1 voto por semana para cada perfil.</Text>}
        </Card>

        {profile.fandoms.length > 0 && (
          <Card>
            <Text style={s.section}>Fandoms</Text>
            <View style={s.durations}>
              {profile.fandoms.map((f) => <View key={f.id} style={s.chip}><Text style={s.chipText}>{f.name}</Text></View>)}
            </View>
          </Card>
        )}

        <ErrorText>{error}</ErrorText>

        {/* O mural é para os outros fãs escreverem; no próprio perfil só se lê e apaga */}
        {isMe ? (
          <Text style={[s.section, { marginBottom: 0 }]}>Recados que você recebeu</Text>
        ) : (
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
      <FlatList
        data={wall}
        keyExtractor={(w) => String(w.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={[s.muted, { textAlign: 'center' }]}>
            {isMe ? 'Você ainda não recebeu recados.' : 'Nenhum recado ainda. Seja o primeiro!'}
          </Text>
        }
        ListFooterComponent={<Credits />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const canDelete = isMe || item.authorUsername === user?.username;
          return (
            <View style={{ paddingHorizontal: 16, marginBottom: 10, marginLeft: item.parentId ? 32 : 0 }}>
              <Card style={{ padding: 12 }}>
                <View style={s.row}>
                  <Pressable onPress={() => router.push(`/u/${item.authorUsername}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Avatar url={item.authorAvatar} name={item.authorUsername} size={28} />
                    <Text style={s.author}>@{item.authorUsername}</Text>
                  </Pressable>
                  <Text style={s.muted}>{when(item.createdAt)}</Text>
                </View>
                <Text style={s.wallText}>{item.content}</Text>
                {canDelete && (
                  <Pressable onPress={() => remove(item.id)} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
                    <Text style={{ color: colors.pink, fontSize: 12, fontWeight: '700' }}>Apagar</Text>
                  </Pressable>
                )}
              </Card>
            </View>
          );
        }}
      />
  );
}

const s = StyleSheet.create({
  avatar: { alignSelf: 'center', borderWidth: 3, borderColor: colors.white },
  avatarText: { fontSize: 36, fontWeight: '800', color: colors.violet },
  name: { textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.white, marginTop: 10 },
  handle: { textAlign: 'center', color: colors.white, opacity: 0.9 },
  statusPill: { alignSelf: 'center', marginTop: 10, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  statusText: { color: colors.ink, fontWeight: '600' },
  bio: { textAlign: 'center', color: colors.white, marginTop: 10 },
  section: { fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  muted: { fontSize: 12, color: colors.muted },
  durations: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.skyBg, borderWidth: 1, borderColor: colors.babyBlue },
  chipActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  composer: {
    minHeight: 72, backgroundColor: colors.skyBg, borderRadius: 12, borderWidth: 1, borderColor: colors.babyBlue,
    padding: 12, fontSize: 15, color: colors.ink, textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: colors.muted, marginVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  author: { fontWeight: '800', color: colors.violet },
  wallText: { marginTop: 6, color: colors.ink, lineHeight: 20 },
});
