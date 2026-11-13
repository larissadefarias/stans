import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorMessage, type ReportTarget } from '../api';
import { colors, radius, font } from '../theme';
import { Button, ErrorText } from './ui';

export type Option = { label: string; onPress: () => void; destructive?: boolean };

/** Menu de opções que sobe de baixo (funciona igual no celular e no navegador). */
export function OptionsSheet({ visible, options, onClose }: { visible: boolean; options: Option[]; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Fechar menu" />
      <View style={s.sheet}>
        {options.map((o) => (
          <Pressable key={o.label} accessibilityRole="button" style={({ pressed }) => [s.option, pressed && { backgroundColor: colors.skyBg }]}
            onPress={() => { onClose(); o.onPress(); }}>
            <Text style={[s.optionText, o.destructive && { color: colors.danger }]}>{o.label}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" style={s.option} onPress={onClose}>
          <Text style={[s.optionText, { color: colors.muted }]}>Cancelar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const REASONS = ['Spam', 'Assédio ou ofensa', 'Spoiler sem aviso', 'Conteúdo impróprio', 'Outro'];

/** Denúncia: escolhe um motivo (e detalha, se quiser) e envia para a moderação. */
export function ReportSheet({ target, onClose }: { target: { type: ReportTarget; id: string } | null; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const close = () => { setReason(null); setDetails(''); setError(null); setSent(false); onClose(); };

  const send = async () => {
    if (!target || !reason) return;
    setSending(true);
    setError(null);
    try {
      await api.report(target.type, target.id, details.trim() ? `${reason}: ${details.trim()}` : reason);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close} accessibilityLabel="Fechar" />
      <View style={[s.sheet, { padding: 20 }]}>
        {sent ? (
          <>
            <Text style={s.title}>Denúncia enviada</Text>
            <Text style={s.text}>Obrigado por ajudar a manter o Stans seguro. A moderação vai analisar.</Text>
            <Button title="Fechar" onPress={close} />
          </>
        ) : (
          <>
            <Text style={s.title}>Denunciar</Text>
            <Text style={s.text}>Qual é o problema?</Text>
            <View style={s.chips}>
              {REASONS.map((r) => (
                <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: reason === r }}
                  style={[s.chip, reason === r && s.chipActive]}>
                  <Text style={[s.chipText, reason === r && { color: colors.white }]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={details} onChangeText={setDetails} maxLength={400} multiline placeholder="Detalhes (opcional)"
              placeholderTextColor={colors.muted} style={s.input} />
            <ErrorText>{error}</ErrorText>
            <Button title="Enviar denúncia" onPress={send} loading={sending} disabled={!reason} />
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,17,43,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingVertical: 8, paddingBottom: 24,
  },
  option: { paddingVertical: 16, paddingHorizontal: 24 },
  optionText: { fontSize: 16, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  title: { fontSize: 18, fontWeight: '800', fontFamily: font.title, color: colors.ink, marginBottom: 6 },
  text: { color: colors.muted, marginBottom: 12, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.skyBg, borderWidth: 1, borderColor: colors.babyBlue },
  chipActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  chipText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  input: {
    minHeight: 64, backgroundColor: colors.skyBg, borderRadius: 12, borderWidth: 1, borderColor: colors.babyBlue,
    padding: 12, fontSize: 15, color: colors.ink, textAlignVertical: 'top', marginBottom: 4,
  },
});
