import { Image, Text, View, type ViewStyle } from 'react-native';
import { mediaUrl } from '../api';
import { colors, font } from '../theme';

type Props = { url: string | null | undefined; name: string; size?: number; style?: ViewStyle };

/** Foto do fã; sem foto, mostra a inicial do nome num círculo azul bebê. */
export function Avatar({ url, name, size = 40, style }: Props) {
  const src = mediaUrl(url);
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[box, { backgroundColor: colors.babyBlue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {src ? (
        <Image source={{ uri: src }} style={box} accessibilityLabel={`Foto de ${name}`} />
      ) : (
        <Text style={{ fontWeight: '800', fontFamily: font.title, color: colors.violet, fontSize: size * 0.42 }}>{name.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}
