import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listTransactions } from '../services/transaction.service';
import { TransactionWithRelations } from '../types/transaction';

export function useTransactions() {
  const [transactions, setTransactions] = useState<
    TransactionWithRelations[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await listTransactions();

      setTransactions(data);
    } catch (err) {
      console.error('Erro ao carregar transações:', err);

      setError('Não foi possível carregar suas transações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  return {
    transactions,
    loading,
    error,
    reload: loadTransactions,
  };
}