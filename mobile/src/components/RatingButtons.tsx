import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { RATINGS, type RatingType } from '../ratings';

type Props = {
  counts: Partial<Record<RatingType, { total: number; week: number }>> | null; // null = dono ocultou
  canRateAt: string | null; // vem de GET /users/:username
  onRate: (type: RatingType) => void;
  isOwnProfile?: boolean;
};

const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export function RatingButtons({ counts, canRateAt, onRate, isOwnProfile }: Props) {
  const locked = !!canRateAt && new Date(canRateAt) > new Date();
  const off = locked || isOwnProfile;

  return (
    <View>
      <View style={s.row}>
        {RATINGS.map((r) => (
          <Pressable
            key={r.type}
            disabled={off}
            onPress={() => onRate(r.type)}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}${counts ? `, ${counts[r.type]?.total ?? 0} votos` : ''}`}
            style={({ pressed }) => [s.btn, { borderColor: r.color }, off && s.off, pressed && s.pressed]}
          >
            <Text style={s.emoji}>{r.emoji}</Text>
            <Text style={s.label}>{r.label}</Text>
            {counts && <Text style={s.count}>{counts[r.type]?.total ?? 0}</Text>}
          </Pressable>
        ))}
      </View>
      {locked && <Text style={s.hint}>Você já avaliou este fã. Disponível em {daysLeft(canRateAt!)} dia(s).</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.card, borderWidth: 2, backgroundColor: colors.white },
  off: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.96 }] },
  emoji: { fontSize: 24 },
  label: { marginTop: 2, fontSize: 12, fontWeight: '700', color: colors.ink },
  count: { fontSize: 12, color: colors.muted },
  hint: { marginTop: 8, fontSize: 12, color: colors.muted },
});
