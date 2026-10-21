import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { AppText as Text } from "../src/components/AppText";
import { AppCard } from "../src/components/AppCard";
import { PremiumScreen } from "../src/components/PremiumScreen";
import { WalletSymbol } from "../src/components/WalletSymbol";
import { AnimatedListItem } from "../src/components/AnimatedListItem";
import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { getFinancialAlerts, type FinancialAlert } from "../src/services/alerts.service";
import { useThemeColors, useThemedStyles, spacing, radii, typography } from "../src/theme";

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
    <PremiumScreen ambient="subtle">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AnimatedPressable accessibilityRole="button" accessibilityLabel="Voltar" style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>‹  Voltar</Text></AnimatedPressable>
        <ScreenHeader title="Alertas financeiros" subtitle="O que merece sua atenção." eyebrow="Acompanhamento" />
        {loading ? <ActivityIndicator color={colors.primary} /> : alerts.length === 0 ? (
          <AppCard style={styles.emptyCard}>
            <View style={styles.statusIcon}><WalletSymbol name="success" color={colors.primary} size={22} /></View>
            <Text style={styles.emptyTitle}>Tudo sob controle</Text>
            <Text style={styles.helper}>Não encontramos orçamentos acima de 80% nem contas vencidas ou próximas do vencimento. Cadastre limites e contas recorrentes para acompanhar os alertas.</Text>
          </AppCard>
        ) : alerts.map((alert, index) => (
          <AnimatedListItem key={alert.id} index={index}><AppCard style={[styles.alertCard, alert.severity === "danger" ? styles.dangerCard : alert.severity === "warning" ? styles.warningCard : styles.infoCard]}>
            <WalletSymbol name={alert.kind === "budget" ? "budget" : "recurring"} color={alert.severity === "danger" ? colors.expense : alert.severity === "warning" ? colors.warning : colors.primary} size={23} />
            <Text style={styles.alertType}>{alert.kind === "budget" ? "ORÇAMENTO" : "VENCIMENTO"}</Text>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.helper}>{alert.description}</Text>
          </AppCard></AnimatedListItem>
        ))}
        <Text variant="label" tone="muted">Acompanhamento</Text>
        <AnimatedPressable accessibilityRole="button" accessibilityLabel="Gerenciar orçamentos" onPress={() => router.push("/budgets")}>
          <AppCard style={styles.navigationCard}>
            <WalletSymbol name="budget" color={colors.primary} size={23} />
            <View style={styles.navigationInfo}>
              <Text variant="subtitle">Orçamentos</Text>
              <Text tone="muted">Acompanhe os limites por categoria para evitar surpresas.</Text>
              <Text variant="caption" tone="primary">Gerenciar orçamentos →</Text>
            </View>
          </AppCard>
        </AnimatedPressable>
        <AnimatedPressable accessibilityRole="button" accessibilityLabel="Gerenciar contas recorrentes" onPress={() => router.push("/recurring")}>
          <AppCard style={styles.navigationCard}>
            <WalletSymbol name="recurring" color={colors.primary} size={23} />
            <View style={styles.navigationInfo}>
              <Text variant="subtitle">Contas recorrentes</Text>
              <Text tone="muted">Acompanhe os próximos vencimentos.</Text>
              <Text variant="caption" tone="primary">Gerenciar recorrências →</Text>
            </View>
          </AppCard>
        </AnimatedPressable>
      </ScrollView>
    </PremiumScreen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  content: { padding: spacing["2xl"], paddingBottom: spacing["4xl"], gap: spacing["2xl"] },
  statusIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accentSurface, alignItems: "center", justifyContent: "center" },
  navigationCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  navigationInfo: { flex: 1, gap: spacing.sm },
  backButton: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  backText: { color: colors.text, fontWeight: "700", fontFamily: typography.family.bold },
  emptyCard: { padding: spacing.xl, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "700", fontFamily: typography.family.bold },
  helper: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  alertCard: { padding: spacing.xl, borderRadius: radii.lg, borderWidth: 1, gap: spacing.xs },
  dangerCard: { backgroundColor: colors.surface, borderColor: colors.expense },
  warningCard: { backgroundColor: colors.surface, borderColor: colors.warning ?? colors.primary },
  infoCard: { backgroundColor: colors.surface, borderColor: colors.border },
  alertType: { color: colors.textMuted, fontSize: 10, fontWeight: "700", fontFamily: typography.family.bold, letterSpacing: 1 },
  alertTitle: { color: colors.text, fontSize: 15, fontWeight: "700", fontFamily: typography.family.bold },
});
