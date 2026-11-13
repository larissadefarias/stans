import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, font } from '../theme';

/** Bolinha rosa com o número de itens não lidos (some quando é 0). */
export function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={s.badge} accessibilityLabel={`${count} não lidas`}>
      <Text style={s.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

/** Ícone de sino desenhado em SVG (aceita qualquer cor). */
export function BellIcon({ color = colors.violet, size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface,
  },
  text: { color: colors.white, fontSize: 10, fontWeight: '800', fontFamily: font.title },
});
