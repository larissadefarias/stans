import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../auth';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.violet,
          headerTitleStyle: { fontWeight: '800', color: colors.ink },
          contentStyle: { backgroundColor: colors.skyBg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="u/[username]" options={{ title: 'Perfil', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="c/[id]" options={{ title: 'Comunidade', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="settings" options={{ title: 'Editar perfil' }} />
      </Stack>
    </AuthProvider>
  );
}
