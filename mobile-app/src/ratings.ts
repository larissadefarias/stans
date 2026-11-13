import { colors } from './theme';

export type RatingType = 'superfan' | 'cool' | 'hot' | 'boring';

// Ícones do Flaticon em mobile-app/assets (crédito obrigatório: veja src/components/Credits.tsx). `emoji` fica como texto alternativo.
// Para trocar "Hot" por "Fire", altere só o `label` aqui; o `type` pode continuar o mesmo.
export const RATINGS: { type: RatingType; label: string; emoji: string; icon: number; color: string }[] = [
  { type: 'superfan', label: 'Superfan', emoji: '⭐', icon: require('../assets/superfan-icon.png'), color: colors.lilac },
  { type: 'cool', label: 'Cool', emoji: '😎', icon: require('../assets/cool-icon.png'), color: colors.cyan },
  { type: 'hot', label: 'Hot', emoji: '🔥', icon: require('../assets/hot-icon.png'), color: colors.pink },
  { type: 'boring', label: 'Boring', emoji: '😴', icon: require('../assets/boring-icon.png'), color: colors.muted },
];
