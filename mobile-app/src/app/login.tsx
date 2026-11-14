import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { API_URL, errorMessage } from '../api';
import { useAuth } from '../auth';
import { maskDate, toIsoDate } from '../birthdate';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { colors, gradient, font } from '../theme';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birth, setBirth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isRegister = mode === 'register';

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        const iso = toIsoDate(birth);
        if (!iso) { setError('Informe sua data de nascimento no formato DD/MM/AAAA.'); return; }
        await register(username.trim().toLowerCase(), email.trim(), password, iso);
      }
      else await login(email.trim(), password);
      router.replace('/feed');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/logo.png')} style={s.logo} accessibilityLabel="Stans" />
          <Text style={s.tagline}>A rede social dos fandoms</Text>

          <Card>
            <Text style={s.title}>{isRegister ? 'Criar conta de fã' : 'Entrar'}</Text>
            {isRegister && (
              <Field label="Nome de usuário" value={username} onChangeText={setUsername}
                autoCapitalize="none" autoCorrect={false} placeholder="ex.: fa_de_kpop" />
            )}
            <Field label="E-mail" value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="voce@email.com" />
            <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder={isRegister ? 'mínimo 8 caracteres' : ''} onSubmitEditing={submit} />
            {isRegister && (
              <>
                <Field label="Data de nascimento" value={birth} onChangeText={(t) => setBirth(maskDate(t))}
                  placeholder="DD/MM/AAAA" keyboardType="number-pad" maxLength={10} onSubmitEditing={submit} />
                <Text style={s.hint}>O Stans é para fãs a partir de 13 anos. Só você vê sua data de nascimento.</Text>
              </>
            )}
            <ErrorText>{error}</ErrorText>
            <Button title={isRegister ? 'Cadastrar' : 'Entrar'} onPress={submit} loading={loading} />
            {!isRegister && (
              <Pressable onPress={() => router.push('/forgot')} style={{ marginTop: 14 }}>
                <Text style={s.switch}>Esqueci minha senha</Text>
              </Pressable>
            )}
            <Pressable onPress={() => { setMode(isRegister ? 'login' : 'register'); setError(null); }} style={{ marginTop: 14 }}>
              <Text style={s.switch}>
                {isRegister ? 'Já tenho conta — entrar' : 'Ainda não é fã? Criar conta'}
              </Text>
            </Pressable>
          </Card>

          {__DEV__ && <Text style={s.dev}>API: {API_URL}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginTop: -4, marginBottom: 8 },
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  logo: { width: 160, height: 80, resizeMode: 'contain', alignSelf: 'center' },
  tagline: { textAlign: 'center', color: colors.white, fontWeight: '700', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', fontFamily: font.title, color: colors.ink, marginBottom: 14 },
  switch: { textAlign: 'center', color: colors.violet, fontWeight: '700' },
  dev: { textAlign: 'center', color: colors.white, fontSize: 11, marginTop: 16, opacity: 0.85 },
});
