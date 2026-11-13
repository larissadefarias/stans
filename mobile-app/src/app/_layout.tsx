import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../auth';
import { RealtimeProvider } from '../realtime';
import { colors } from '../theme';

const back = { headerBackTitle: 'Voltar' };

export default function RootLayout() {
  return (
    <AuthProvider>
      <RealtimeProvider>
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
          <Stack.Screen name="forgot" options={{ title: 'Recuperar senha', ...back }} />
          <Stack.Screen name="reset" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="u/[username]/index" options={{ title: 'Perfil', ...back }} />
          <Stack.Screen name="u/[username]/follows" options={{ title: 'Seguidores', ...back }} />
          <Stack.Screen name="c/[id]" options={{ title: 'Comunidade', ...back }} />
          <Stack.Screen name="p/[id]" options={{ title: 'Comentários', ...back }} />
          <Stack.Screen name="chat/[roomId]" options={{ title: 'Chat', ...back }} />
          <Stack.Screen name="notifications" options={{ title: 'Notificações', ...back }} />
          <Stack.Screen name="new-community" options={{ title: 'Nova comunidade', ...back }} />
          <Stack.Screen name="settings" options={{ title: 'Editar perfil', ...back }} />
        </Stack>
      </RealtimeProvider>
    </AuthProvider>
  );
}
