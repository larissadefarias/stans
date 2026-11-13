import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { PostList } from '../../components/PostList';
import { Button, Card, GradientHeader } from '../../components/ui';
import { colors } from '../../theme';

export default function Feed() {
  const { user } = useAuth();

  return (
    <PostList
      fetchPage={api.feed}
      header={
        <View style={{ marginHorizontal: -16, marginTop: -16, marginBottom: 4 }}>
          <GradientHeader>
            <Text style={s.hello}>Oi, @{user?.username} 💜</Text>
            <Text style={s.sub}>O que está rolando nos seus fandoms</Text>
          </GradientHeader>
        </View>
      }
      empty={
        <Card>
          <Text style={s.emptyTitle}>Seu feed está vazio</Text>
          <Text style={s.emptyText}>
            Entre em comunidades para ver os posts delas aqui. Você também pode postar dentro de cada comunidade.
          </Text>
          <Button title="Explorar comunidades" onPress={() => router.navigate('/communities')} />
        </Card>
      }
    />
  );
}

const s = StyleSheet.create({
  hello: { fontSize: 22, fontWeight: '800', color: colors.white },
  sub: { color: colors.white, opacity: 0.9, marginTop: 2 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  emptyText: { color: colors.muted, marginBottom: 14, lineHeight: 20 },
});
