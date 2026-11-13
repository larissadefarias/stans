import { router } from 'expo-router';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '../theme';

// Mesma regra do servidor: letras (com acento), números e _
const TAG_SPLIT = /(#[\p{L}\p{N}_]{1,30})/u;

export const openTag = (tag: string) =>
  router.push({ pathname: '/tag/[tag]', params: { tag: tag.replace(/^#/, '').toLowerCase() } });

/** Texto com as #hashtags em roxo e clicáveis (abrem a página da tag). */
export function RichText({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const parts = children.split(TAG_SPLIT);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ color: colors.violet, fontWeight: '700' }} onPress={() => openTag(part)}
            accessibilityRole="link">{part}</Text>
        ) : part,
      )}
    </Text>
  );
}
