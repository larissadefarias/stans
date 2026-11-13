import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type Post } from '../api';
import { colors, radius } from '../theme';
import { Avatar } from './Avatar';
import { Card } from './ui';

const timeAgo = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

type Props = { post: Post; showCommunity?: boolean; canDelete?: boolean; onDeleted?: () => void };

export function PostCard({ post, showCommunity = true, canDelete, onDeleted }: Props) {
  const [revealed, setRevealed] = useState(!post.isSpoiler);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);

  const toggleLike = async () => {
    // Atualiza na hora e corrige se o servidor discordar
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    try {
      const r = await api.like(post.id);
      if (r.liked === liked) { setLiked(r.liked); setLikes((n) => n + (r.liked ? 1 : -1)); }
    } catch {
      setLiked(liked);
      setLikes(post.likes);
    }
  };

  const remove = async () => {
    try { await api.deletePost(post.id); onDeleted?.(); } catch { /* já apagado */ }
  };

  return (
    <Card>
      <View style={s.head}>
        <Avatar url={post.authorAvatar} name={post.authorUsername} size={40} />
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => router.push(`/u/${post.authorUsername}`)}>
            <Text style={s.author}>@{post.authorUsername}</Text>
          </Pressable>
          <Text style={s.meta}>
            {showCommunity && (
              <Text onPress={() => router.push({ pathname: '/c/[id]', params: { id: post.communityId, name: post.communityName } })}
                style={{ color: colors.violet }}>{post.communityName} · </Text>
            )}
            {timeAgo(post.createdAt)}
          </Text>
        </View>
      </View>

      {revealed ? (
        <Text style={s.content}>{post.content}</Text>
      ) : (
        <Pressable onPress={() => setRevealed(true)} style={s.spoiler} accessibilityRole="button">
          <Text style={s.spoilerTitle}>⚠️ Contém spoiler</Text>
          <Text style={s.spoilerHint}>Toque para ver</Text>
        </Pressable>
      )}

      {post.tags.length > 0 && (
        <View style={s.tags}>{post.tags.map((t) => <Text key={t} style={s.tag}>#{t}</Text>)}</View>
      )}

      <View style={s.actions}>
        <Pressable onPress={toggleLike} hitSlop={8} accessibilityRole="button"
          accessibilityLabel={liked ? 'Descurtir' : 'Curtir'} style={s.action}>
          <Text style={[s.actionText, liked && { color: colors.pink }]}>{liked ? '♥' : '♡'} {likes}</Text>
        </Pressable>
        <Text style={s.actionText}>💬 {post.comments}</Text>
        {canDelete && (
          <Pressable onPress={remove} hitSlop={8} style={{ marginLeft: 'auto' }}>
            <Text style={{ color: colors.pink, fontSize: 12, fontWeight: '700' }}>Apagar</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.babyBlue, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', color: colors.violet, fontSize: 17 },
  author: { fontWeight: '800', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted },
  content: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  spoiler: { backgroundColor: colors.ink, borderRadius: 12, paddingVertical: 22, alignItems: 'center' },
  spoilerTitle: { color: colors.white, fontWeight: '800' },
  spoilerHint: { color: colors.lilac, fontSize: 12, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { color: colors.violet, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.skyBg },
  action: { borderRadius: radius.pill },
  actionText: { fontSize: 14, color: colors.muted, fontWeight: '700' },
});
