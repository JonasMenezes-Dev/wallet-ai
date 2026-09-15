import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listAccounts } from '../services/account.service';
import { Account } from '../types/account';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);

  const loadAccounts = useCallback(async () => {
    if (loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;

      setLoading(true);
      setError(null);

      const data = await listAccounts();

      setAccounts(data);
    } catch (err) {
      console.error(
        'Erro ao carregar contas:',
        err
      );

      setError(
        'Não foi possível carregar suas contas.'
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  return {
    accounts,
    loading,
    error,
    reload: loadAccounts,
  };
}