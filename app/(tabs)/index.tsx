import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { useDashboard } from '../../src/hooks/use-dashboard';

function formatCurrency(value: number) {
  return `R$ ${value
    .toFixed(2)
    .replace('.', ',')}`;
}

function getAccountTypeLabel(type: string) {
  switch (type) {
    case 'bank':
      return 'Conta bancária';

    case 'credit_card':
      return 'Cartão de crédito';

    case 'benefit':
      return 'Benefício';

    case 'cash':
      return 'Dinheiro';

    default:
      return 'Outra conta';
  }
}

export default function HomeScreen() {
  const {
    summary,
    loading,
    error,
  } = useDashboard();

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>
              Wallet.ai
            </Text>

            <Text style={styles.subtitle}>
              Visão geral das suas finanças
            </Text>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            Saldo disponível
          </Text>

          <Text style={styles.balance}>
            {formatCurrency(summary.balance)}
          </Text>

          <Text style={styles.accountCount}>
            {summary.accounts.length}{' '}
            {summary.accounts.length === 1
              ? 'conta cadastrada'
              : 'contas cadastradas'}
          </Text>
        </View>

        <View style={styles.cards}>
          <View style={styles.card}>
            <Text style={styles.label}>
              Entradas
            </Text>

            <Text style={styles.income}>
              {formatCurrency(
                summary.totalIncome
              )}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>
              Gastos
            </Text>

            <Text style={styles.expense}>
              {formatCurrency(
                summary.totalExpenses
              )}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Minhas contas
            </Text>

            <Text style={styles.sectionSubtitle}>
              Seus saldos por conta
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push('/(tabs)/accounts')
            }
          >
            <Text style={styles.seeAll}>
              Ver todas
            </Text>
          </Pressable>
        </View>

        {summary.accounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Nenhuma conta cadastrada
            </Text>

            <Text style={styles.emptyText}>
              Cadastre uma conta para começar
              a acompanhar seu saldo.
            </Text>

            <Pressable
              style={styles.addAccountButton}
              onPress={() =>
                router.push('/(tabs)/accounts')
              }
            >
              <Text
                style={styles.addAccountButtonText}
              >
                + Adicionar conta
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.accountsList}>
            {summary.accounts.map((account) => (
              <View
                key={account.id}
                style={styles.accountCard}
              >
                <View style={styles.accountIcon}>
                  <Text
                    style={styles.accountIconText}
                  >
                    $
                  </Text>
                </View>

                <View style={styles.accountInfo}>
                  <Text
                    style={styles.accountName}
                  >
                    {account.name}
                  </Text>

                  <Text
                    style={styles.accountType}
                  >
                    {getAccountTypeLabel(
                      account.type
                    )}
                  </Text>
                </View>

                <Text style={styles.accountBalance}>
                  {formatCurrency(
                    account.balance
                  )}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.transactions}>
          {summary.transactionCount}{' '}
          {summary.transactionCount === 1
            ? 'transação registrada'
            : 'transações registradas'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.newTransactionButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() =>
            router.push('/transaction/new')
          }
        >
          <Text
            style={styles.newTransactionButtonText}
          >
            + Nova transação
          </Text>
        </Pressable>
      </ScrollView>
    </View>
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
    marginTop: 5,
    fontSize: 14,
    color: '#6B7280',
  },

  balanceCard: {
    marginTop: 28,
    padding: 24,
    borderRadius: 22,
    backgroundColor: '#174EA6',
  },

  balanceLabel: {
    fontSize: 14,
    color: '#DCE8FF',
  },

  balance: {
    marginTop: 8,
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  accountCount: {
    marginTop: 8,
    fontSize: 13,
    color: '#DCE8FF',
  },

  cards: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },

  card: {
    flex: 1,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },

  label: {
    fontSize: 13,
    color: '#6B7280',
  },

  income: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: '700',
    color: '#15803D',
  },

  expense: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: '700',
    color: '#DC2626',
  },

  sectionHeader: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#9CA3AF',
  },

  seeAll: {
    fontSize: 14,
    fontWeight: '700',
    color: '#174EA6',
  },

  accountsList: {
    marginTop: 14,
    gap: 10,
  },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },

  accountIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FE',
  },

  accountIconText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#174EA6',
  },

  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },

  accountName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  accountType: {
    marginTop: 3,
    fontSize: 12,
    color: '#9CA3AF',
  },

  accountBalance: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  emptyCard: {
    marginTop: 14,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },

  addAccountButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E8F0FE',
  },

  addAccountButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#174EA6',
  },

  transactions: {
    marginTop: 24,
    fontSize: 13,
    color: '#6B7280',
  },

  newTransactionButton: {
    height: 56,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#174EA6',
  },

  buttonPressed: {
    opacity: 0.8,
  },

  newTransactionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});