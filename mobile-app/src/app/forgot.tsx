import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { api, errorMessage } from '../api';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { colors } from '../theme';

/**
 * Esqueci minha senha, em 2 passos:
 * 1) informa o e-mail -> o servidor gera um código (em desenvolvimento ele aparece no terminal do servidor)
 * 2) cola o código e escolhe a nova senha
 * O link /reset?token=... (aberto no navegador) cai direto no passo 2.
 */
export default function Forgot() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [step, setStep] = useState<1 | 2 | 3>(params.token ? 2 : 1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      setStep(2);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não são iguais.');
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword(token.trim(), password);
      setStep(3);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Card>
        {step === 1 && (
          <>
            <Text style={s.title}>Esqueci minha senha</Text>
            <Text style={s.text}>Informe o e-mail da sua conta. Vamos gerar um código para você criar uma senha nova.</Text>
            <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <ErrorText>{error}</ErrorText>
            <Button title="Enviar código" onPress={request} loading={loading} disabled={!email.includes('@')} />
            <Text style={[s.link, { marginTop: 14 }]} onPress={() => setStep(2)}>Já tenho um código</Text>
          </>
        )}
        {step === 2 && (
          <>
            <Text style={s.title}>Criar nova senha</Text>
            {!params.token && (
              <Text style={s.text}>
                Se o e-mail estiver cadastrado, o código foi gerado. Por enquanto ele aparece no terminal do servidor
                (linha "[DEV] Redefinição de senha"). Vale por 1 hora.
              </Text>
            )}
            {!params.token && <Field label="Código" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />}
            <Field label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="mínimo 8 caracteres" />
            <Field label="Repita a nova senha" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
            <ErrorText>{error}</ErrorText>
            <Button title="Salvar nova senha" onPress={reset} loading={loading} disabled={!token.trim() || !password} />
          </>
        )}
        {step === 3 && (
          <>
            <Text style={s.title}>Senha alterada ✓</Text>
            <Text style={s.text}>Agora é só entrar com a senha nova.</Text>
            <Button title="Ir para o login" onPress={() => router.replace('/login')} />
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  text: { color: colors.muted, marginBottom: 14, lineHeight: 20 },
  link: { textAlign: 'center', color: colors.violet, fontWeight: '700' },
});
