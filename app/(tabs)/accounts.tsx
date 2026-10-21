import { Image } from "expo-image";
import { PremiumAmbient } from "../../src/components/PremiumAmbient";
import { AppCard } from "../../src/components/AppCard";
import { AppField } from "../../src/components/AppField";
import { AppText as Text } from "../../src/components/AppText";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,

  TextInput,
  View,
} from 'react-native';

import { useRef, useState } from 'react';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedListItem, FadeInView } from '../../src/components/AnimatedListItem';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import {
  CreditCardSummary,
  formatCurrency,
} from '../../src/components/CreditCardSummary';

import { useAccounts } from '../../src/hooks/use-accounts';
import { payCreditCard } from '../../src/services/transaction.service';

import {
  addAccount,
  editAccount,
  removeAccount,
} from '../../src/services/account.service';

import {
  typography,
  ThemeColors,
  useThemeColors,
  useThemedStyles,
} from '../../src/theme';
import { ScreenHeader } from '../../src/components/ScreenHeader';
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
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

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
  const [paymentCardId, setPaymentCardId] = useState<number | null>(null);
  const [paymentSourceId, setPaymentSourceId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const paymentPending = useRef(false);
  const paymentSources = accounts.filter(account => account.type !== 'credit_card' && account.id !== paymentCardId);

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
    if (paymentPending.current) return;
    setPaymentCardId(null);
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
    if (paymentPending.current) return;
    setPaymentCardId(null);
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

  function handleOpenPayment(card: Account) {
    if (paymentPending.current) return;
    setShowForm(false);
    setPaymentCardId(card.id);
    setPaymentSourceId(accounts.find(account => account.type !== 'credit_card' && account.id !== card.id)?.id ?? null);
    setPaymentAmount(card.balance.toFixed(2).replace('.', ','));
  }

  async function handlePayment() {
    if (paymentPending.current) return;
    const card = accounts.find(account => account.id === paymentCardId && account.type === 'credit_card');
    const source = paymentSources.find(account => account.id === paymentSourceId);
    if (!card || !source) {
      Alert.alert('Conta obrigatória', 'Selecione uma conta de origem diferente do cartão.');
      return;
    }
    const amount = toNumber(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero.');
      return;
    }
    paymentPending.current = true;
    setPaying(true);
    try {
      await payCreditCard({
        amount, fromAccountId: source.id, toAccountId: card.id, description: null,
      });
      setPaymentCardId(null);
      setPaymentAmount('');
      try {
        await reload();
      } catch {
        Alert.alert('Pagamento realizado', 'O pagamento foi registrado. Recarregue a tela para atualizar os saldos.');
        return;
      }
      Alert.alert('Pagamento realizado', 'O saldo da conta e o valor devido do cartão foram atualizados.');
    } catch (paymentError) {
      Alert.alert('Não foi possível pagar', paymentError instanceof Error ? paymentError.message : 'Tente novamente.');
    } finally {
      paymentPending.current = false;
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <FadeInView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" accessibilityLabel="Carregando contas" />
        <Text>Carregando contas...</Text>
      </FadeInView>
    );
  }

  if (error) {
    return (
      <FadeInView style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <AnimatedPressable style={styles.retryButton} onPress={reload}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </AnimatedPressable>
      </FadeInView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <PremiumAmbient variant="standard" />
      <FlatList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={<>
      <ScreenHeader
        title="Contas e cartões"
        subtitle="Tudo organizado em um só lugar"
        eyebrow="Seu dinheiro"
        accessory={
          <AnimatedPressable
            style={styles.addButton}
            pressedOpacity={0.85}
            onPress={handleOpenCreate}
            disabled={paying}
          >
            <Text style={styles.addButtonText}>
              {showForm ? 'Fechar' : '+ Conta'}
            </Text>
          </AnimatedPressable>
        }
      />

      <AppCard ambient="highlight" style={styles.balanceCard}>
        <Text variant="label" tone="muted">Saldo consolidado</Text>
        <Text variant="amount" style={styles.consolidatedBalance}>{formatCurrency(accounts.filter(account => account.type !== "credit_card").reduce((total, account) => total + account.balance, 0))}</Text>
        <Text variant="caption" tone="muted">{accounts.filter(account => account.type !== "credit_card").length} contas vinculadas</Text>
      </AppCard>

      {showForm && (
        <FadeInView style={styles.form}>
          <Text style={styles.formTitle}>
            {isEditing ? 'Editar conta' : 'Nova conta'}
          </Text>

          <AppField label="Nome" style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Itaú"
            placeholderTextColor={colors.textSubtle} />

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
                accessibilityRole="button"
                accessibilityState={{ selected: type === item.value }}
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

        </>}
        data={accounts}
        keyExtractor={(item) =>
          item.id.toString()
        }
        contentContainerStyle={[
          accounts.length === 0 && !showForm
            ? styles.emptyList
            : styles.list,
          { paddingBottom: Math.max(insets.bottom, tabBarHeight) + 18 },
        ]}
        renderItem={({ item, index }) => {
          const isCard = item.type === 'credit_card';

          return (
            <AnimatedListItem index={index}>
            <AppCard style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <View style={styles.accountIcon}>
                  <Image source={isCard ? require("../../assets/premium/accounts-card.svg") : item.type === "cash" ? require("../../assets/premium/accounts-cash.svg") : require("../../assets/premium/accounts-bank.svg")} tintColor={item.type === "cash" ? colors.warning : colors.primary} style={{ width: isCard ? 23 : 21, height: isCard ? 23 : 21 }} accessible={false} />
                </View>
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
                    <Text
                      style={styles.accountBalance}


                    >
                      {formatCurrency(item.balance)}
                    </Text>
                  )}

                  <View style={styles.cardButtons}>
                    {isCard && (
                      <AnimatedPressable
                        style={styles.editButton}
                        pressedScale={0.93}
                        disabled={paying || item.balance <= 0}
                        onPress={() => handleOpenPayment(item)}
                      >
                        <Text style={styles.editButtonText}>Pagar cartão</Text>
                      </AnimatedPressable>
                    )}
                    <AnimatedPressable
                      style={styles.editButton}
                      pressedScale={0.93}
                      onPress={() => handleOpenEdit(item)}
                      disabled={paying}
                    >
                      <Text style={styles.editButtonText}>
                        Editar
                      </Text>
                    </AnimatedPressable>

                    <AnimatedPressable
                      style={styles.deleteButton}
                      disabled={paying}
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
                /*
                 * O `balance` do cartão é o valor utilizado. Lemos sempre
                 * em módulo: lançamentos antigos gravaram a dívida como
                 * saldo negativo e os novos gravam como positivo — os dois
                 * significam o mesmo "utilizado".
                 */
                <CreditCardSummary
                  usedAmount={Math.abs(item.balance)}
                  limitAmount={item.limitAmount}
                />
              )}
              {isCard && paymentCardId === item.id && (
                <View style={styles.form}>
                  <Text style={styles.formTitle}>Pagar {item.name}</Text>
                  <Text style={styles.helper}>Valor devido: {formatCurrency(item.balance)}</Text>
                  <Text style={styles.label}>Conta de origem</Text>
                  <View style={styles.typeList}>
                    {paymentSources.map(source => (
                      <AnimatedPressable
                        key={source.id}
                        style={[styles.typeOption, paymentSourceId === source.id && styles.typeOptionActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: paymentSourceId === source.id }}
                        disabled={paying}
                        onPress={() => setPaymentSourceId(source.id)}
                      >
                        <Text style={[styles.typeOptionText, paymentSourceId === source.id && styles.typeOptionTextActive]}>{source.name}</Text>
                      </AnimatedPressable>
                    ))}
                  </View>
                  {paymentSources.length === 0 && <Text style={styles.helper}>Cadastre uma conta sem cartão de crédito para pagar.</Text>}
                  <AppField label="Valor do pagamento"
                    style={styles.input}
                    accessibilityLabel="Valor do pagamento"
                    keyboardType="decimal-pad"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    editable={!paying}
                  />
                  <AnimatedPressable
                    style={styles.saveButton}
                    disabled={paying || !paymentSources.some(source => source.id === paymentSourceId)}
                    onPress={handlePayment}
                  >
                    {paying && <ActivityIndicator color={colors.onPrimary} size="small" />}
                    <Text style={styles.saveButtonText}>{paying ? 'Processando...' : 'Confirmar pagamento'}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={styles.editButton}
                    disabled={paying}
                    onPress={() => { if (!paymentPending.current) setPaymentCardId(null); }}
                  >
                    <Text style={styles.editButtonText}>Cancelar pagamento</Text>
                  </AnimatedPressable>
                </View>
              )}
            </AppCard>
            </AnimatedListItem>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Nenhuma conta cadastrada.
          </Text>
        }
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 24,
    backgroundColor: colors.background,
  },

  errorText: { fontSize: 14, textAlign: 'center', color: colors.expense, marginHorizontal: 24 },
  retryButton: { minHeight: 44, justifyContent: "center", marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryButtonText: { fontSize: 14, fontWeight: '700', fontFamily: typography.family.bold, color: colors.onPrimary },
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
    fontSize: 29,
    fontWeight: '800', fontFamily: typography.family.bold,
    color: colors.text,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: colors.textMuted,
  },

  addButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  addButtonText: {
    fontSize: 14,
    fontWeight: '700', fontFamily: typography.family.bold,
    color: colors.onPrimary,
  },

  form: {
    marginTop: 8,
    marginBottom: 8,
    padding: 20,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  formTitle: {
    marginBottom: 18,
    fontSize: 18,
    fontWeight: '700', fontFamily: typography.family.bold,
    color: colors.text,
  },

  label: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600', fontFamily: typography.family.bold,
    color: colors.text,
  },

  balanceCard: { marginBottom: 24, gap: 12 },
  consolidatedBalance: { fontSize: 29 },
  accountIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.accentSurface, alignItems: "center", justifyContent: "center" },
  input: {
    minHeight: 55,
    paddingHorizontal: 14,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    fontSize: 16,
    color: colors.text,
  },

  moneyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 55,
    paddingHorizontal: 14,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },

  prefix: {
    marginRight: 8,
    fontSize: 16,
    fontWeight: '600', fontFamily: typography.family.bold,
    color: colors.textMuted,
  },

  moneyTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600', fontFamily: typography.family.bold,
    color: colors.text,
  },

  typeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  typeOption: {
    minHeight: 44,
    justifyContent: "center",
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
    fontWeight: '600', fontFamily: typography.family.bold,
    color: colors.textMuted,
  },

  typeOptionTextActive: {
    color: colors.onPrimary,
  },

  saveButton: {
    minHeight: 55,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.primary,
  },

  saveButtonText: {
    fontSize: 15,
    fontWeight: '700', fontFamily: typography.family.bold,
    color: colors.onPrimary,
  },

  list: {
    paddingTop: 18,
    paddingBottom: 32,
    gap: 12,
  },

  emptyList: {
    flexGrow: 1,
    width: "100%",
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
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
  },

  accountHeader: {
    flexWrap: "wrap",
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },

  accountInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },

  accountName: {
    fontSize: 17,
    fontWeight: '700', fontFamily: typography.family.bold,
    color: colors.text,
  },

  accountType: {
    marginTop: 5,
    fontSize: 13,
    color: colors.textSubtle,
  },

  accountBalance: {
    maxWidth: "100%",
    fontSize: 18,
    fontWeight: '700', fontFamily: typography.family.bold,
    color: colors.text,
    textAlign: 'right',
  },

  accountActions: {
    alignItems: 'flex-end',
    flexShrink: 1,
    maxWidth: "100%",
    flexGrow: 1,
  },

  cardButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 8,
  },

  editButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.accentSurface,
  },

  editButtonText: {
    fontSize: 12,
    fontWeight: '600', fontFamily: typography.family.bold,
    color: colors.primary,
  },

  deleteButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.expenseSurface,
  },

  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600', fontFamily: typography.family.bold,
    color: colors.expense,
  },
  });
