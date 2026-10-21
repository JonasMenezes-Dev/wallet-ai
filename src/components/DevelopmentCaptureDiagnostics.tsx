import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { notificationCaptureSettings } from "../services/notification-import.service";
import type { CaptureSettingsSnapshot, DevelopmentCaptureDiagnostics as Counts } from "../services/notification-capture-settings";
import { useThemedStyles, type ThemeColors } from "../theme";
import { AppText as Text } from "./AppText";
import { AppButton } from "./AppButton";

export function DevelopmentCaptureDiagnostics({ snapshot }: { snapshot: CaptureSettingsSnapshot }) {
  const styles = useThemedStyles(createStyles);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    snapshot: CaptureSettingsSnapshot; revision: number; counts: Counts | null; failed: boolean;
  } | null>(null);
  const loading = !result || result.snapshot !== snapshot || result.revision !== revision;
  const counts = loading ? null : result.counts;
  const failed = !loading && result.failed;

  useEffect(() => {
    let active = true;
    void notificationCaptureSettings.loadDevelopmentDiagnostics().then((next) => {
      if (active) setResult({ snapshot, revision, counts: next, failed: false });
    }).catch(() => {
      if (active) setResult({ snapshot, revision, counts: null, failed: true });
    });
    return () => { active = false; };
  }, [snapshot, revision]);

  if (!loading && !counts && !failed) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Diagnóstico fictício · desenvolvimento</Text>
      <Text style={styles.detail}>Somente eventos do aplicativo de testes. Nenhum conteúdo de notificação é exibido.</Text>
      {loading ? <Text style={styles.detail}>Consultando contagens…</Text> : counts && (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.detail}>Total persistido: {Object.values(counts.states).reduce((sum, count) => sum + count, 0)}</Text>
          <Text style={styles.detail}>Recebidos: {counts.states.received} · Pendentes: {counts.states.pending}</Text>
          <Text style={styles.detail}>Confirmados: {counts.states.confirmed} · Ignorados: {counts.states.ignored} · Erros: {counts.states.error}</Text>
          <Text style={styles.detail}>Duplicações verificadas nesta sessão: {counts.duplicateChecks} · Falhas: {counts.duplicateFailures}</Text>
        </View>
      )}
      {failed && <Text style={styles.error}>Não foi possível consultar o diagnóstico.</Text>}
      <AppButton style={styles.button} disabled={loading} variant="secondary"
        onPress={() => setRevision((current) => current + 1)} label="Atualizar contagens" />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.border },
  title: { color: colors.text, fontSize: 14, fontWeight: "700" },
  detail: { marginTop: 6, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  error: { marginTop: 6, color: colors.expense, fontSize: 12 },
  button: { marginTop: 16 },
});
