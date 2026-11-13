import { Redirect, useLocalSearchParams } from 'expo-router';

// Link do terminal/e-mail: /reset?token=... -> tela "Esqueci minha senha" já no passo da nova senha
export default function Reset() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return <Redirect href={{ pathname: '/forgot', params: token ? { token } : {} }} />;
}
