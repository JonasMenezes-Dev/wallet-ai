import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PremiumAmbient } from "../../src/components/PremiumAmbient";
import { AppCard } from "../../src/components/AppCard";
import { AppField } from "../../src/components/AppField";
import { AppButton } from "../../src/components/AppButton";
import { AppText as Text } from "../../src/components/AppText";
import { useState } from "react";

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,

  View,
} from "react-native";

import { router } from "expo-router";

import { AnimatedBlock } from "../../src/components/AnimatedListItem";
import { useUserSettings } from "../../src/hooks/use-user-settings";
import { addAccount } from "../../src/services/account.service";
import {
  typography,
  ThemeColors,
  useThemeColors,
  useThemedStyles,
} from "../../src/theme";

export default function OnboardingScreen() {
  const { save } = useUserSettings();

  const [salary, setSalary] = useState("");
  const [benefitAmount, setBenefitAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  async function handleContinue() {
    const salaryValue = Number(salary.replace(/\./g, "").replace(",", "."));

    const benefitValue = Number(
      benefitAmount.replace(/\./g, "").replace(",", "."),
    );

    const balanceValue = Number(
      initialBalance.replace(/\./g, "").replace(",", "."),
    );

    if (!salaryValue || salaryValue < 0) {
      Alert.alert("Valor inválido", "Digite um salário válido.");
      return;
    }

    if (benefitValue < 0 || Number.isNaN(benefitValue)) {
      Alert.alert("Valor inválido", "Digite um valor de VA válido.");
      return;
    }

    if (!accountName.trim()) {
      Alert.alert("Conta obrigatória", "Digite o nome da sua conta principal.");
      return;
    }

    if (Number.isNaN(balanceValue) || balanceValue < 0) {
      Alert.alert("Valor inválido", "Digite um saldo inicial válido.");
      return;
    }

    try {
      setSaving(true);

      await save({
        salary: salaryValue,
        benefitAmount: benefitValue,
        onboardingCompleted: true,
      });

      await addAccount({
        name: accountName.trim(),
        type: "bank",
        balance: balanceValue,
        // A conta principal do onboarding é bancária: nunca tem limite.
        limitAmount: null,
      });

      router.replace("/");
    } catch (error) {
      console.error("Erro ao salvar onboarding:", error);

      Alert.alert(
        "Erro",
        "Não foi possível salvar seus dados. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={24}
    >
      <PremiumAmbient variant="subtle" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <AnimatedBlock>
          <Text variant="label" tone="primary">Bem-vindo</Text>

          <Text variant="title" style={styles.title}>Seu dinheiro,</Text>

          <Text style={styles.description}>
            no seu controle.
          </Text>

          <View style={styles.heroIcon}>
            <Image source={require("../../assets/premium/onboarding-wallet.svg")} tintColor={colors.primary} style={{ width: 66, height: 66 }} accessible={false} />
          </View>
          <View style={styles.introduction}>
            <Text style={styles.introductionTitle}>Organização sem complicação</Text>
            <Text tone="muted">Contas, gastos, metas e alertas em uma experiência só.</Text>
          </View>
          <AppCard style={styles.privacyCard}>
            <Image source={require("../../assets/premium/onboarding-shield.svg")} tintColor={colors.primary} style={{ width: 25, height: 25 }} accessible={false} />
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.privacyTitle}>Privacidade em primeiro lugar</Text>
              <Text variant="caption" tone="muted">Seus dados financeiros ficam no próprio dispositivo.</Text>
            </View>
          </AppCard>
          <View style={styles.form}>
            <Text variant="label" tone="muted">Configure seu primeiro acesso</Text>
            <View style={styles.field}>
              <AppField label="Salário mensal (R$)" style={styles.fieldInput}
                  value={salary}
                  onChangeText={setSalary}
                  placeholder="0,00"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="decimal-pad" />
            </View>

            <View style={styles.field}>
              <AppField label="VA / Benefícios (R$)" style={styles.fieldInput}
                  value={benefitAmount}
                  onChangeText={setBenefitAmount}
                  placeholder="0,00"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="decimal-pad" />

              <Text style={styles.helper}>
                Se você não recebe VA ou outro benefício, coloque 0.
              </Text>
            </View>

            <View style={styles.field}>
              <AppField label="Sua conta principal" style={styles.fieldInput}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Ex.: Nubank"
                placeholderTextColor={colors.textSubtle} />
            </View>

            <View style={styles.field}>
              <AppField label="Saldo atual da conta (R$)" style={styles.fieldInput}
                  value={initialBalance}
                  onChangeText={setInitialBalance}
                  placeholder="0,00"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="decimal-pad" />

              <Text style={styles.helper}>
                Quanto você tem disponível nessa conta hoje?
              </Text>
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={180}>
          <AppButton label={saving ? "Salvando..." : "Começar agora →"} onPress={handleContinue} loading={saving} style={styles.button} />
        </AnimatedBlock>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },

  heroIcon: { alignSelf: "center", marginTop: 36, marginBottom: 42, width: 162, height: 162, borderRadius: 45, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSurface },
  introduction: { marginHorizontal: 20, gap: 14, marginBottom: 40 },
  introductionTitle: { fontSize: 21, fontFamily: typography.family.bold, color: colors.text },
  privacyCard: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  privacyTitle: { fontSize: 15, fontFamily: typography.family.bold, color: colors.text },
  fieldInput: { fontSize: 16 },
  brand: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: typography.family.bold,
    color: colors.primary,
  },

  title: {
    marginTop: 18,
    fontSize: 29,
    fontWeight: "800",
    fontFamily: typography.family.bold,
    color: colors.text,
  },

  description: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },

  form: {
    marginTop: 32,
    marginBottom: 32,
    gap: 24,
  },

  field: {
    gap: 8,
  },

  label: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: typography.family.bold,
    color: colors.text,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  textInput: {
    minHeight: 58,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 17,
    color: colors.text,
  },

  prefix: {
    marginRight: 8,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: typography.family.bold,
    color: colors.textMuted,
  },

  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    fontFamily: typography.family.bold,
    color: colors.text,
  },

  helper: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSubtle,
  },

  button: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.primary,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: typography.family.bold,
    color: colors.onPrimary,
  },
});
