import { useState } from "react";

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { router } from "expo-router";

import { AnimatedBlock } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { useUserSettings } from "../../src/hooks/use-user-settings";
import { addAccount } from "../../src/services/account.service";
import {
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <AnimatedBlock>
          <Text style={styles.brand}>Wallet.ai</Text>

          <Text style={styles.title}>Vamos começar.</Text>

          <Text style={styles.description}>
            Primeiro, vamos entender quanto dinheiro entra no seu mês.
          </Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Salário mensal</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.prefix}>R$</Text>

                <TextInput
                  style={styles.input}
                  value={salary}
                  onChangeText={setSalary}
                  placeholder="0,00"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>VA / Benefícios</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.prefix}>R$</Text>

                <TextInput
                  style={styles.input}
                  value={benefitAmount}
                  onChangeText={setBenefitAmount}
                  placeholder="0,00"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.helper}>
                Se você não recebe VA ou outro benefício, coloque 0.
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Sua conta principal</Text>

              <TextInput
                style={styles.textInput}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Ex.: Nubank"
                placeholderTextColor={colors.textSubtle}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Saldo atual da conta</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.prefix}>R$</Text>

                <TextInput
                  style={styles.input}
                  value={initialBalance}
                  onChangeText={setInitialBalance}
                  placeholder="0,00"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.helper}>
                Quanto você tem disponível nessa conta hoje?
              </Text>
            </View>
          </View>
        </AnimatedBlock>

        <AnimatedBlock delay={180}>
          <AnimatedPressable
            style={[styles.button, saving && styles.buttonDisabled]}
            pressedOpacity={0.85}
            onPress={handleContinue}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving ? "Salvando..." : "Continuar"}
            </Text>
          </AnimatedPressable>
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
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 32,
  },

  brand: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },

  title: {
    marginTop: 42,
    fontSize: 36,
    fontWeight: "800",
    color: colors.text,
  },

  description: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },

  form: {
    marginTop: 48,
    gap: 24,
  },

  field: {
    gap: 8,
  },

  label: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 58,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  textInput: {
    height: 58,
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
    color: colors.textMuted,
  },

  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
  },

  helper: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSubtle,
  },

  button: {
    height: 58,
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
    color: colors.onPrimary,
  },
});
