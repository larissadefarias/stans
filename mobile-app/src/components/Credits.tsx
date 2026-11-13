import { Linking, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

// Licença gratuita do Flaticon exige atribuição visível.
// TODO: troque pelos nomes dos autores de cada ícone (aparecem na página de download de cada um).
export function Credits() {
  return (
    <Text style={s.text} onPress={() => Linking.openURL('https://www.flaticon.com')}>
      Ícones de avaliação e navegação: Flaticon (flaticon.com)
    </Text>
  );
}

const s = StyleSheet.create({
  text: { textAlign: 'center', fontSize: 11, color: colors.muted, marginVertical: 16 },
});
