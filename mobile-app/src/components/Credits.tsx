import { Linking, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

// Licença gratuita do Flaticon exige atribuição visível.
export function Credits() {
  return (
    <Text style={s.text} onPress={() => Linking.openURL('https://www.flaticon.com')}>
      Ícones: Flaticon
    </Text>
  );
}

const s = StyleSheet.create({
  text: { textAlign: 'center', fontSize: 11, color: colors.muted, marginVertical: 16 },
});
