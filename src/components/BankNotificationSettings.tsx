import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Switch, View } from "react-native";

import { notificationCaptureSettings } from "../services/notification-import.service";
import type { CaptureSettingsSnapshot } from "../services/notification-capture-settings";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../theme";
import { AnimatedPressable } from "./AnimatedPressable";
import { AppCard } from "./AppCard";
import { AppText as Text } from "./AppText";
import { AppButton } from "./AppButton";
import { WalletSymbol } from "./WalletSymbol";
import { DevelopmentCaptureDiagnostics } from "./DevelopmentCaptureDiagnostics";

export function BankNotificationSettings() {
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const [supported, setSupported] = useState(notificationCaptureSettings.available);
  const [snapshot, setSnapshot] = useState<CaptureSettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(notificationCaptureSettings.available);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const writing = useRef(false);

  const refresh = useCallback(async () => {
    if (writing.current) return;
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const next = await notificationCaptureSettings.load();
      if (id !== request.current) return;
      setSupported(next !== null);
      setSnapshot(next);
    } catch {
      if (id !== request.current) return;
      setSnapshot(null);
      setError("Não foi possível consultar a configuração segura. Tente novamente.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => () => { request.current++; }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]));

  async function save(enabled: boolean, packages: string[]) {
    if (writing.current || loading || !snapshot) return;
    writing.current = true;
    const id = ++request.current;
    setSaving(true);
    setError(null);
    try {
      const saved = await notificationCaptureSettings.update(enabled, packages);
      if (id === request.current) setSnapshot(saved);
    } catch {
      if (id === request.current) {
        setSnapshot(null);
        setError("Não foi possível confirmar a gravação segura. Atualize antes de tentar novamente.");
      }
    } finally {
      writing.current = false;
      if (id === request.current) setSaving(false);
    }
  }

  function changeSelection(packageName: string) {
    if (!snapshot) return;
    const current = snapshot.authorization.authorizedPackages;
    const packages = current.includes(packageName)
      ? current.filter((pkg) => pkg !== packageName) : [...current, packageName];
    const allInstalled = packages.every((pkg) => snapshot.apps.some((app) => app.packageName === pkg));
    // Removing the last bank stops capture; selecting a bank never turns it on.
    void save(snapshot.authorization.enabled && snapshot.permissionGranted && packages.length > 0 && allInstalled, packages);
  }

  function openAndroidSettings() {
    try { notificationCaptureSettings.openAndroidSettings(); }
    catch { setError("Não foi possível abrir as configurações do Android."); }
  }

  const selected = snapshot?.authorization.authorizedPackages ?? [];
  const enabled = snapshot?.authorization.enabled ?? false;
  const unavailable = selected.filter((pkg) => !snapshot?.apps.some((app) => app.packageName === pkg));
  const canEnable = !!snapshot?.permissionGranted && selected.length > 0 && unavailable.length === 0;
  const busy = loading || saving;

  return (
    <AppCard style={styles.section} padded={false}>
      <Text style={styles.title}>Notificações bancárias</Text>
      <Text style={styles.description}>
        Escolha quais bancos podem enviar notificações para a captura segura do Wallet AI.
        Nenhuma transação é registrada automaticamente.
      </Text>

      {loading && (
        <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Consultando configuração de captura">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.description}>Consultando configuração…</Text>
        </View>
      )}

      {!supported && !loading && (
        <Text style={styles.description}>
          Este recurso requer uma instalação Android compatível do Wallet AI.
        </Text>
      )}

      {supported && (
        <>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.label}>Acesso no Android</Text>
              <Text style={styles.detail}>
                {loading ? "Verificando…" : snapshot ? (snapshot.permissionGranted ? "Concedido" : "Não concedido") : "Não foi possível consultar"}
              </Text>
            </View>
          </View>
          <AppButton style={styles.button} disabled={busy} variant="secondary"
            onPress={openAndroidSettings} label="Gerenciar acesso no Android" />
          <Text style={styles.detail}>Conceda ou revogue o acesso nas configurações do sistema.</Text>

          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.label}>Captura interna</Text>
              <Text style={styles.detail}>
                {loading ? "Verificando…" : !snapshot ? "Não foi possível consultar" : !enabled ? "Desativada"
                  : !snapshot.permissionGranted ? "Ativada · pausada sem acesso Android"
                    : unavailable.length === selected.length ? "Ativada · sem bancos disponíveis" : "Ativada"}
              </Text>
            </View>
            <Switch value={enabled} disabled={busy || !snapshot || (!enabled && !canEnable)}
              onValueChange={(value) => void save(value, selected)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.onPrimary} accessibilityLabel="Ativar captura de notificações bancárias" />
          </View>

          {snapshot && (
            <>
              {!enabled && !canEnable && <Text style={styles.detail}>Conceda o acesso Android e selecione um banco antes de ativar.</Text>}
              <Text style={styles.bankTitle}>Bancos instalados e compatíveis</Text>
              {snapshot.apps.length === 0 && <Text style={styles.detail}>Nenhum banco do catálogo compatível foi encontrado neste dispositivo.</Text>}
              {snapshot.apps.map((app) => {
                const checked = selected.includes(app.packageName);
                return (
                  <AnimatedPressable key={app.packageName} disabled={busy}
                    style={[styles.bank, checked && styles.bankSelected]}
                    accessibilityRole="checkbox" accessibilityLabel={app.name}
                    accessibilityState={{ checked, disabled: busy }} onPress={() => changeSelection(app.packageName)}>
                    <View style={styles.copy}>
                      <Text style={styles.label}>{app.name}</Text>
                      <Text style={styles.detail}>{app.packageName}</Text>
                    </View>
                    <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
                      {checked && <WalletSymbol name="success" size={18} color={colors.onPrimary} />}
                    </View>
                  </AnimatedPressable>
                );
              })}
              {unavailable.map((pkg) => (
                <AnimatedPressable key={pkg} disabled={busy} style={styles.bank}
                  accessibilityRole="button" accessibilityLabel={`Remover autorização de ${pkg}`}
                  accessibilityState={{ disabled: busy }} onPress={() => changeSelection(pkg)}>
                  <View style={styles.copy}>
                    <Text style={styles.label}>{pkg}</Text>
                    <Text style={styles.detail}>Autorizado anteriormente · indisponível</Text>
                  </View>
                  <Text style={styles.action}>Remover</Text>
                </AnimatedPressable>
              ))}
            </>
          )}
        </>
      )}

      {__DEV__ && snapshot && snapshot.apps.some((app) => app.packageName === "com.walletai.notificationfixture") && (
        <DevelopmentCaptureDiagnostics snapshot={snapshot} />
      )}
      {saving && <Text style={styles.detail} accessibilityLiveRegion="polite">Salvando autorização segura…</Text>}
      {error && (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.error}>{error}</Text>
          <AppButton style={styles.button} disabled={busy} onPress={() => void refresh()}
            label="Atualizar configuração" />
        </View>
      )}
    </AppCard>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { marginTop: 24, padding: 20 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  description: { marginTop: 6, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  row: { flexDirection: "row", alignItems: "center", marginTop: 24, marginBottom: 8 },
  copy: { flex: 1, marginRight: 12 },
  label: { fontSize: 15, fontWeight: "700", color: colors.text },
  detail: { marginTop: 4, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  loading: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  button: { marginTop: 8 },
  bankTitle: { marginTop: 20, fontSize: 15, fontWeight: "700", color: colors.text },
  bank: { minHeight: 68, flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 21, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 16 },
  bankSelected: { borderColor: colors.primary, backgroundColor: colors.accentSurface },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.textSubtle, alignItems: "center", justifyContent: "center" },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  action: { color: colors.text, fontSize: 12, fontWeight: "700" },
  error: { marginTop: 12, color: colors.expense, fontSize: 13, lineHeight: 19 },
});
