import { useEffect, useState } from 'react';

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { AnimatedBlock } from '../../src/components/AnimatedListItem';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';

import { listAccounts } from '../../src/services/account.service';
import {
  listCategories,
  suggestCategoryId,
} from '../../src/services/category.service';
import { addTransaction } from '../../src/services/transaction.service';

import { Account } from '../../src/types/account';
import { Category } from '../../src/types/category';
import { TransactionType } from '../../src/types/transaction';
import { ThemeColors, useThemedStyles, useThemeColors } from '../../src/theme';


export default function NewTransactionScreen() {
  const [type, setType] = useState<TransactionType>('expense');

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null
  );

  const [saving, setSaving] = useState(false);
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();

  useEffect(() => {
    async function loadData() {
      try {
        const [categoriesData, accountsData] = await Promise.all([
          listCategories(),
          listAccounts(),
        ]);

        setCategories(categoriesData);
        setAccounts(accountsData);

        if (categoriesData.length > 0) {
          setSelectedCategoryId(categoriesData[0].id);
        }

        if (accountsData.length > 0) {
          setSelectedAccountId(accountsData[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar dados da transação:', error);

        Alert.alert(
          'Erro',
          'Não foi possível carregar categorias e contas.'
        );
      }
    }

    loadData();
  }, []);

  async function handleSave() {
    const amountValue = Number(
      amount.replace(/\./g, '').replace(',', '.')
    );

    if (!amountValue || amountValue <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
      return;
    }

    if (!selectedAccountId) {
      Alert.alert('Conta obrigatória', 'Selecione uma conta.');
      return;
    }

    if (!selectedCategoryId) {
      Alert.alert('Categoria obrigatória', 'Selecione uma categoria.');
      return;
    }

    try {
      setSaving(true);

      await addTransaction({
        amount: amountValue,
        type,
        description: description.trim() || null,
        merchant: null,
        date: new Date().toISOString(),
        categoryId:
          type === 'expense'
            ? suggestCategoryId(description, categories, selectedCategoryId)
            : selectedCategoryId,
        accountId: selectedAccountId,
        paymentMethod: null,
        goalId: null,
        isAutomatic: false,
        source: 'manual',
        externalId: null,
        provider: null,
        institution: null,
      });

      Alert.alert(
        'Transação salva',
        'A transação foi registrada com sucesso.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao salvar transação:', error);

      Alert.alert(
        'Erro',
        'Não foi possível salvar a transação.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={24}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <AnimatedBlock>
        <Text style={styles.title}>Nova transação</Text>

        <Text style={styles.subtitle}>
          Registre uma entrada ou saída de dinheiro.
        </Text>
      </AnimatedBlock>

      <AnimatedBlock delay={60} style={styles.typeSelector}>
        <AnimatedPressable
          pressedScale={0.96}
          style={[
            styles.typeButton,
            type === 'expense' && styles.typeButtonActive,
          ]}
          onPress={() => setType('expense')}
        >
          <Text
            style={[
              styles.typeButtonText,
              type === 'expense' && styles.typeButtonTextActive,
            ]}
          >
            Despesa
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          pressedScale={0.96}
          style={[
            styles.typeButton,
            type === 'income' && styles.typeButtonActive,
          ]}
          onPress={() => setType('income')}
        >
          <Text
            style={[
              styles.typeButtonText,
              type === 'income' && styles.typeButtonTextActive,
            ]}
          >
            Receita
          </Text>
        </AnimatedPressable>
      </AnimatedBlock>

      <View style={styles.field}>
        <Text style={styles.label}>Valor</Text>

        <View style={styles.moneyInput}>
          <Text style={styles.prefix}>R$</Text>

          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0,00"
            placeholderTextColor={colors.textSubtle}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Descrição</Text>

        <TextInput
          style={styles.textInput}
          value={description}
          onChangeText={setDescription}
          placeholder="Ex.: Almoço"
          placeholderTextColor={colors.textSubtle}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Categoria</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.options}
        >
          {categories.map((category) => (
            <AnimatedPressable
              key={category.id}
              pressedScale={0.94}
              style={[
                styles.option,
                selectedCategoryId === category.id && styles.optionActive,
              ]}
              onPress={() => setSelectedCategoryId(category.id)}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedCategoryId === category.id &&
                    styles.optionTextActive,
                ]}
              >
                {category.name}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Conta</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.options}
        >
          {accounts.map((account) => (
            <AnimatedPressable
              key={account.id}
              pressedScale={0.94}
              style={[
                styles.option,
                selectedAccountId === account.id && styles.optionActive,
              ]}
              onPress={() => setSelectedAccountId(account.id)}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedAccountId === account.id &&
                    styles.optionTextActive,
                ]}
              >
                {account.name}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>

      <AnimatedPressable
        style={[
          styles.saveButton,
          saving && styles.saveButtonDisabled,
        ]}
        pressedOpacity={0.85}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Salvando...' : 'Salvar transação'}
        </Text>
      </AnimatedPressable>
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
    padding: 24,
    paddingTop: 70,
    paddingBottom: 40,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: colors.textMuted,
  },

  typeSelector: {
    flexDirection: 'row',
    marginTop: 32,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },

  typeButton: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },

  typeButtonActive: {
    backgroundColor: colors.primary,
  },

  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },

  typeButtonTextActive: {
    color: colors.onPrimary,
  },

  field: {
    marginTop: 24,
  },

  label: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  moneyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  prefix: {
    marginRight: 8,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textMuted,
  },

  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },

  textInput: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.text,
  },

  options: {
    gap: 10,
    paddingVertical: 2,
  },

  option: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  optionTextActive: {
    color: colors.onPrimary,
  },

  saveButton: {
    height: 58,
    marginTop: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.primary,
  },

  saveButtonDisabled: {
    opacity: 0.5,
  },

  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});