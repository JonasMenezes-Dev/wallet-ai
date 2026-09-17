import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useState } from 'react';

import { AnimatedListItem, FadeInView } from '../../src/components/AnimatedListItem';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import {
  CreditCardSummary,
  formatCurrency,
} from '../../src/components/CreditCardSummary';

import { useAccounts } from '../../src/hooks/use-accounts';

import {
  addAccount,
  editAccount,
  removeAccount,
} from '../../src/services/account.service';

import {
  ThemeColors,
  useThemeColors,
  useThemedStyles,
} from '../../src/theme';
import { Account, AccountType } from '../../src/types/account';

/**
 * Converte texto com padrão brasileiro ("2.500,00") para número.
 * Retorna `NaN` quando não é um número válido.
 */
function toNumber(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', '.'));
}

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
  const { accounts, loading, error, reload } = useAccounts();
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();

  const [showForm, setShowForm] = useState(false);

  /** Conta em edição. `null` significa que o formulário está criando. */
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [type, setType] = useState<AccountType>('bank');

  /*
   * Mantido como texto para aceitar vírgula brasileira ("2.500,00").
   * A conversão para número acontece só no momento de salvar.
   */
  const [limitAmount, setLimitAmount] = useState('');

  const isEditing = editingId !== null;
  const isCreditCard = type === 'credit_card';

  function resetForm() {
    setName('');
    setBalance('');
    setType('bank');
    setLimitAmount('');
    setEditingId(null);
    setShowForm(false);
  }

  function handleOpenCreate() {
    if (showForm && !isEditing) {
      resetForm();
      return;
    }

    setName('');
    setBalance('');
    setType('bank');
    setLimitAmount('');
    setEditingId(null);
    setShowForm(true);
  }

  function handleOpenEdit(account: Account) {
    setName(account.name);
    setBalance(account.balance.toFixed(2).replace('.', ','));
    setType(account.type);

    // Sem limite informado, o campo fica vazio (e não "0,00").
    setLimitAmount(
      typeof account.limitAmount === 'number'
        ? account.limitAmount.toFixed(2).replace('.', ',')
        : ''
    );

    setEditingId(account.id);
    setShowForm(true);
  }

  /**
   * Troca o tipo da conta.
   * Ao sair de cartão, o limite é limpo aqui também (além de o service
   * forçar `null`), para que o campo não reapareça preenchido se o
   * usuário voltar ao tipo cartão.
   */
  function handleChangeType(nextType: AccountType) {
    setType(nextType);

    if (nextType !== 'credit_card') {
      setLimitAmount('');
    }
  }

  async function handleSubmit() {
    const balanceValue = toNumber(balance);

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
        'Digite um saldo válido.'
      );

      return;
    }

    /*
     * Conferência rápida para dar feedback imediato. A decisão final
     * continua no service, que é a autoridade das regras.
     */
    let limitValue: number | null = null;

    if (isCreditCard && limitAmount.trim()) {
      limitValue = toNumber(limitAmount);

      if (Number.isNaN(limitValue) || limitValue <= 0) {
        Alert.alert(
          'Limite inválido',
          'O limite do cartão deve ser maior que zero.'
        );

        return;
      }
    }

    const payload = {
      name: name.trim(),
      type,
      balance: balanceValue,
      limitAmount: isCreditCard ? limitValue : null,
    };

    try {
      if (isEditing) {
        await editAccount(editingId, payload);
      } else {
        await addAccount(payload);
      }

      resetForm();

      await reload();
    } catch (submitError) {
      console.error(
        isEditing ? 'Erro ao editar conta:' : 'Erro ao criar conta:',
        submitError
      );

      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível salvar a conta.';

      Alert.alert('Não foi possível salvar', message);
    }
  }

  function handleDeleteAccount(accountId: number, accountName: string) {
    Alert.alert(
      'Excluir conta',
      `Deseja realmente excluir a conta "${accountName}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccount(accountId);

              await reload();
            } catch (error) {
              console.error('Erro ao excluir conta:', error);

              const message =
                error instanceof Error
                  ? error.message
                  : 'Não foi possível excluir a conta.';

              Alert.alert('Não foi possível excluir', message);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <FadeInView style={styles.center}>
        <Text>Carregando contas...</Text>
      </FadeInView>
    );
  }

  if (error) {
    return (
      <FadeInView style={styles.center}>
        <Text>{error}</Text>
      </FadeInView>
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

        <AnimatedPressable
          style={styles.addButton}
          pressedOpacity={0.85}
          onPress={handleOpenCreate}
        >
          <Text style={styles.addButtonText}>
            {showForm ? 'Fechar' : '+ Conta'}
          </Text>
        </AnimatedPressable>
      </View>

      {showForm && (
        <FadeInView style={styles.form}>
          <Text style={styles.formTitle}>
            {isEditing ? 'Editar conta' : 'Nova conta'}
          </Text>

          <Text style={styles.label}>
            Nome
          </Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Itaú"
            placeholderTextColor={colors.textSubtle}
          />

          <Text style={styles.label}>
            {isCreditCard ? 'Valor utilizado do cartão' : 'Saldo inicial'}
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
              placeholderTextColor={colors.textSubtle}
              keyboardType="decimal-pad"
            />
          </View>

          {isCreditCard && (
            <Text style={styles.helper}>
              Quanto já foi gasto no cartão e ainda não foi pago.
            </Text>
          )}

          <Text style={styles.label}>
            Tipo
          </Text>

          <View style={styles.typeList}>
            {accountTypes.map((item) => (
              <AnimatedPressable
                key={item.value}
                pressedScale={0.94}
                style={[
                  styles.typeOption,
                  type === item.value &&
                    styles.typeOptionActive,
                ]}
                onPress={() =>
                  handleChangeType(item.value)
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
              </AnimatedPressable>
            ))}
          </View>

          {isCreditCard && (
            <>
              <Text style={styles.label}>
                Limite do cartão
              </Text>

              <View style={styles.moneyInput}>
                <Text style={styles.prefix}>
                  R$
                </Text>

                <TextInput
                  style={styles.moneyTextInput}
                  value={limitAmount}
                  onChangeText={setLimitAmount}
                  placeholder="0,00"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.helper}>
                Informe o limite total disponibilizado pelo banco. Deixe
                vazio se não quiser acompanhar o disponível.
              </Text>
            </>
          )}

          <AnimatedPressable
            style={styles.saveButton}
            pressedOpacity={0.85}
            onPress={handleSubmit}
          >
            <Text style={styles.saveButtonText}>
              {isEditing ? 'Salvar alterações' : 'Criar conta'}
            </Text>
          </AnimatedPressable>
        </FadeInView>
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
        renderItem={({ item, index }) => {
          const isCard = item.type === 'credit_card';

          return (
            <AnimatedListItem index={index} style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <View style={styles.accountInfo}>
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

                <View style={styles.accountActions}>
                  {!isCard && (
                    <Text style={styles.accountBalance}>
                      {formatCurrency(item.balance)}
                    </Text>
                  )}

                  <View style={styles.cardButtons}>
                    <AnimatedPressable
                      style={styles.editButton}
                      pressedScale={0.93}
                      onPress={() => handleOpenEdit(item)}
                    >
                      <Text style={styles.editButtonText}>
                        Editar
                      </Text>
                    </AnimatedPressable>

                    <AnimatedPressable
                      style={styles.deleteButton}
                      pressedScale={0.93}
                      onPress={() =>
                        handleDeleteAccount(item.id, item.name)
                      }
                    >
                      <Text style={styles.deleteButtonText}>
                        Excluir
                      </Text>
                    </AnimatedPressable>
                  </View>
                </View>
              </View>

              {/*
               * Cartão não é dinheiro em conta: em vez do saldo, mostramos
               * o quanto já foi utilizado e quanto sobra de limite.
               */}
              {isCard && (
                <CreditCardSummary
                  usedAmount={Math.abs(Math.min(item.balance, 0))}
                  limitAmount={item.limitAmount}
                />
              )}
            </AnimatedListItem>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Nenhuma conta cadastrada.
          </Text>
        }
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 70,
    backgroundColor: colors.background,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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

  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },

  form: {
    marginTop: 24,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },

  formTitle: {
    marginBottom: 18,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },

  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  input: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    fontSize: 16,
    color: colors.text,
  },

  moneyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },

  prefix: {
    marginRight: 8,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },

  moneyTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  typeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },

  typeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },

  typeOptionTextActive: {
    color: colors.onPrimary,
  },

  saveButton: {
    height: 52,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.primary,
  },

  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
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
    color: colors.textSubtle,
  },

  helper: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSubtle,
  },

  accountCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  accountInfo: {
    flex: 1,
    marginRight: 12,
  },

  accountName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },

  accountType: {
    marginTop: 5,
    fontSize: 13,
    color: colors.textSubtle,
  },

  accountBalance: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },

  accountActions: {
    alignItems: 'flex-end',
  },

  cardButtons: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },

  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.accentSurface,
  },

  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.expenseSurface,
  },

  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.expense,
  },
  });