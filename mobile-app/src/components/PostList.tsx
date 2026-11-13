import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { cursorAfter, errorMessage, type Post } from '../api';
import { useAuth } from '../auth';
import { colors } from '../theme';
import { PostCard } from './PostCard';
import { ErrorText } from './ui';

type Props = {
  fetchPage: (cursor?: string) => Promise<Post[]>;
  header?: ReactElement;
  empty?: ReactElement;
  showCommunity?: boolean;
};

/** Lista de posts com "puxar para atualizar" e carregamento infinito por cursor. */
export function PostList({ fetchPage, header, empty, showCommunity }: Props) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const page = await fetchPage();
      done.current = page.length < 20;
      setPosts(page);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  // Atualiza sempre que a tela volta a ficar visível (ex.: depois de entrar numa comunidade)
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const loadMore = async () => {
    if (done.current || loadingMore || refreshing || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursorAfter(posts));
      done.current = page.length < 20;
      setPosts((prev) => [...prev, ...page]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.violet} />}
      ListHeaderComponent={<>{header}<ErrorText>{error}</ErrorText></>}
      ListEmptyComponent={!refreshing && !error ? empty : undefined}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.violet} /> : undefined}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      renderItem={({ item }) => (
        <PostCard post={item} showCommunity={showCommunity}
          canDelete={item.authorUsername === user?.username}
          onDeleted={() => setPosts((prev) => prev.filter((p) => p.id !== item.id))} />
      )}
    />
  );
}
