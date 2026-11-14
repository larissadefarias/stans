import { Redirect, router, Tabs } from 'expo-router';
import { Image, Pressable, Text, View, type ColorValue, type ImageSourcePropType } from 'react-native';
import { useAuth } from '../../auth';
import { Badge, BellIcon } from '../../components/Badge';
import { useRealtime } from '../../realtime';
import { colors, font, isDark, setThemePref } from '../../theme';

const icon = (src: ImageSourcePropType, badge = 0) => ({ color, size }: { color: ColorValue; size: number }) => (
  <View>
    <Image source={src} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />
    <Badge count={badge} />
  </View>
);

export default function TabsLayout() {
  const { user, me, ready } = useAuth();
  const { unreadNotifications, unreadMessages } = useRealtime();
  if (ready && !user) return <Redirect href="/login" />;
  if (me?.needsBirthDate) return <Redirect href="/birthdate" />;

  const bell = () => (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={10} style={{ marginRight: 18 }}
      accessibilityLabel={`Notificações${unreadNotifications ? `, ${unreadNotifications} novas` : ''}`}>
      <BellIcon />
      <Badge count={unreadNotifications} />
    </Pressable>
  );

  const themeToggle = () => (
    <Pressable onPress={() => setThemePref(isDark ? 'light' : 'dark')} hitSlop={10} style={{ marginRight: 18 }}
      accessibilityRole="button" accessibilityLabel={isDark ? 'Usar modo claro' : 'Usar modo escuro'}>
      <Text style={{ fontSize: 20 }}>{isDark ? '☀️' : '🌙'}</Text>
    </Pressable>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.violet,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.babyBlue, height: 64, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        headerTintColor: colors.violet,
        headerTitleStyle: { fontWeight: '800', fontFamily: font.title, color: colors.ink },
        headerStyle: { backgroundColor: colors.surface },
        sceneStyle: { backgroundColor: colors.skyBg },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Início', headerRight: () => <View style={{ flexDirection: 'row', alignItems: 'center' }}>{themeToggle()}{bell()}</View>, tabBarIcon: icon(require('../../../assets/home.png')) }} />
      <Tabs.Screen name="communities" options={{ title: 'Comunidades', tabBarIcon: icon(require('../../../assets/comunidade.png')) }} />
      <Tabs.Screen name="messages" options={{ title: 'Mensagens', tabBarIcon: icon(require('../../../assets/mensagem.png'), unreadMessages) }} />
      <Tabs.Screen name="me" options={{ title: 'Perfil', headerRight: themeToggle, tabBarIcon: icon(require('../../../assets/perfil.png')) }} />
    </Tabs>
  );
}
