import { useEffect, useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { addTransaction } from '../../src/services/transaction.service';
import { listCategories } from '../../src/services/category.service';
import { listAccounts } from '../../src/services/account.service';

import { Category } from '../../src/types/category';
import { Account } from '../../src/types/account';
import { TransactionType } from '../../src/types/transaction';

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
        categoryId: selectedCategoryId,
        accountId: selectedAccountId,
        paymentMethod: null,
        goalId: null,
        isAutomatic: false,
        source: 'manual',
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Nova transação</Text>

      <Text style={styles.subtitle}>
        Registre uma entrada ou saída de dinheiro.
      </Text>

      <View style={styles.typeSelector}>
        <Pressable
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
        </Pressable>

        <Pressable
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
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Valor</Text>

        <View style={styles.moneyInput}>
          <Text style={styles.prefix}>R$</Text>

          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0,00"
            placeholderTextColor="#999"
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
          placeholderTextColor="#999"
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
            <Pressable
              key={category.id}
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
            </Pressable>
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
            <Pressable
              key={account.id}
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
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.saveButtonPressed,
          saving && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Salvando...' : 'Salvar transação'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  content: {
    padding: 24,
    paddingTop: 70,
    paddingBottom: 40,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#6B7280',
  },

  typeSelector: {
    flexDirection: 'row',
    marginTop: 32,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },

  typeButton: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },

  typeButtonActive: {
    backgroundColor: '#174EA6',
  },

  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },

  typeButtonTextActive: {
    color: '#FFFFFF',
  },

  field: {
    marginTop: 24,
  },

  label: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },

  moneyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
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
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
  },

  textInput: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#111827',
  },

  options: {
    gap: 10,
    paddingVertical: 2,
  },

  option: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  optionActive: {
    backgroundColor: '#174EA6',
    borderColor: '#174EA6',
  },

  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  optionTextActive: {
    color: '#FFFFFF',
  },

  saveButton: {
    height: 58,
    marginTop: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#174EA6',
  },

  saveButtonPressed: {
    opacity: 0.8,
  },

  saveButtonDisabled: {
    opacity: 0.5,
  },

  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});