// Identidade do Stans: lilás + azul bebê/ciano, cards arredondados, clima de "Orkut moderno".
export const colors = {
  violet: '#7C3AED',   // botões e links (texto branco tem bom contraste aqui)
  lilac: '#A78BFA',    // degradê, destaques
  cyan: '#22C5E8',     // degradê, ícones ativos
  babyBlue: '#BAE6FD', // cards e fundos de seção
  skyBg: '#EFF8FF',    // fundo da página
  ink: '#1E1B3A',      // texto
  pink: '#F472B6',     // curtida e alertas
  muted: '#6B7280',
  white: '#FFFFFF',
  darkBg: '#14112B',   // modo escuro
};

export const gradient = [colors.lilac, colors.cyan] as const; // use com expo-linear-gradient
export const radius = { card: 16, pill: 999 };
export const font = { title: 'Nunito_800ExtraBold', body: 'Inter_400Regular' }; // via @expo-google-fonts
