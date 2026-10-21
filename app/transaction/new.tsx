import { useEffect, useState } from 'react';

import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { AnimatedBlock } from '../../src/components/AnimatedListItem';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { AppText as Text } from '../../src/components/AppText';
import { AppField } from '../../src/components/AppField';
import { AppSelector } from '../../src/components/AppSelector';
import { AppButton } from '../../src/components/AppButton';
import { PremiumScreen } from '../../src/components/PremiumScreen';
import { WalletSymbol } from '../../src/components/WalletSymbol';

import { listAccounts } from '../../src/services/account.service';
import {
  listCategories,
  suggestCategoryId,
} from '../../src/services/category.service';
import { addTransaction, transferBetweenAccounts } from '../../src/services/transaction.service';
import { selectTransferAccounts } from '../../src/services/transfer-selection';

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
  const [selectedDestinationAccountId, setSelectedDestinationAccountId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const transferAccounts = selectTransferAccounts(accounts, selectedAccountId, selectedDestinationAccountId);
  const sourceAccountId = type === 'transfer' ? transferAccounts.fromAccountId : selectedAccountId;
  const destinationAccountId = transferAccounts.toAccountId;

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
          setSelectedDestinationAccountId(accountsData.find((account) => account.id !== accountsData[0].id && account.type !== 'credit_card')?.id ?? null);
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
    if (saving) return;
    const amountValue = Number(
      amount.replace(/\./g, '').replace(',', '.')
    );

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
      return;
    }

    if (!sourceAccountId) {
      Alert.alert('Conta obrigatória', 'Selecione uma conta.');
      return;
    }

    if (type !== 'transfer' && !selectedCategoryId) {
      Alert.alert('Categoria obrigatória', 'Selecione uma categoria.');
      return;
    }
    if (type === 'transfer' && !destinationAccountId) {
      Alert.alert('Destino obrigatório', 'Selecione uma conta de destino diferente da origem.');
      return;
    }

    try {
      setSaving(true);

      if (type === 'transfer') {
        await transferBetweenAccounts({
          amount: amountValue,
          fromAccountId: sourceAccountId,
          toAccountId: destinationAccountId!,
          description: description.trim() || null,
          date: new Date().toISOString(),
        });
      } else {
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
        accountId: sourceAccountId,
        paymentMethod: null,
        goalId: null,
        isAutomatic: false,
        source: 'manual',
        externalId: null,
        provider: null,
        institution: null,
      });
      }

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
        error instanceof Error ? error.message : 'Não foi possível salvar a transação.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumScreen ambient="subtle">
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
        <ScreenHeader
          title="Nova transação"
          subtitle="Registre entradas, saídas ou transferências entre contas."
          eyebrow="Movimentação"
        />
      </AnimatedBlock>

      <AnimatedBlock delay={60} style={styles.typeSelector}>
        <AppSelector<TransactionType> accessibilityLabel="Tipo de movimentação" value={type} onChange={setType}
          options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }, { value: 'transfer', label: 'Transferir' }]} />
      </AnimatedBlock>

      <View style={styles.field}>
        <Text style={styles.label}>Valor</Text>

        <View style={styles.moneyInput}>
          <Text style={styles.prefix}>R$</Text>

          <TextInput
            accessibilityLabel="Valor da transação"
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0,00"
            placeholderTextColor={colors.textSubtle}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <AppField label="Descrição" containerStyle={styles.field} value={description}
        onChangeText={setDescription} placeholder="Ex.: Almoço" />

      {type !== 'transfer' && <View style={styles.field}>
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
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedCategoryId === category.id }}
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
      </View>}

      <View style={styles.field}>
        <Text style={styles.label}>{type === 'transfer' ? 'Conta de origem' : 'Conta ou cartão'}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.options}
        >
          {accounts.filter((account) => type !== 'transfer' || account.type !== 'credit_card').map((account) => {
            const isCard = account.type === 'credit_card';

            return (
              <AnimatedPressable
                key={account.id}
                pressedScale={0.94}
                accessibilityRole="radio"
                accessibilityState={{ checked: sourceAccountId === account.id }}
                style={[
                  styles.option,
                  sourceAccountId === account.id && styles.optionActive,
                ]}
                onPress={() => setSelectedAccountId(account.id)}
              >
                {isCard && <WalletSymbol name="card" size={18} color={sourceAccountId === account.id ? colors.onPrimary : colors.textMuted} />}
                <Text
                  style={[
                    styles.optionText,
                    sourceAccountId === account.id &&
                      styles.optionTextActive,
                  ]}
                >
                  {account.name}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>

      {type === 'transfer' && <View style={styles.field}>
        <Text style={styles.label}>Conta de destino</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
          {accounts.filter((account) => account.type !== 'credit_card' && account.id !== sourceAccountId).map((account) => (
            <AnimatedPressable
              key={account.id}
              pressedScale={0.94}
              accessibilityRole="radio"
              accessibilityState={{ checked: destinationAccountId === account.id }}
              style={[styles.option, destinationAccountId === account.id && styles.optionActive]}
              onPress={() => setSelectedDestinationAccountId(account.id)}
            >
              <Text style={[styles.optionText, destinationAccountId === account.id && styles.optionTextActive]}>
                {account.name}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
        <Text style={styles.label}>A transferência não pode envolver cartão de crédito.</Text>
        {!destinationAccountId && <Text style={styles.label}>Cadastre pelo menos duas contas sem cartão de crédito para transferir.</Text>}
      </View>}

      <AppButton style={styles.saveButton} onPress={handleSave} loading={saving}
        disabled={saving || (type === 'transfer' && !destinationAccountId)}
        label={saving ? 'Salvando...' : type === 'transfer' ? 'Confirmar transferência' : 'Salvar transação'} />
      </ScrollView>
    </KeyboardAvoidingView>
    </PremiumScreen>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
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
    marginTop: 24,
  },

  typeButton: {
    flex: 1,
    minHeight: 48,
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
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    color: colors.textMuted,
  },

  moneyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 78,
    paddingHorizontal: 16,
    borderRadius: 21,
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
    fontFamily: 'Inter-Bold',
    fontSize: 30,
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
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
    minHeight: 52,
    marginTop: 24,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
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
