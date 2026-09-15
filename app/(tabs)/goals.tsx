import { useState } from 'react';

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

import { useAccounts } from '../../src/hooks/use-accounts';
import { useGoals } from '../../src/hooks/use-goals';
import { contributeToGoal } from '../../src/services/goal.service';

function formatCurrency(value: number) {
  return `R$ ${value
    .toFixed(2)
    .replace('.', ',')}`;
}

function getProgress(
  current: number,
  target: number
) {
  if (target <= 0) {
    return 0;
  }

  return Math.min(
    current / target,
    1
  );
}

function formatDeadline(
  deadline: string | null
) {
  if (!deadline) {
    return 'Sem prazo definido';
  }

  return `Prazo: ${deadline}`;
}

export default function GoalsScreen() {
  const {
    goals,
    loading,
    error,
    reload: reloadGoals,
  } = useGoals();

  const {
    accounts,
    reload: reloadAccounts,
  } = useAccounts();

  const [selectedGoalId, setSelectedGoalId] =
    useState<number | null>(null);

  const [selectedAccountId, setSelectedAccountId] =
    useState<number | null>(null);

  const [amount, setAmount] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  function parseMoney(value: string) {
    return Number(
      value
        .replace(/\./g, '')
        .replace(',', '.')
    );
  }

  function openContribution(goalId: number) {
    setSelectedGoalId(goalId);
    setSelectedAccountId(
      accounts.length > 0
        ? accounts[0].id
        : null
    );
    setAmount('');
  }

  function closeContribution() {
    setSelectedGoalId(null);
    setSelectedAccountId(null);
    setAmount('');
  }

  async function handleContribution() {
    if (!selectedGoalId) {
      return;
    }

    if (!selectedAccountId) {
      Alert.alert(
        'Conta obrigatória',
        'Selecione a conta de onde o dinheiro será retirado.'
      );

      return;
    }

    const value = parseMoney(amount);

    if (
      Number.isNaN(value) ||
      value <= 0
    ) {
      Alert.alert(
        'Valor inválido',
        'Digite um valor de aporte válido.'
      );

      return;
    }

    try {
      setSaving(true);

      await contributeToGoal(
        selectedGoalId,
        selectedAccountId,
        value
      );

      await reloadGoals();
      await reloadAccounts();

      closeContribution();

      Alert.alert(
        'Aporte realizado',
        'O dinheiro foi adicionado à sua meta.'
      );
    } catch (error) {
      console.error(
        'Erro ao adicionar aporte:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível realizar o aporte.';

      Alert.alert(
        'Não foi possível realizar o aporte',
        message
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>
          Carregando metas...
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>
              Metas
            </Text>

            <Text style={styles.subtitle}>
              Seus objetivos financeiros
            </Text>
          </View>

          <Pressable
            style={styles.addButton}
            onPress={() =>
              router.push('/goal/new')
            }
          >
            <Text style={styles.addButtonText}>
              + Meta
            </Text>
          </Pressable>
        </View>

        {goals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>
              🎯
            </Text>

            <Text style={styles.emptyTitle}>
              Nenhuma meta ainda
            </Text>

            <Text style={styles.emptyText}>
              Crie uma meta para começar a
              acompanhar seu progresso.
            </Text>

            <Pressable
              style={styles.emptyButton}
              onPress={() =>
                router.push('/goal/new')
              }
            >
              <Text
                style={styles.emptyButtonText}
              >
                Criar minha primeira meta
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.goalsList}>
            {goals.map((goal) => {
              const progress =
                getProgress(
                  goal.currentAmount,
                  goal.targetAmount
                );

              const percentage =
                Math.round(
                  progress * 100
                );

              const remaining =
                Math.max(
                  goal.targetAmount -
                    goal.currentAmount,
                  0
                );

              const isContributing =
                selectedGoalId === goal.id;

              return (
                <View
                  key={goal.id}
                  style={styles.goalCard}
                >
                  <View
                    style={
                      styles.goalHeader
                    }
                  >
                    <View
                      style={
                        styles.goalInfo
                      }
                    >
                      <Text
                        style={
                          styles.goalName
                        }
                      >
                        {goal.name}
                      </Text>

                      <Text
                        style={
                          styles.deadline
                        }
                      >
                        {formatDeadline(
                          goal.deadline
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.percentage
                      }
                    >
                      {percentage}%
                    </Text>
                  </View>

                  <View
                    style={
                      styles.progressBackground
                    }
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${percentage}%`,
                        },
                      ]}
                    />
                  </View>

                  <View
                    style={styles.values}
                  >
                    <View>
                      <Text
                        style={
                          styles.valueLabel
                        }
                      >
                        Guardado
                      </Text>

                      <Text
                        style={
                          styles.currentValue
                        }
                      >
                        {formatCurrency(
                          goal.currentAmount
                        )}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.targetContainer
                      }
                    >
                      <Text
                        style={
                          styles.valueLabel
                        }
                      >
                        Objetivo
                      </Text>

                      <Text
                        style={
                          styles.targetValue
                        }
                      >
                        {formatCurrency(
                          goal.targetAmount
                        )}
                      </Text>
                    </View>
                  </View>

                  {remaining > 0 ? (
                    <Text
                      style={
                        styles.remaining
                      }
                    >
                      Faltam{' '}
                      {formatCurrency(
                        remaining
                      )}
                    </Text>
                  ) : (
                    <Text
                      style={
                        styles.completed
                      }
                    >
                      🎉 Meta alcançada!
                    </Text>
                  )}

                  {remaining > 0 && (
                    <>
                      {!isContributing ? (
                        <Pressable
                          style={
                            styles.addMoneyButton
                          }
                          onPress={() =>
                            openContribution(
                              goal.id
                            )
                          }
                        >
                          <Text
                            style={
                              styles.addMoneyText
                            }
                          >
                            + Adicionar dinheiro
                          </Text>
                        </Pressable>
                      ) : (
                        <View
                          style={
                            styles.contributionBox
                          }
                        >
                          <Text
                            style={
                              styles.contributionTitle
                            }
                          >
                            Adicionar dinheiro
                          </Text>

                          <Text
                            style={
                              styles.contributionSubtitle
                            }
                          >
                            De qual conta vai sair o
                            dinheiro?
                          </Text>

                          <View
                            style={
                              styles.accountsList
                            }
                          >
                            {accounts.map(
                              (account) => {
                                const selected =
                                  selectedAccountId ===
                                  account.id;

                                return (
                                  <Pressable
                                    key={
                                      account.id
                                    }
                                    style={[
                                      styles.accountOption,
                                      selected &&
                                        styles.accountOptionSelected,
                                    ]}
                                    onPress={() =>
                                      setSelectedAccountId(
                                        account.id
                                      )
                                    }
                                  >
                                    <View>
                                      <Text
                                        style={
                                          styles.accountName
                                        }
                                      >
                                        {
                                          account.name
                                        }
                                      </Text>

                                      <Text
                                        style={
                                          styles.accountBalance
                                        }
                                      >
                                        Saldo:{' '}
                                        {formatCurrency(
                                          account.balance
                                        )}
                                      </Text>
                                    </View>

                                    {selected && (
                                      <Text
                                        style={
                                          styles.selectedMark
                                        }
                                      >
                                        ✓
                                      </Text>
                                    )}
                                  </Pressable>
                                );
                              }
                            )}
                          </View>

                          <Text
                            style={
                              styles.contributionSubtitle
                            }
                          >
                            Quanto deseja adicionar?
                          </Text>

                          <TextInput
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="Ex.: 100,00"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="decimal-pad"
                            style={
                              styles.amountInput
                            }
                          />

                          <View
                            style={
                              styles.quickValues
                            }
                          >
                            {[50, 100, 200, 500].map(
                              (value) => (
                                <Pressable
                                  key={value}
                                  style={
                                    styles.quickValue
                                  }
                                  onPress={() =>
                                    setAmount(
                                      value.toString()
                                    )
                                  }
                                >
                                  <Text
                                    style={
                                      styles.quickValueText
                                    }
                                  >
                                    R$ {value}
                                  </Text>
                                </Pressable>
                              )
                            )}
                          </View>

                          <View
                            style={
                              styles.contributionActions
                            }
                          >
                            <Pressable
                              style={
                                styles.cancelButton
                              }
                              onPress={
                                closeContribution
                              }
                              disabled={saving}
                            >
                              <Text
                                style={
                                  styles.cancelButtonText
                                }
                              >
                                Cancelar
                              </Text>
                            </Pressable>

                            <Pressable
                              style={
                                styles.confirmButton
                              }
                              onPress={
                                handleContribution
                              }
                              disabled={saving}
                            >
                              <Text
                                style={
                                  styles.confirmButtonText
                                }
                              >
                                {saving
                                  ? 'Salvando...'
                                  : 'Confirmar aporte'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}
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

  emptyCard: {
    marginTop: 30,
    padding: 24,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  emptyIcon: {
    fontSize: 36,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },

  emptyText: {
    marginTop: 7,
    maxWidth: 280,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
  },

  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#E8F0FE',
  },

  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#174EA6',
  },

  goalsList: {
    marginTop: 24,
    gap: 14,
  },

  goalCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },

  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  goalInfo: {
    flex: 1,
    marginRight: 12,
  },

  goalName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  deadline: {
    marginTop: 5,
    fontSize: 12,
    color: '#9CA3AF',
  },

  percentage: {
    fontSize: 18,
    fontWeight: '800',
    color: '#174EA6',
  },

  progressBackground: {
    height: 10,
    marginTop: 18,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#174EA6',
  },

  values: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },

  valueLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  currentValue: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: '700',
    color: '#15803D',
  },

  targetContainer: {
    alignItems: 'flex-end',
  },

  targetValue: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  remaining: {
    marginTop: 14,
    fontSize: 13,
    color: '#6B7280',
  },

  completed: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },

  addMoneyButton: {
    height: 46,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E8F0FE',
  },

  addMoneyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#174EA6',
  },

  contributionBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F7F8FA',
  },

  contributionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  contributionSubtitle: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },

  accountsList: {
    gap: 8,
  },

  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  accountOptionSelected: {
    borderColor: '#174EA6',
    backgroundColor: '#E8F0FE',
  },

  accountName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  accountBalance: {
    marginTop: 3,
    fontSize: 12,
    color: '#6B7280',
  },

  selectedMark: {
    fontSize: 20,
    fontWeight: '800',
    color: '#174EA6',
  },

  amountInput: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  quickValues: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  quickValue: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#E8F0FE',
  },

  quickValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#174EA6',
  },

  contributionActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },

  cancelButton: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  confirmButton: {
    flex: 1.5,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#174EA6',
  },

  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});