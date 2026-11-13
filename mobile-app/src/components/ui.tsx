import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, gradient, radius, font } from '../theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Cabeçalho em degradê; com `imageUrl` (capa do perfil), a imagem fica por baixo de um degradê translúcido. */
export function GradientHeader({ children, imageUrl }: { children: ReactNode; imageUrl?: string | null }) {
  if (!imageUrl) {
    return (
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
        {children}
      </LinearGradient>
    );
  }
  return (
    <ImageBackground source={{ uri: imageUrl }} style={s.headerImage} resizeMode="cover">
      <LinearGradient colors={['rgba(124,58,237,0.15)', 'rgba(30,27,58,0.65)']} style={s.header}>
        {children}
      </LinearGradient>
    </ImageBackground>
  );
}

export function Button({ title, onPress, loading, variant = 'primary', disabled }: {
  title: string; onPress: () => void; loading?: boolean; variant?: 'primary' | 'ghost'; disabled?: boolean;
}) {
  const ghost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, ghost && s.btnGhost, (pressed || disabled) && { opacity: 0.7 }]}
    >
      {loading ? <ActivityIndicator color={ghost ? colors.violet : colors.white} />
        : <Text style={[s.btnText, ghost && { color: colors.violet }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...props} style={[s.input, props.style]} />
    </View>
  );
}

export function ErrorText({ children }: { children: string | null }) {
  return children ? <Text style={s.error}>{children}</Text> : null;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.card, padding: 16,
    borderWidth: 1, borderColor: colors.babyBlue,
    shadowColor: colors.violet, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  header: { paddingTop: 24, paddingBottom: 28, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerImage: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  btn: { backgroundColor: colors.violet, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.violet },
  btnText: { color: colors.white, fontWeight: '800', fontFamily: font.title, fontSize: 15 },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  input: {
    backgroundColor: colors.skyBg, borderRadius: 12, borderWidth: 1, borderColor: colors.babyBlue,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: colors.ink,
  },
  error: { color: colors.danger, marginVertical: 8, fontSize: 13 },
});
