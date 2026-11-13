import { Redirect, Tabs } from 'expo-router';
import { Image, type ColorValue, type ImageSourcePropType } from 'react-native';
import { useAuth } from '../../auth';
import { colors } from '../../theme';

const icon = (src: ImageSourcePropType) => ({ color, size }: { color: ColorValue; size: number }) => (
  <Image source={src} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />
);

export default function TabsLayout() {
  const { user, ready } = useAuth();
  if (ready && !user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.violet,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.babyBlue, height: 64, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        headerTintColor: colors.violet,
        headerTitleStyle: { fontWeight: '800', color: colors.ink },
        sceneStyle: { backgroundColor: colors.skyBg },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Início', tabBarIcon: icon(require('../../../assets/home.png')) }} />
      <Tabs.Screen name="communities" options={{ title: 'Comunidades', tabBarIcon: icon(require('../../../assets/comunidade.png')) }} />
      <Tabs.Screen name="me" options={{ title: 'Perfil', tabBarIcon: icon(require('../../../assets/perfil.png')) }} />
    </Tabs>
  );
}
