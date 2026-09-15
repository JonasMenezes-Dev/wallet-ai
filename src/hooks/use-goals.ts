import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listGoals } from '../services/goal.service';
import { Goal } from '../types/goal';

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await listGoals();

      setGoals(data);
    } catch (err) {
      console.error('Erro ao carregar metas:', err);

      setError('Não foi possível carregar suas metas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGoals();
    }, [loadGoals])
  );

  return {
    goals,
    loading,
    error,
    reload: loadGoals,
  };
}