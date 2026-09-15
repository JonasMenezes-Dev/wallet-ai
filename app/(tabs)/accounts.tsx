import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useEffect, useState } from 'react';

import {
  addAccount,
  listAccounts,
} from '../../src/services/account.service';

import { Account, AccountType } from '../../src/types/account';

const accountTypes: {
  value: AccountType;
  label: string;
}[] = [
  { value: 'bank', label: 'Banco' },
  { value: 'credit_card', label: 'Cartão' },
  { value: 'benefit', label: 'Benefício' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'other', label: 'Outro' },
];

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [type, setType] = useState<AccountType>('bank');

  async function loadAccounts() {
    try {
      setLoading(true);

      const data = await listAccounts();

      setAccounts(data);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);

      Alert.alert(
        'Erro',
        'Não foi possível carregar suas contas.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function handleCreateAccount() {
    const balanceValue = Number(
      balance.replace(/\./g, '').replace(',', '.')
    );

    if (!name.trim()) {
      Alert.alert(
        'Nome obrigatório',
        'Digite o nome da conta.'
      );

      return;
    }

    if (
      Number.isNaN(balanceValue) ||
      balanceValue < 0
    ) {
      Alert.alert(
        'Saldo inválido',
        'Digite um saldo inicial válido.'
      );

      return;
    }

    try {
      await addAccount({
        name: name.trim(),
        type,
        balance: balanceValue,
      });

      setName('');
      setBalance('');
      setType('bank');
      setShowForm(false);

      await loadAccounts();
    } catch (error) {
      console.error(
        'Erro ao criar conta:',
        error
      );

      Alert.alert(
        'Erro',
        'Não foi possível criar a conta.'
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Carregando contas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Contas</Text>

          <Text style={styles.subtitle}>
            Seu dinheiro organizado por conta.
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={styles.addButtonText}>
            {showForm ? 'Fechar' : '+ Conta'}
          </Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>
            Nova conta
          </Text>

          <Text style={styles.label}>
            Nome
          </Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Itaú"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>
            Saldo inicial
          </Text>

          <View style={styles.moneyInput}>
            <Text style={styles.prefix}>
              R$
            </Text>

            <TextInput
              style={styles.moneyTextInput}
              value={balance}
              onChangeText={setBalance}
              placeholder="0,00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={styles.label}>
            Tipo
          </Text>

          <View style={styles.typeList}>
            {accountTypes.map((item) => (
              <Pressable
                key={item.value}
                style={[
                  styles.typeOption,
                  type === item.value &&
                    styles.typeOptionActive,
                ]}
                onPress={() =>
                  setType(item.value)
                }
              >
                <Text
                  style={[
                    styles.typeOptionText,
                    type === item.value &&
                      styles.typeOptionTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.saveButton}
            onPress={handleCreateAccount}
          >
            <Text style={styles.saveButtonText}>
              Criar conta
            </Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={accounts}
        keyExtractor={(item) =>
          item.id.toString()
        }
        contentContainerStyle={
          accounts.length === 0
            ? styles.emptyList
            : styles.list
        }
        renderItem={({ item }) => (
          <View style={styles.accountCard}>
            <View>
              <Text style={styles.accountName}>
                {item.name}
              </Text>

              <Text style={styles.accountType}>
                {accountTypes.find(
                  (typeItem) =>
                    typeItem.value === item.type
                )?.label ?? 'Outro'}
              </Text>
            </View>

            <Text style={styles.accountBalance}>
              R${' '}
              {item.balance
                .toFixed(2)
                .replace('.', ',')}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Nenhuma conta cadastrada.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 70,
    backgroundColor: '#F7F8FA',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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

  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#174EA6',
  },

  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  form: {
    marginTop: 24,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },

  formTitle: {
    marginBottom: 18,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  input: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#111827',
  },

  moneyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  prefix: {
    marginRight: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },

  moneyTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },

  typeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },

  typeOptionActive: {
    borderColor: '#174EA6',
    backgroundColor: '#174EA6',
  },

  typeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },

  typeOptionTextActive: {
    color: '#FFFFFF',
  },

  saveButton: {
    height: 52,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#174EA6',
  },

  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  list: {
    paddingTop: 24,
    paddingBottom: 32,
    gap: 12,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyText: {
    color: '#9CA3AF',
  },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },

  accountName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  accountType: {
    marginTop: 5,
    fontSize: 13,
    color: '#9CA3AF',
  },

  accountBalance: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
});