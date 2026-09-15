import { StyleSheet, Text, View } from 'react-native';

import { useDashboard } from '../../src/hooks/use-dashboard';

export default function HomeScreen() {
  const { summary, loading, error } = useDashboard();

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
      <Text style={styles.title}>Wallet.ai</Text>

      <Text style={styles.subtitle}>Saldo disponível</Text>

      <Text style={styles.balance}>
        R$ {summary.balance.toFixed(2).replace('.', ',')}
      </Text>

      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.label}>Entradas</Text>

          <Text style={styles.income}>
            R$ {summary.totalIncome.toFixed(2).replace('.', ',')}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Gastos</Text>

          <Text style={styles.expense}>
            R$ {summary.totalExpenses.toFixed(2).replace('.', ',')}
          </Text>
        </View>
      </View>

      <Text style={styles.transactions}>
        {summary.transactionCount} transações registradas
      </Text>
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
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 40,
    fontSize: 16,
    color: '#666',
  },

  balance: {
    marginTop: 6,
    fontSize: 38,
    fontWeight: '700',
  },

  cards: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 35,
  },

  card: {
    flex: 1,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },

  label: {
    fontSize: 14,
    color: '#666',
  },

  income: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '600',
  },

  expense: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '600',
  },

  transactions: {
    marginTop: 24,
    color: '#666',
  },
});