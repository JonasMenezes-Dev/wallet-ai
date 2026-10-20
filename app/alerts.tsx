import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { getFinancialAlerts, type FinancialAlert } from "../src/services/alerts.service";
import { useThemeColors, useThemedStyles, spacing, radii } from "../src/theme";

export default function AlertsScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [alerts, setAlerts] = useState<FinancialAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setAlerts(await getFinancialAlerts()); }
    catch (error) { console.error("Erro ao calcular alertas:", error); setAlerts([]); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AnimatedPressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>‹  Voltar</Text></AnimatedPressable>
        <ScreenHeader title="Alertas financeiros" subtitle="Acompanhe contas próximas do vencimento e limites de gastos." eyebrow="Fique no controle" />
        {loading ? <ActivityIndicator color={colors.primary} /> : alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Tudo tranquilo por enquanto</Text>
            <Text style={styles.helper}>Não encontramos orçamentos acima de 80% nem contas vencidas ou próximas do vencimento. Cadastre limites e contas recorrentes para acompanhar os alertas.</Text>
          </View>
        ) : alerts.map((alert) => (
          <View key={alert.id} style={[styles.alertCard, alert.severity === "danger" ? styles.dangerCard : alert.severity === "warning" ? styles.warningCard : styles.infoCard]}>
            <Text style={styles.alertType}>{alert.kind === "budget" ? "ORÇAMENTO" : "VENCIMENTO"}</Text>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.helper}>{alert.description}</Text>
          </View>
        ))}
        <AnimatedPressable style={styles.actionButton} onPress={() => router.push("/budgets")}><Text style={styles.actionText}>Gerenciar orçamentos</Text></AnimatedPressable>
        <AnimatedPressable style={styles.secondaryButton} onPress={() => router.push("/recurring")}><Text style={styles.secondaryText}>Gerenciar contas recorrentes</Text></AnimatedPressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing["4xl"], gap: spacing.md },
  backButton: { alignSelf: "flex-start", padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  backText: { color: colors.text, fontWeight: "700" },
  emptyCard: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  helper: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  alertCard: { padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, gap: spacing.xs },
  dangerCard: { backgroundColor: colors.surface, borderColor: colors.expense },
  warningCard: { backgroundColor: colors.surface, borderColor: colors.warning ?? colors.primary },
  infoCard: { backgroundColor: colors.surface, borderColor: colors.border },
  alertType: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  alertTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  actionButton: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center" },
  actionText: { color: colors.onPrimary, fontWeight: "800" },
  secondaryButton: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: "center" },
  secondaryText: { color: colors.text, fontWeight: "700" },
});
