import { Appearance } from 'react-native';

// Identidade do Stans: lilás + azul bebê/ciano, cards arredondados, clima de "Orkut moderno".
// O tema segue o modo claro/escuro do aparelho (lido quando o app abre).

const light = {
  violet: '#7C3AED',   // botões e links (texto branco tem bom contraste aqui)
  lilac: '#A78BFA',    // degradê, destaques
  cyan: '#22C5E8',     // degradê, ícones ativos
  babyBlue: '#BAE6FD', // bordas e fundos de seção
  skyBg: '#EFF8FF',    // fundo da página
  surface: '#FFFFFF',  // cards, barras, folhas
  ink: '#1E1B3A',      // texto
  pink: '#F472B6',     // curtida e alertas
  muted: '#6B7280',
  danger: '#B91C1C',
  spoiler: '#1E1B3A',  // tarja de spoiler
  white: '#FFFFFF',    // texto sobre roxo/degradê (igual nos dois modos)
  darkBg: '#14112B',
};

const dark: typeof light = {
  ...light,
  violet: '#8B5CF6',
  babyBlue: '#3B3470',
  skyBg: '#14112B',
  surface: '#221D45',
  ink: '#EDE9FE',
  muted: '#A5A3C4',
  danger: '#F87171',
  spoiler: '#0B0920',
};

export const isDark = Appearance.getColorScheme() === 'dark';
export const colors = isDark ? dark : light;

export const gradient = [colors.lilac, colors.cyan] as const; // use com expo-linear-gradient
export const radius = { card: 16, pill: 999 };
export const font = { title: 'Nunito_800ExtraBold', body: 'Inter_400Regular' }; // via @expo-google-fonts
