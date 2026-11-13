import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { api, errorMessage, type CommunityDetail } from '../../api';
import { PostList } from '../../components/PostList';
import { Button, Card, ErrorText } from '../../components/ui';
import { colors, radius } from '../../theme';

type Picked = ImagePicker.ImagePickerAsset;

export default function CommunityScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [content, setContent] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [image, setImage] = useState<Picked | null>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // muda para recarregar a lista depois de postar

  const loadCommunity = useCallback(() => api.community(id).then(setCommunity).catch((e) => setError(errorMessage(e))), [id]);
  useEffect(() => { void loadCommunity(); }, [loadCommunity]);

  const fetchPage = useCallback((cursor?: string) => api.communityPosts(id, cursor), [id, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const member = !!community?.myRole;

  const toggleMembership = async () => {
    setBusy(true);
    setError(null);
    try {
      if (member) await api.leaveCommunity(id); else await api.joinCommunity(id);
      await loadCommunity();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openChat = async () => {
    setError(null);
    try {
      const { roomId } = await api.communityRoom(id);
      router.push({ pathname: '/chat/[roomId]', params: { roomId, title: community?.name ?? name ?? 'Chat' } });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!r.canceled && r.assets[0]) setImage(r.assets[0]);
  };

  const post = async () => {
    if (!content.trim()) return;
    setSending(true);
    setError(null);
    try {
      const imageUrl = image ? (await api.uploadImage('post', image)).url : undefined;
      await api.createPost(id, content.trim(), spoiler, imageUrl);
      setContent('');
      setSpoiler(false);
      setImage(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <Card>
        {!community ? <ActivityIndicator color={colors.violet} /> : (
          <>
            <Text style={s.title}>{community.name}</Text>
            <Text style={s.meta}>{community.members} {community.members === 1 ? 'fã' : 'fãs'}{community.myRole === 'owner' ? ' · você é dono(a)' : ''}</Text>
            {!!community.description && <Text style={s.desc}>{community.description}</Text>}
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Button title={member ? 'Membro ✓' : 'Entrar na comunidade'} variant={member ? 'ghost' : 'primary'}
                  loading={busy} onPress={toggleMembership} disabled={community.myRole === 'owner'} />
              </View>
              {member && (
                <View style={{ flex: 1 }}>
                  <Button title="💬 Chat" onPress={openChat} />
                </View>
              )}
            </View>
          </>
        )}
      </Card>

      {member && (
        <Card>
          <TextInput
            value={content} onChangeText={setContent} maxLength={2000} multiline
            placeholder="Compartilhe algo com a comunidade…" placeholderTextColor={colors.muted} style={s.input}
          />
          {image && (
            <View style={{ marginTop: 10 }}>
              <Image source={{ uri: image.uri }} style={s.preview} />
              <Pressable onPress={() => setImage(null)} style={s.removeImage} accessibilityLabel="Remover imagem">
                <Text style={{ color: colors.white, fontWeight: '800' }}>✕</Text>
              </Pressable>
            </View>
          )}
          <View style={s.composerRow}>
            <Pressable onPress={pickImage} style={s.chip} accessibilityRole="button">
              <Text style={s.chipText}>📷 Foto</Text>
            </Pressable>
            <View style={s.spoilerRow}>
              <Switch value={spoiler} onValueChange={setSpoiler} accessibilityLabel="Marcar como spoiler"
                trackColor={{ true: colors.lilac, false: colors.babyBlue }} thumbColor={spoiler ? colors.violet : colors.white} />
              <Text style={s.spoilerLabel} onPress={() => setSpoiler(!spoiler)}>Spoiler</Text>
            </View>
            <View style={{ width: 100, marginLeft: 'auto' }}>
              <Button title="Postar" onPress={post} loading={sending} disabled={!content.trim()} />
            </View>
          </View>
        </Card>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: community?.name ?? name ?? 'Comunidade' }} />
      <PostList
        fetchPage={fetchPage}
        showCommunity={false}
        header={header}
        empty={<Text style={s.empty}>{member ? 'Nenhum post ainda. Que tal ser o primeiro?' : 'Nenhum post ainda. Entre na comunidade para postar.'}</Text>}
      />
    </>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  desc: { color: colors.ink, marginTop: 8, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  input: {
    minHeight: 72, backgroundColor: colors.skyBg, borderRadius: 12, borderWidth: 1, borderColor: colors.babyBlue,
    padding: 12, fontSize: 15, color: colors.ink, textAlignVertical: 'top',
  },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12 },
  removeImage: {
    position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(20,17,43,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.skyBg, borderWidth: 1, borderColor: colors.babyBlue },
  chipText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  spoilerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spoilerLabel: { color: colors.ink, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
});
