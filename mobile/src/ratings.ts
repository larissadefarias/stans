import { colors } from './theme';

export type RatingType = 'superfan' | 'cool' | 'hot' | 'boring';

// Troque `emoji` pelos SVGs do Flaticon quando baixá-los (e mantenha os créditos no app e no README).
// Para trocar "Hot" por "Fire", altere só o `label` aqui; o `type` pode continuar o mesmo.
export const RATINGS: { type: RatingType; label: string; emoji: string; color: string }[] = [
  { type: 'superfan', label: 'Superfan', emoji: '⭐', color: colors.lilac },
  { type: 'cool', label: 'Cool', emoji: '😎', color: colors.cyan },
  { type: 'hot', label: 'Hot', emoji: '🔥', color: colors.pink },
  { type: 'boring', label: 'Boring', emoji: '😴', color: colors.muted },
];
