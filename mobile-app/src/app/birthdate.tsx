import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { api, ApiError, errorMessage } from '../api';
import { useAuth } from '../auth';
import { maskDate, toIsoDate } from '../birthdate';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { colors, font } from '../theme';

/** Contas criadas antes da regra de idade informam a data de nascimento uma vez. */
export default function BirthDate() {
  const { refreshMe, logout } = useAuth();
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tooYoung, setTooYoung] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const iso = toIsoDate(date);
    if (!iso) return setError('Use o formato DD/MM/AAAA.');
    setSaving(true);
    setError(null);
    try {
      await api.setBirthDate(iso);
      await refreshMe();
      router.replace('/feed');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'too_young') setTooYoung(true);
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={s.title}>Quando você nasceu?</Text>
        <Text style={s.text}>
          Para deixar o Stans seguro para todo mundo, precisamos saber sua idade. O Stans é para fãs a partir de 13 anos,
          e quem tem menos de 18 ganha proteções extras. Só você vê essa informação, e ela não pode ser trocada depois.
        </Text>
        <Field label="Data de nascimento" value={date} onChangeText={(t) => setDate(maskDate(t))}
          placeholder="DD/MM/AAAA" keyboardType="number-pad" maxLength={10} onSubmitEditing={save} />
        <ErrorText>{error}</ErrorText>
        {tooYoung
          ? <Button title="Sair" variant="ghost" onPress={async () => { await logout(); router.replace('/login'); }} />
          : <Button title="Continuar" onPress={save} loading={saving} />}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', fontFamily: font.title, color: colors.ink, marginBottom: 8 },
  text: { color: colors.muted, lineHeight: 20, marginBottom: 14 },
});
