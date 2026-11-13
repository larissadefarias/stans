import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage, type Category } from '../api';
import { CATEGORIES } from '../categories';
import { Button, Card, ErrorText, Field } from '../components/ui';
import { colors, radius } from '../theme';

// "Fãs de Café & K-pop!" -> "fas-de-cafe-k-pop"
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function NewCommunity() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = slugify(name);

  const create = async () => {
    if (name.trim().length < 2) return setError('Dê um nome com pelo menos 2 letras.');
    if (slug.length < 3) return setError('O nome precisa ter pelo menos 3 letras ou números.');
    if (!category) return setError('Escolha uma categoria.');
    setSaving(true);
    setError(null);
    try {
      const { id } = await api.createCommunity({ slug, name: name.trim(), description: description.trim(), category });
      router.replace({ pathname: '/c/[id]', params: { id, name: name.trim() } });
    } catch (e) {
      setError(errorMessage(e).replace('nome de usuário ou e-mail', 'nome de comunidade'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Field label="Nome da comunidade" value={name} onChangeText={setName} maxLength={60} placeholder="ex.: Fãs de Isekai" />
        {!!slug && <Text style={s.hint}>Endereço: stans/{slug}</Text>}
        <Field label="Descrição" value={description} onChangeText={setDescription} maxLength={300} multiline
          placeholder="Sobre o que é a comunidade?" style={{ minHeight: 90, textAlignVertical: 'top' }} />
        <Text style={s.label}>Categoria</Text>
        <View style={s.chips}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.key} onPress={() => setCategory(c.key)} accessibilityRole="radio"
              accessibilityState={{ selected: category === c.key }} style={[s.chip, category === c.key && s.chipActive]}>
              <Text style={[s.chipText, category === c.key && { color: colors.white }]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Text style={s.hint}>Você será o dono(a) da comunidade e poderá apagar posts. Ela já vem com um chat próprio.</Text>
      <ErrorText>{error}</ErrorText>
      <Button title="Criar comunidade" onPress={create} loading={saving} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  hint: { fontSize: 12, color: colors.muted, marginTop: -6, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.skyBg, borderWidth: 1, borderColor: colors.babyBlue },
  chipActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
});
