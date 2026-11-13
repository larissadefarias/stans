import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { api, errorMessage } from '../../api';
import { PostList } from '../../components/PostList';
import { Button, Card, ErrorText } from '../../components/ui';
import { colors } from '../../theme';

export default function CommunityScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [content, setContent] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // muda para recarregar a lista depois de postar

  const fetchPage = useCallback((cursor?: string) => api.communityPosts(id, cursor), [id, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async () => {
    if (!content.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.createPost(id, content.trim(), spoiler);
      setContent('');
      setSpoiler(false);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: name ?? 'Comunidade' }} />
      <PostList
        fetchPage={fetchPage}
        showCommunity={false}
        header={
          <Card style={{ marginBottom: 4 }}>
            <TextInput
              value={content} onChangeText={setContent} maxLength={2000} multiline
              placeholder="Compartilhe algo com a comunidade…" placeholderTextColor={colors.muted} style={s.input}
            />
            <View style={s.row}>
              <View style={s.spoilerRow}>
                <Switch value={spoiler} onValueChange={setSpoiler} accessibilityLabel="Marcar como spoiler"
                  trackColor={{ true: colors.lilac, false: colors.babyBlue }} thumbColor={spoiler ? colors.violet : colors.white} />
                <Text style={s.spoilerLabel} onPress={() => setSpoiler(!spoiler)}>Contém spoiler</Text>
              </View>
              <View style={{ width: 110 }}>
                <Button title="Postar" onPress={post} loading={sending} disabled={!content.trim()} />
              </View>
            </View>
            <ErrorText>{error}</ErrorText>
          </Card>
        }
        empty={<Text style={s.empty}>Nenhum post ainda. Que tal ser o primeiro?</Text>}
      />
    </>
  );
}

const s = StyleSheet.create({
  input: {
    minHeight: 72, backgroundColor: colors.skyBg, borderRadius: 12, borderWidth: 1, borderColor: colors.babyBlue,
    padding: 12, fontSize: 15, color: colors.ink, textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  spoilerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spoilerLabel: { color: colors.ink, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
});
