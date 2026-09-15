import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { useUserSettings } from '../../src/hooks/use-user-settings';

export default function OnboardingScreen() {
  const { save } = useUserSettings();

  const [salary, setSalary] = useState('');
  const [benefitAmount, setBenefitAmount] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    const salaryValue = Number(
      salary.replace(/\./g, '').replace(',', '.')
    );

    const benefitValue = Number(
      benefitAmount.replace(/\./g, '').replace(',', '.')
    );

    if (!salaryValue || salaryValue < 0) {
      Alert.alert('Valor inválido', 'Digite um salário válido.');
      return;
    }

    if (benefitValue < 0 || Number.isNaN(benefitValue)) {
      Alert.alert('Valor inválido', 'Digite um valor de VA válido.');
      return;
    }

    try {
      setSaving(true);

      await save({
        salary: salaryValue,
        benefitAmount: benefitValue,
        onboardingCompleted: true,
      });

      router.replace('/');
    } catch (error) {
      console.error('Erro ao salvar onboarding:', error);

      Alert.alert(
        'Erro',
        'Não foi possível salvar seus dados. Tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View>
          <Text style={styles.brand}>Wallet.ai</Text>

          <Text style={styles.title}>
            Vamos começar.
          </Text>

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
                  placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.helper}>
                Se você não recebe VA ou outro benefício, coloque 0.
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            saving && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Salvando...' : 'Continuar'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 32,
  },

  brand: {
    fontSize: 18,
    fontWeight: '700',
    color: '#174EA6',
  },

  title: {
    marginTop: 42,
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
  },

  description: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    color: '#6B7280',
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
    fontWeight: '600',
    color: '#374151',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  prefix: {
    marginRight: 8,
    fontSize: 17,
    fontWeight: '600',
    color: '#6B7280',
  },

  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },

  helper: {
    fontSize: 13,
    lineHeight: 18,
    color: '#9CA3AF',
  },

  button: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#174EA6',
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});