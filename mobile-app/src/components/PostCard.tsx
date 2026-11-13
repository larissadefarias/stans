import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, mediaUrl, type Post, type PostRatingType } from '../api';
import { RATINGS } from '../ratings';
import { colors, radius, font } from '../theme';
import { Avatar } from './Avatar';
import { OptionsSheet, ReportSheet, type Option } from './Sheet';
import { Card } from './ui';

export const timeAgo = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

type Props = { post: Post; showCommunity?: boolean; canDelete?: boolean; onDeleted?: () => void; hideCommentsLink?: boolean };

export function PostCard({ post, showCommunity = true, canDelete, onDeleted, hideCommentsLink }: Props) {
  const [revealed, setRevealed] = useState(!post.isSpoiler);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [myRating, setMyRating] = useState<PostRatingType | null>(post.myRating ?? null);
  const [ratings, setRatings] = useState(post.ratings ?? {});
  const image = mediaUrl(post.imageUrl);

  const rate = async (type: PostRatingType) => {
    // Atualiza na hora; o servidor devolve a contagem certa logo depois
    const prev = { myRating, ratings };
    const next = { ...ratings };
    if (myRating) next[myRating] = Math.max(0, (next[myRating] ?? 0) - 1);
    if (myRating !== type) next[type] = (next[type] ?? 0) + 1;
    setMyRating(myRating === type ? null : type);
    setRatings(next);
    try {
      const r = await api.ratePost(post.id, type);
      setMyRating(r.myRating);
      setRatings(r.ratings);
    } catch {
      setMyRating(prev.myRating);
      setRatings(prev.ratings);
    }
  };

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

  const openComments = () => router.push({
    pathname: '/p/[id]',
    params: { id: post.id, author: post.authorUsername, community: post.communityName },
  });

  const options: Option[] = [
    ...(canDelete ? [{ label: 'Apagar post', destructive: true, onPress: async () => {
      try { await api.deletePost(post.id); onDeleted?.(); } catch { /* já apagado */ }
    } }] : []),
    ...(!canDelete ? [{ label: 'Denunciar post', destructive: true, onPress: () => setReporting(true) }] : []),
  ];

  return (
    <Card>
      <View style={s.head}>
        <Pressable onPress={() => router.push(`/u/${post.authorUsername}`)}>
          <Avatar url={post.authorAvatar} name={post.authorUsername} size={40} />
        </Pressable>
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
        <Pressable onPress={() => setMenu(true)} hitSlop={10} accessibilityLabel="Opções do post">
          <Text style={s.more}>⋯</Text>
        </Pressable>
      </View>

      {revealed ? (
        <>
          <Text style={s.content}>{post.content}</Text>
          {image && <Image source={{ uri: image }} style={s.image} resizeMode="cover" accessibilityLabel="Imagem do post" />}
        </>
      ) : (
        <Pressable onPress={() => setRevealed(true)} style={s.spoiler} accessibilityRole="button">
          <Text style={s.spoilerTitle}>⚠️ Contém spoiler</Text>
          <Text style={s.spoilerHint}>Toque para ver{image ? ' (tem imagem)' : ''}</Text>
        </Pressable>
      )}

      {post.tags.length > 0 && (
        <View style={s.tags}>{post.tags.map((t) => <Text key={t} style={s.tag}>#{t}</Text>)}</View>
      )}

      <View style={s.rates}>
        {RATINGS.map((r) => {
          const active = myRating === r.type;
          const n = ratings[r.type] ?? 0;
          return (
            <Pressable key={r.type} onPress={() => rate(r.type)} hitSlop={4} accessibilityRole="button"
              accessibilityLabel={`${r.label}${n ? `, ${n}` : ''}`} accessibilityState={{ selected: active }}
              style={[s.rate, active && { borderColor: r.color, backgroundColor: colors.skyBg }]}>
              <Image source={r.icon} style={s.rateIcon} accessibilityIgnoresInvertColors />
              {n > 0 && <Text style={[s.rateCount, active && { color: colors.ink }]}>{n}</Text>}
            </Pressable>
          );
        })}
      </View>

      <View style={s.actions}>
        <Pressable onPress={toggleLike} hitSlop={8} accessibilityRole="button"
          accessibilityLabel={liked ? 'Descurtir' : 'Curtir'} style={s.action}>
          <Text style={[s.actionText, liked && { color: colors.pink }]}>{liked ? '♥' : '♡'} {likes}</Text>
        </Pressable>
        {hideCommentsLink ? (
          <Text style={s.actionText}>💬 {post.comments}</Text>
        ) : (
          <Pressable onPress={openComments} hitSlop={8} accessibilityRole="button" accessibilityLabel="Ver comentários" style={s.action}>
            <Text style={s.actionText}>💬 {post.comments} {post.comments === 1 ? 'comentário' : 'comentários'}</Text>
          </Pressable>
        )}
      </View>

      <OptionsSheet visible={menu} options={options} onClose={() => setMenu(false)} />
      <ReportSheet target={reporting ? { type: 'post', id: post.id } : null} onClose={() => setReporting(false)} />
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  author: { fontWeight: '800', fontFamily: font.title, color: colors.ink },
  meta: { fontSize: 12, color: colors.muted },
  more: { color: colors.muted, fontWeight: '800', fontFamily: font.title, fontSize: 20, paddingHorizontal: 4 },
  content: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, marginTop: 10, backgroundColor: colors.skyBg },
  spoiler: { backgroundColor: colors.spoiler, borderRadius: 12, paddingVertical: 22, alignItems: 'center' },
  spoilerTitle: { color: colors.white, fontWeight: '800', fontFamily: font.title },
  spoilerHint: { color: colors.lilac, fontSize: 12, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { color: colors.violet, fontSize: 13, fontWeight: '600' },
  rates: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  rate: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.babyBlue,
  },
  rateIcon: { width: 20, height: 20 },
  rateCount: { fontSize: 13, fontWeight: '700', color: colors.muted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.skyBg },
  action: { borderRadius: radius.pill },
  actionText: { fontSize: 14, color: colors.muted, fontWeight: '700' },
});
