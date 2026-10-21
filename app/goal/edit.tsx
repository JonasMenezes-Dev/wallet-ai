import { Image } from "expo-image";
import { PremiumScreen } from "../../src/components/PremiumScreen";
import { AppField } from "../../src/components/AppField";
import { AppButton } from "../../src/components/AppButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "../../src/components/AppText";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";

import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";

import { AnimatedBlock, FadeInView } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { editGoal, loadGoal } from "../../src/services/goal.service";
import { typography, ThemeColors, useThemeColors, useThemedStyles } from "../../src/theme";

function parseMoney(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function formatMoneyInput(value: number) {
  return value.toFixed(2).replace(".", ",");
}

export default function EditGoalScreen() {
  const params = useLocalSearchParams<{
    id: string;
  }>();

  const goalId = Number(params.id);

  const [name, setName] = useState("");

  const [targetAmount, setTargetAmount] = useState("");

  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  function handleDeadlineChange(_event: unknown, date?: Date) {
    setShowDatePicker(false);
    if (date) setDeadline(date);
  }

  const [currentAmount, setCurrentAmount] = useState(0);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    async function load() {
      try {
        const goal = await loadGoal(goalId);

        if (!goal) {
          Alert.alert("Erro", "Meta não encontrada.");

          router.back();
          return;
        }

        setName(goal.name);

        setTargetAmount(formatMoneyInput(goal.targetAmount));

        setCurrentAmount(goal.currentAmount);

        if (goal.deadline) {
          const [year, month, day] = goal.deadline.split("-");

          setDeadline(new Date(Number(year), Number(month) - 1, Number(day)));
        }
      } catch (error) {
        console.error("Erro ao carregar meta:", error);

        Alert.alert("Erro", "Não foi possível carregar a meta.");

        router.back();
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [goalId]);

  async function handleSave() {
    const parsedTarget = parseMoney(targetAmount);

    if (!name.trim()) {
      Alert.alert("Nome obrigatório", "Digite um nome para sua meta.");
      return;
    }

    if (!parsedTarget || parsedTarget <= 0) {
      Alert.alert("Valor inválido", "Digite um valor de meta maior que zero.");
      return;
    }

    if (parsedTarget < currentAmount) {
      Alert.alert(
        "Valor inválido",
        `Sua meta já possui ${formatCurrency(
          currentAmount,
        )} guardados. O objetivo não pode ser menor que esse valor.`,
      );
      return;
    }

    let deadlineValue: string | null = null;

    if (deadline) {
      deadlineValue = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, "0")}-${String(deadline.getDate()).padStart(2, "0")}`;
    }

    try {
      setSaving(true);

      await editGoal(goalId, {
        name,
        targetAmount: parsedTarget,
        deadline: deadlineValue,
      });

      Alert.alert("Meta atualizada", "As alterações foram salvas.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error("Erro ao editar meta:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a meta.";

      Alert.alert("Erro", message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <FadeInView style={styles.center}>
        <Text>Carregando meta...</Text>
      </FadeInView>
    );
  }

  return (
    <PremiumScreen ambient="subtle">
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={24}
    >
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <AnimatedPressable
        pressedScale={0.94}
        pressedOpacity={0.7}
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Text style={styles.backText}>← Voltar</Text>
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
          placeholder="Ex.: Z Fold 5"
          style={styles.fieldInput} />

        <AppField label="Valor da meta" containerStyle={styles.field}
            value={targetAmount}
          onChangeText={setTargetAmount}
          placeholder="0,00"
          keyboardType="decimal-pad"
          style={styles.moneyFieldInput} />

        <View style={styles.savedBox}>
          <Text style={styles.savedLabel}>Já guardado</Text>

          <Text style={styles.savedValue}>{formatCurrency(currentAmount)}</Text>
        </View>

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

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: "transparent",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },

  backButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 12,
  },

  backText: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: typography.family.bold,
    color: colors.primary,
  },

  title: {
    fontSize: 29,
    fontWeight: "800",
    fontFamily: typography.family.bold,
    color: colors.text,
  },

  subtitle: {
    color: colors.textMuted,
    marginTop: 5,
  },

  form: {
    marginTop: 28,
  },

  label: {
    textTransform: "uppercase",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: typography.family.bold,
    marginBottom: 7,
    marginTop: 18,
    color: colors.text,
  },

  field: { marginTop: 20 },
  fieldInput: { fontSize: 16 },
  moneyFieldInput: { minHeight: 68, fontSize: 25, fontFamily: typography.family.bold, fontVariant: ["tabular-nums"] },
  dateInput: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 55 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 21,
    padding: 13,
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

  savedBox: {
    marginTop: 24,
    padding: 20,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },

  savedLabel: {
    fontSize: 11,
    fontFamily: typography.family.bold,
    textTransform: "uppercase",
    color: colors.textMuted,
  },

  savedValue: {
    fontWeight: "800",
    fontFamily: typography.family.bold,
    color: colors.primary,
    fontSize: 25,
    lineHeight: 34,
    fontVariant: ["tabular-nums"],
  },

  saveButton: {
    marginTop: 30,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
  },

  saveButtonDisabled: {
    opacity: 0.5,
  },

  saveButtonText: {
    color: colors.onPrimary,
    fontWeight: "800",
    fontFamily: typography.family.bold,
  },
  });
