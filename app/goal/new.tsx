import { Image } from "expo-image";
import { PremiumScreen } from "../../src/components/PremiumScreen";
import { AppField } from "../../src/components/AppField";
import { AppButton } from "../../src/components/AppButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "../../src/components/AppText";
import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
} from "react-native";

import DateTimePicker from "@react-native-community/datetimepicker";

import { router } from "expo-router";

import { AnimatedBlock, FadeInView } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { addGoal } from "../../src/services/goal.service";
import {
    typography,
  ThemeColors,
    useThemeColors,
    useThemedStyles,
} from "../../src/theme";

export default function NewGoalScreen() {
  const colors = useThemeColors();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  function handleDeadlineChange(_event: unknown, date?: Date) {
    setShowDatePicker(false);
    if (date) setDeadline(date);
  }

  function parseMoney(value: string) {
    return Number(value.replace(/\./g, "").replace(",", "."));
  }

  function formatDeadline(value: Date | null): string | null {
    if (!value) {
      return null;
    }

    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  async function handleSave() {
    const target = parseMoney(targetAmount);

    const current = currentAmount.trim() ? parseMoney(currentAmount) : 0;

    if (!name.trim()) {
      Alert.alert("Nome obrigatório", "Digite um nome para sua meta.");
      return;
    }

    if (Number.isNaN(target) || target <= 0) {
      Alert.alert("Valor inválido", "Digite um valor-alvo válido.");
      return;
    }

    if (Number.isNaN(current) || current < 0) {
      Alert.alert("Valor inválido", "Digite um valor atual válido.");
      return;
    }

    if (current > target) {
      Alert.alert(
        "Valor inválido",
        "O valor já guardado não pode ser maior que o objetivo.",
      );
      return;
    }

    try {
      setSaving(true);

      await addGoal({
        name: name.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline: formatDeadline(deadline),
      });

      router.back();
    } catch (error) {
      console.error("Erro ao criar meta:", error);

      Alert.alert("Erro", "Não foi possível criar a meta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumScreen ambient="subtle">
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={24}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <AnimatedPressable
          pressedScale={0.94}
          pressedOpacity={0.7}
          onPress={() => router.back()}
          style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
        >
          <Text style={styles.back}>← Voltar</Text>
        </AnimatedPressable>

        <AnimatedBlock delay={60}>
          <ScreenHeader
            title="Planejar meta"
            subtitle="Defina seu objetivo financeiro"
            eyebrow="Objetivos"
          />
        </AnimatedBlock>

        <AnimatedBlock delay={120} style={styles.form}>
          <AppField label="Nome da meta" containerStyle={styles.field}
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Celular Novo"
            placeholderTextColor={colors.textSubtle}
            style={styles.fieldInput} />

          <AppField label="Valor da meta" containerStyle={styles.field}
            value={targetAmount}
            onChangeText={setTargetAmount}
            placeholder="Ex.: 3.000,00"
            placeholderTextColor={colors.textSubtle}
            keyboardType="decimal-pad"
            style={styles.moneyFieldInput} />

          <AppField label="Quanto já tenho guardado?" containerStyle={styles.field}
            value={currentAmount}
            onChangeText={setCurrentAmount}
            placeholder="Ex.: 500,00"
            placeholderTextColor={colors.textSubtle}
            keyboardType="decimal-pad"
            style={styles.moneyFieldInput} />

          <Text style={styles.label}>Prazo</Text>

          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Definir prazo da meta"
            onPress={() => setShowDatePicker(true)}
            style={[styles.input, styles.dateInput]}
          >
            <Image source={require("../../assets/premium/goalform-calendar.svg")} tintColor={colors.primary} style={{ width: 20, height: 20 }} accessible={false} />
            <Text style={deadline ? styles.dateText : styles.placeholderText}>
              {deadline
                ? deadline.toLocaleDateString("pt-BR")
                : "Selecionar data"}
            </Text>
          </AnimatedPressable>

          {deadline && (
            <FadeInView>
              <AnimatedPressable
                pressedScale={0.94}
                pressedOpacity={0.7}
                onPress={() => setDeadline(null)}
              >
                <Text style={styles.clearDate}>Remover prazo</Text>
              </AnimatedPressable>
            </FadeInView>
          )}

          {showDatePicker && (
            <DateTimePicker
              value={deadline ?? new Date()}
              mode="date"
              display="calendar"
              minimumDate={new Date()}
              onChange={handleDeadlineChange}
              onDismiss={() => setShowDatePicker(false)}
            />
          )}

          <AppButton label={saving ? "Salvando..." : "Salvar objetivo"} onPress={handleSave} loading={saving} style={styles.saveButton} />
        </AnimatedBlock>
      </ScrollView>
    </KeyboardAvoidingView>
    </PremiumScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },

  back: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: typography.family.bold,
    color: colors.primary,
  },

  title: {
    marginTop: 28,
    fontSize: 29,
    fontWeight: "800",
    fontFamily: typography.family.bold,
    color: colors.text,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },

  form: {
    marginTop: 24,
    gap: 8,
  },

  label: {
    textTransform: "uppercase",
    marginTop: 12,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: typography.family.bold,
    color: colors.text,
  },

  field: { marginTop: 20 },
  fieldInput: { fontSize: 16 },
  moneyFieldInput: { minHeight: 68, fontSize: 25, fontFamily: typography.family.bold, fontVariant: ["tabular-nums"] },
  dateInput: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 55 },
  input: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.text,
  },

  dateText: {
    fontSize: 16,
    color: colors.text,
  },

  placeholderText: {
    fontSize: 16,
    color: colors.textSubtle,
  },

  clearDate: {
    minHeight: 44,
    paddingVertical: 12,
    marginTop: 8,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: typography.family.bold,
  },

  saveButton: {
    minHeight: 56,
    marginTop: 24,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.primary,
  },

  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: typography.family.bold,
    color: colors.onPrimary,
  },
  });
