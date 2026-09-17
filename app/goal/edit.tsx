import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";

import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";

import { AnimatedBlock, FadeInView } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { editGoal, loadGoal } from "../../src/services/goal.service";
import { ThemeColors, useThemedStyles } from "../../src/theme";

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
  const styles = useThemedStyles(createStyles);

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
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
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
        <Text style={styles.title}>Editar meta</Text>

        <Text style={styles.subtitle}>Ajuste os detalhes da sua meta.</Text>
      </AnimatedBlock>

      <AnimatedBlock delay={120} style={styles.form}>
        <Text style={styles.label}>Nome da meta</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ex.: Z Fold 5"
          style={styles.input}
        />

        <Text style={styles.label}>Valor da meta</Text>

        <TextInput
          value={targetAmount}
          onChangeText={setTargetAmount}
          placeholder="0,00"
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <View style={styles.savedBox}>
          <Text style={styles.savedLabel}>Já guardado</Text>

          <Text style={styles.savedValue}>{formatCurrency(currentAmount)}</Text>
        </View>

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
          pressedOpacity={0.85}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          disabled={saving}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Text>
        </AnimatedPressable>
      </AnimatedBlock>
    </ScrollView>
  );
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  backButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },

  backText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
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
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 7,
    marginTop: 18,
    color: colors.text,
  },

  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
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
    marginTop: 8,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  savedBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  savedLabel: {
    color: colors.textMuted,
  },

  savedValue: {
    fontWeight: "800",
    color: colors.text,
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
  },
  });
