import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { addGoal } from '../../src/services/goal.service';

export default function NewGoalScreen() {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  function parseMoney(value: string) {
    return Number(
      value
        .replace(/\./g, '')
        .replace(',', '.')
    );
  }

  async function handleSave() {
    const target = parseMoney(targetAmount);

    const current = currentAmount.trim()
      ? parseMoney(currentAmount)
      : 0;

    if (!name.trim()) {
      Alert.alert(
        'Nome obrigatório',
        'Digite um nome para sua meta.'
      );
      return;
    }

    if (
      Number.isNaN(target) ||
      target <= 0
    ) {
      Alert.alert(
        'Valor inválido',
        'Digite um valor-alvo válido.'
      );
      return;
    }

    if (
      Number.isNaN(current) ||
      current < 0
    ) {
      Alert.alert(
        'Valor inválido',
        'Digite um valor atual válido.'
      );
      return;
    }

    if (current > target) {
      Alert.alert(
        'Valor inválido',
        'O valor já guardado não pode ser maior que o objetivo.'
      );
      return;
    }

    try {
      setSaving(true);

      await addGoal({
        name: name.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline: deadline.trim() || null,
      });

      router.back();
    } catch (error) {
      console.error(
        'Erro ao criar meta:',
        error
      );

      Alert.alert(
        'Erro',
        'Não foi possível criar a meta.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
        >
          <Text style={styles.back}>
            ← Voltar
          </Text>
        </Pressable>

        <Text style={styles.title}>
          Nova meta
        </Text>

        <Text style={styles.subtitle}>
          Crie um objetivo para acompanhar
          seu progresso financeiro.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>
            Nome da meta
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Z Fold 6"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />

          <Text style={styles.label}>
            Valor da meta
          </Text>

          <TextInput
            value={targetAmount}
            onChangeText={setTargetAmount}
            placeholder="Ex.: 3.000,00"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <Text style={styles.label}>
            Quanto já tenho guardado?
          </Text>

          <TextInput
            value={currentAmount}
            onChangeText={setCurrentAmount}
            placeholder="Ex.: 500,00"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <Text style={styles.label}>
            Prazo
          </Text>

          <TextInput
            value={deadline}
            onChangeText={setDeadline}
            placeholder="Ex.: 31/12/2026"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />

          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving
                ? 'Salvando...'
                : 'Criar meta'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  back: {
    fontSize: 15,
    fontWeight: '600',
    color: '#174EA6',
  },

  title: {
    marginTop: 28,
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
  },

  form: {
    marginTop: 30,
    gap: 8,
  },

  label: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  input: {
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#111827',
  },

  saveButton: {
    height: 56,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#174EA6',
  },

  buttonPressed: {
    opacity: 0.8,
  },

  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});