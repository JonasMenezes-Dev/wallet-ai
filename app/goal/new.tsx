import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput
} from "react-native";

import DateTimePicker from "@react-native-community/datetimepicker";

import { router } from "expo-router";

import { AnimatedBlock, FadeInView } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { addGoal } from "../../src/services/goal.service";
import {
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AnimatedPressable
          pressedScale={0.94}
          pressedOpacity={0.7}
          onPress={() => router.back()}
        >
          <Text style={styles.back}>← Voltar</Text>
        </AnimatedPressable>

        <AnimatedBlock delay={60}>
          <Text style={styles.title}>Nova meta</Text>

          <Text style={styles.subtitle}>
            Crie um objetivo para acompanhar seu progresso financeiro.
          </Text>
        </AnimatedBlock>

        <AnimatedBlock delay={120} style={styles.form}>
          <Text style={styles.label}>Nome da meta</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Celular Novo"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
          />

          <Text style={styles.label}>Valor da meta</Text>

          <TextInput
            value={targetAmount}
            onChangeText={setTargetAmount}
            placeholder="Ex.: 3.000,00"
            placeholderTextColor={colors.textSubtle}
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Quanto já tenho guardado?</Text>

          <TextInput
            value={currentAmount}
            onChangeText={setCurrentAmount}
            placeholder="Ex.: 500,00"
            placeholderTextColor={colors.textSubtle}
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Prazo</Text>

          <AnimatedPressable
            onPress={() => setShowDatePicker(true)}
            style={styles.input}
          >
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

          <AnimatedPressable
            style={styles.saveButton}
            pressedOpacity={0.85}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? "Salvando..." : "Criar meta"}
            </Text>
          </AnimatedPressable>
        </AnimatedBlock>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  back: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },

  title: {
    marginTop: 28,
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },

  form: {
    marginTop: 30,
    gap: 8,
  },

  label: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  input: {
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
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
    marginTop: 8,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  saveButton: {
    height: 56,
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.primary,
  },

  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  });
