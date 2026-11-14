import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { api, errorMessage, mediaUrl, type ImageKind, type UserSummary } from '../api';
import { useAuth } from '../auth';
import { Avatar } from '../components/Avatar';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { UserRow } from '../components/UserRow';
import { colors, radius, font, setThemePref, themePref } from '../theme';

type WallPolicy = 'everyone' | 'following';

export default function Settings() {
  const { user, me } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [wallPolicy, setWallPolicy] = useState<WallPolicy>('everyone');
  const [hideRatings, setHideRatings] = useState(false);
  const [invisible, setInvisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const [blocked, setBlocked] = useState<UserSummary[]>([]);

  useEffect(() => {
    if (!user) return;
    api.profile(user.username)
      .then((p) => {
        setDisplayName(p.display_name);
        setBio(p.bio ?? '');
        setWallPolicy(p.wall_policy);
        setHideRatings(p.hide_ratings);
        setInvisible(!!p.invisible);
        setAvatarUrl(p.avatar_url);
        setCoverUrl(p.cover_url);
        setLoaded(true);
      })
      .catch((e) => setError(errorMessage(e)));
    api.blocks().then(setBlocked).catch(() => {});
  }, [user]);

  // Escolhe da galeria (com recorte) e envia na hora; a foto já fica salva mesmo sem apertar "Salvar perfil"
  const pick = async (kind: ImageKind) => {
    setError(null);
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'avatar' ? [1, 1] : [3, 1],
      quality: 0.8,
    });
    if (r.canceled || !r.assets[0]) return;
    setUploading(kind);
    try {
      const { url } = await api.uploadImage(kind, r.assets[0]);
      kind === 'avatar' ? setAvatarUrl(url) : setCoverUrl(url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(null);
    }
  };

  const removeImage = async (kind: ImageKind) => {
    setError(null);
    try {
      await api.removeImage(kind);
      kind === 'avatar' ? setAvatarUrl(null) : setCoverUrl(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const save = async () => {
    if (!displayName.trim()) return setError('O nome de exibição não pode ficar vazio.');
    setError(null);
    setSaving(true);
    try {
      await api.updateSettings({ displayName: displayName.trim(), bio: bio.trim(), wallPolicy, hideRatings, invisible });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
        {error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.violet} />}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={s.cover}>
          {coverUrl
            ? <Image source={{ uri: mediaUrl(coverUrl)! }} style={StyleSheet.absoluteFill} accessibilityLabel="Sua capa" />
            : <Text style={s.coverEmpty}>Sem capa</Text>}
          {uploading === 'cover' && <ActivityIndicator color={colors.white} style={s.spinner} />}
        </View>
        <View style={s.avatarWrap}>
          <Avatar url={avatarUrl} name={displayName || user?.username || '?'} size={88} style={s.avatarBorder} />
          {uploading === 'avatar' && <ActivityIndicator color={colors.violet} style={s.spinner} />}
        </View>
        <View style={s.mediaButtons}>
          <MediaButton label="Trocar foto" onPress={() => pick('avatar')} />
          <MediaButton label="Trocar capa" onPress={() => pick('cover')} />
        </View>
        <View style={[s.mediaButtons, { paddingTop: 0 }]}>
          {avatarUrl && <MediaButton label="Remover foto" subtle onPress={() => removeImage('avatar')} />}
          {coverUrl && <MediaButton label="Remover capa" subtle onPress={() => removeImage('cover')} />}
        </View>
      </Card>

      <Card>
        <Text style={s.section}>Sobre você</Text>
        <Field label="Nome de exibição" value={displayName} onChangeText={setDisplayName} maxLength={40} />
        <Field label="Bio" value={bio} onChangeText={setBio} maxLength={300} multiline
          placeholder="Conte de quais fandoms você faz parte…" style={{ minHeight: 90, textAlignVertical: 'top' }} />
        <Text style={s.counter}>{bio.length}/300</Text>
      </Card>

      <Card>
        <Text style={s.section}>Mural de recados</Text>
        <Text style={s.hint}>Quem pode escrever no seu mural?</Text>
        <View style={s.chips}>
          {([['everyone', 'Todos os fãs'], ['following', 'Só quem eu sigo']] as const).map(([value, label]) => (
            <Pressable key={value} onPress={() => setWallPolicy(value)} accessibilityRole="radio"
              accessibilityState={{ selected: wallPolicy === value }}
              style={[s.chip, wallPolicy === value && s.chipActive]}>
              <Text style={[s.chipText, wallPolicy === value && { color: colors.white }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={s.section}>Aparência</Text>
        <Text style={s.hint}>Muda na hora (o app recarrega).</Text>
        <View style={s.chips}>
          {([['auto', '📱 Automático'], ['light', '☀️ Claro'], ['dark', '🌙 Escuro']] as const).map(([value, label]) => (
            <Pressable key={value} onPress={() => value !== themePref && setThemePref(value)} accessibilityRole="radio"
              accessibilityState={{ selected: themePref === value }}
              style={[s.chip, themePref === value && s.chipActive]}>
              <Text style={[s.chipText, themePref === value && { color: colors.white }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={s.section}>Privacidade</Text>
        <Toggle label="Ocultar minhas avaliações" hint="Os outros fãs ainda podem te avaliar, mas não veem os totais."
          value={hideRatings} onChange={setHideRatings} />
        <View style={s.divider} />
        <Toggle label="Modo invisível" hint="Ninguém vê quando você está online no chat."
          value={invisible} onChange={setInvisible} />
      </Card>

      {blocked.length > 0 && (
        <Card>
          <Text style={s.section}>Fãs bloqueados</Text>
          {blocked.map((b) => (
            <UserRow key={b.username} user={b} right={
              <Pressable style={s.chip} accessibilityRole="button" onPress={async () => {
                try { await api.unblock(b.username); setBlocked((l) => l.filter((x) => x.username !== b.username)); }
                catch (e) { setError(errorMessage(e)); }
              }}>
                <Text style={s.chipText}>Desbloquear</Text>
              </Pressable>
            } />
          ))}
        </Card>
      )}

      {me?.isModerator && (
        <Card>
          <Text style={s.section}>🛡️ Moderação</Text>
          <Text style={s.hint}>Veja as denúncias e decida o que fazer.</Text>
          <Button title="Abrir denúncias" variant="ghost" onPress={() => router.push('/mod')} />
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Salvar perfil" onPress={save} loading={saving} />
    </ScrollView>
  );
}

function MediaButton({ label, onPress, subtle }: { label: string; onPress: () => void; subtle?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[s.chip, !subtle && s.chipActive]}>
      <Text style={[s.chipText, !subtle && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.hint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label}
        trackColor={{ true: colors.lilac, false: colors.babyBlue }} thumbColor={value ? colors.violet : colors.white} />
    </View>
  );
}

const s = StyleSheet.create({
  cover: { height: 120, backgroundColor: colors.lilac, alignItems: 'center', justifyContent: 'center' },
  coverEmpty: { color: colors.white, fontWeight: '700', opacity: 0.85 },
  avatarWrap: { alignSelf: 'center', marginTop: -44 },
  avatarBorder: { borderWidth: 4, borderColor: colors.white },
  spinner: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  mediaButtons: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, padding: 12 },
  section: { fontSize: 16, fontWeight: '800', fontFamily: font.title, color: colors.ink, marginBottom: 10 },
  hint: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: colors.muted, marginTop: -6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.skyBg, borderWidth: 1, borderColor: colors.babyBlue },
  chipActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontWeight: '700', color: colors.ink, marginBottom: 2 },
  divider: { height: 1, backgroundColor: colors.babyBlue, marginVertical: 12 },
});
