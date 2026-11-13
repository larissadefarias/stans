import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../api';
import { PostList } from '../../components/PostList';
import { Card, GradientHeader } from '../../components/ui';
import { colors, font } from '../../theme';

/** Todos os posts com uma hashtag, de todas as comunidades. */
export default function TagScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const fetchPage = useCallback((cursor?: string) => api.tagPosts(tag, cursor), [tag]);

  return (
    <>
      <Stack.Screen options={{ title: `#${tag}` }} />
      <PostList
        fetchPage={fetchPage}
        header={
          <View style={{ marginHorizontal: -16, marginTop: -16, marginBottom: 4 }}>
            <GradientHeader>
              <Text style={s.title}>#{tag}</Text>
              <Text style={s.sub}>Posts de todas as comunidades com essa hashtag</Text>
            </GradientHeader>
          </View>
        }
        empty={
          <Card>
            <Text style={s.emptyText}>Ainda não tem posts com #{tag}. Que tal ser o primeiro?</Text>
          </Card>
        }
      />
    </>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', fontFamily: font.title, color: colors.white },
  sub: { color: colors.white, opacity: 0.9, marginTop: 2 },
  emptyText: { color: colors.muted, lineHeight: 20 },
});
