import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTransactions } from '../../src/hooks/use-transactions';
import { removeTransaction } from '../../src/services/transaction.service';

function formatCurrency(value: number) {
  return `R$ ${value
    .toFixed(2)
    .replace('.', ',')}`;
}

function getTransactionLabel(
  type: string
) {
  switch (type) {
    case 'income':
      return 'Entrada';

    case 'transfer':
      return 'Aporte para meta';

    default:
      return 'Gasto';
  }
}

function getTransactionAmountPrefix(
  type: string
) {
  if (type === 'income') {
    return '+';
  }

  if (type === 'transfer') {
    return '↗';
  }

  return '-';
}

export default function TransactionsScreen() {
  const {
    transactions,
    loading,
    error,
    reload,
  } = useTransactions();

  async function handleDelete(id: number) {
    Alert.alert(
      'Excluir transação',
      'Tem certeza que deseja excluir esta transação?',
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
              await removeTransaction(id);
              await reload();
            } catch (error) {
              console.error(
                'Erro ao excluir transação:',
                error
              );

              Alert.alert(
                'Erro',
                'Não foi possível excluir a transação.'
              );
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>
          Carregando transações...
        </Text>
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
      <Text style={styles.title}>
        Transações
      </Text>

      <Text style={styles.subtitle}>
        {transactions.length === 0
          ? 'Nenhuma transação registrada.'
          : `${transactions.length} ${
              transactions.length === 1
                ? 'transação'
                : 'transações'
            } registrada${
              transactions.length === 1
                ? ''
                : 's'
            }.`}
      </Text>

      <FlatList
        data={transactions}
        keyExtractor={(item) =>
          item.id.toString()
        }
        contentContainerStyle={
          transactions.length === 0
            ? styles.emptyList
            : styles.list
        }
        renderItem={({ item }) => {
          const isIncome =
            item.type === 'income';

          const isGoalContribution =
            item.type === 'transfer' &&
            item.goalId !== null;

          const label =
            getTransactionLabel(
              item.type
            );

          const prefix =
            getTransactionAmountPrefix(
              item.type
            );

          return (
            <View
              style={styles.transactionCard}
            >
              <View
                style={
                  styles.transactionInfo
                }
              >
                <View
                  style={
                    styles.labelRow
                  }
                >
                  <View
                    style={[
                      styles.typeBadge,
                      isIncome
                        ? styles.incomeBadge
                        : isGoalContribution
                        ? styles.goalBadge
                        : styles.expenseBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        isIncome
                          ? styles.incomeBadgeText
                          : isGoalContribution
                          ? styles.goalBadgeText
                          : styles.expenseBadgeText,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                </View>

                <Text
                  style={
                    styles.transactionDescription
                  }
                >
                  {item.description ||
                    'Sem descrição'}
                </Text>

                <Text
                  style={
                    styles.transactionMeta
                  }
                >
                  {item.source === 'manual'
                    ? 'Lançamento manual'
                    : 'Automático'}
                </Text>
              </View>

              <View
                style={
                  styles.transactionRight
                }
              >
                <Text
                  style={[
                    styles.transactionAmount,
                    isIncome
                      ? styles.income
                      : isGoalContribution
                      ? styles.goal
                      : styles.expense,
                  ]}
                >
                  {prefix}{' '}
                  {formatCurrency(
                    item.amount
                  )}
                </Text>

                <Pressable
                  style={({
                    pressed,
                  }) => [
                    styles.deleteButton,
                    pressed &&
                      styles.deleteButtonPressed,
                  ]}
                  onPress={() =>
                    handleDelete(item.id)
                  }
                >
                  <Text
                    style={
                      styles.deleteButtonText
                    }
                  >
                    Excluir
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
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

  list: {
    paddingTop: 24,
    paddingBottom: 32,
    gap: 12,
  },

  emptyList: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },

  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },

  labelRow: {
    flexDirection: 'row',
    marginBottom: 7,
  },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },

  incomeBadge: {
    backgroundColor: '#DCFCE7',
  },

  expenseBadge: {
    backgroundColor: '#FEE2E2',
  },

  goalBadge: {
    backgroundColor: '#E8F0FE',
  },

  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  incomeBadgeText: {
    color: '#15803D',
  },

  expenseBadgeText: {
    color: '#DC2626',
  },

  goalBadgeText: {
    color: '#174EA6',
  },

  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  transactionMeta: {
    marginTop: 5,
    fontSize: 13,
    color: '#9CA3AF',
  },

  transactionRight: {
    alignItems: 'flex-end',
  },

  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },

  income: {
    color: '#15803D',
  },

  expense: {
    color: '#DC2626',
  },

  goal: {
    color: '#174EA6',
  },

  deleteButton: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },

  deleteButtonPressed: {
    opacity: 0.6,
  },

  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
});