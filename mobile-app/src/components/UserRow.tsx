import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { UserSummary } from '../api';
import { colors, font } from '../theme';
import { Avatar } from './Avatar';

/** Linha com foto, nome e @ do fã; toque abre o perfil. `right` permite um botão extra (ex.: Desbloquear). */
export function UserRow({ user, right }: { user: UserSummary; right?: React.ReactNode }) {
  return (
    <View style={s.row}>
      <Pressable style={s.main} onPress={() => router.push(`/u/${user.username}`)} accessibilityRole="link">
        <Avatar url={user.avatarUrl} name={user.displayName || user.username} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{user.displayName || user.username}</Text>
          <Text style={s.handle}>@{user.username}</Text>
        </View>
      </Pressable>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontWeight: '800', fontFamily: font.title, color: colors.ink },
  handle: { color: colors.muted, fontSize: 13 },
});
