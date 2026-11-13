import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text } from 'react-native';
import { api, errorMessage, type UserSummary } from '../../../api';
import { ErrorText } from '../../../components/ui';
import { UserRow } from '../../../components/UserRow';
import { colors } from '../../../theme';

export default function Follows() {
  const { username, kind } = useLocalSearchParams<{ username: string; kind: 'followers' | 'following' }>();
  const [list, setList] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.follows(username, kind).then(setList).catch((e) => setError(errorMessage(e)));
  }, [username, kind]);

  return (
    <>
      <Stack.Screen options={{ title: kind === 'followers' ? `Seguidores de @${username}` : `@${username} segue` }} />
      {error ? <ErrorText>{error}</ErrorText> : !list ? <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={list}
          keyExtractor={(u) => u.username}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => <UserRow user={item} />}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.muted, marginTop: 24 }}>Ninguém por aqui ainda.</Text>}
        />
      )}
    </>
  );
}
