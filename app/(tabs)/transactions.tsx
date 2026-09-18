import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AnimatedListItem, FadeInView } from "../../src/components/AnimatedListItem";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { useAccounts } from "../../src/hooks/use-accounts";
import { useTransactions } from "../../src/hooks/use-transactions";
import { listCategories } from "../../src/services/category.service";
import {
  editTransaction,
  removeTransaction,
} from "../../src/services/transaction.service";
import { ThemeColors, useThemeColors, useThemedStyles } from "../../src/theme";
import type { Category } from "../../src/types/category";
import {
  emptyTransactionFilters,
  filterTransactions,
  hasActiveTransactionFilters,
  type TransactionFilters,
  type TransactionOriginFilter,
  type TransactionPeriodFilter,
  type TransactionTypeFilter,
} from "../../src/types/transaction-filters";
import type { TransactionWithRelations } from "../../src/types/transaction";

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

/** Data curta: "Hoje", "Ontem" ou "dd/mm/aaaa" quando mais antiga. */
function formatTransactionDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return "";

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();

  if (dateKey(date) === dateKey(today)) return "Hoje";

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateKey(date) === dateKey(yesterday)) return "Ontem";

  return date.toLocaleDateString("pt-BR");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getTransactionLabel(type: string) {
  switch (type) {
    case "income":
      return "Entrada";

    case "transfer":
      return "Aporte para meta";

    default:
      return "Gasto";
  }
}

function getTransactionAmountPrefix(type: string) {
  if (type === "income") {
    return "+";
  }

  if (type === "transfer") {
    return "↗";
  }

  return "-";
}

export default function TransactionsScreen() {
  const { transactions, loading, error, reload } = useTransactions();
  const { accounts } = useAccounts();
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();

  const [filters, setFilters] = useState<TransactionFilters>(
    emptyTransactionFilters,
  );

  const [categories, setCategories] = useState<Category[]>([]);

  /** Id da transação com o seletor de categoria aberto. */
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

  /**
   * No load carregamos as categorias reais do banco (antes a tela chutava
   * "Categoria 3" a partir do id). Não usa hook porque é dado estático do
   * ponto de vista da tela: não muda enquanto ela está aberta.
   */
  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((err) => {
        console.error("Erro ao carregar categorias:", err);
        setCategories([]);
      });
  }, []);

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const hasActiveFilters = hasActiveTransactionFilters(filters);

  function updateFilters(patch: Partial<TransactionFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function clearFilters() {
    setFilters(emptyTransactionFilters);
  }

  /**
   * A filtragem é do service: aqui só desenhamos o resultado.
   * `useMemo` evita refiltrar a cada render (tecla digitada, animação etc.).
   */
  const visibleTransactions = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters],
  );

  /** Total do que está visível, para dar contexto ao resumo da lista. */
  const visibleTotals = useMemo(() => {
    return visibleTransactions.reduce(
      (totals, item) => {
        if (item.type === "income") totals.income += item.amount;
        if (item.type === "expense") totals.expense += item.amount;

        return totals;
      },
      { income: 0, expense: 0 },
    );
  }, [visibleTransactions]);

  /** Categorias que realmente aparecem na lista, para não poluir o filtro. */
  const availableCategories = useMemo(() => {
    const ids = new Set<number>();

    transactions.forEach((item) => {
      if (item.categoryId !== null) ids.add(item.categoryId);
    });

    return categories.filter((category) => ids.has(category.id));
  }, [transactions, categories]);

  /*
   * Cartão é uma conta do tipo `credit_card`, mas o filtro precisa ser
   * oferecido separado: "de onde saiu o dinheiro" (conta) e "em qual
   * cartão" são perguntas diferentes para o usuário.
   */
  const creditCards = useMemo(
    () => accounts.filter((account) => account.type === "credit_card"),
    [accounts],
  );

  const regularAccounts = useMemo(
    () => accounts.filter((account) => account.type !== "credit_card"),
    [accounts],
  );

  /** Ids das contas que são cartão, para marcar a transação na listagem. */
  const cardAccountIds = useMemo(
    () => new Set(creditCards.map((card) => card.id)),
    [creditCards],
  );

  /**
   * Troca a categoria de uma transação sem sair da lista.
   * Passa pelo service, que é quem decide se a edição é permitida
   * (aportes de meta, por exemplo, não são editáveis).
   */
  async function handleChangeCategory(
    transaction: TransactionWithRelations,
    categoryId: number | null,
  ) {
    setEditingCategoryId(null);

    try {
      await editTransaction(transaction.id, {
        amount: transaction.amount,
        type: transaction.type,
        description: transaction.description,
        categoryId,
        accountId: transaction.accountId ?? 0,
      });

      await reload();
    } catch (changeError) {
      console.error("Erro ao alterar categoria:", changeError);

      const message =
        changeError instanceof Error
          ? changeError.message
          : "Não foi possível alterar a categoria.";

      Alert.alert("Não foi possível alterar", message);
    }
  }

  function handleDelete(transaction: TransactionWithRelations) {
    const isGoalContribution = transaction.type === "transfer" || transaction.goalId !== null;

    const isCardTransaction =
      transaction.accountId !== null &&
      cardAccountIds.has(transaction.accountId);

    const description = transaction.description || "Sem descrição";

    /*
     * O alerta mostra o que vai ser apagado e QUEM é afetado: excluir uma
     * transação mexe no saldo da conta ou no limite do cartão, então o
     * usuário precisa confirmar sabendo qual.
     */
    const impactMessage = isGoalContribution
      ? "O valor será devolvido ao saldo da conta e retirado da meta."
      : isCardTransaction
        ? "O valor sairá do limite usado do cartão, liberando limite disponível."
        : "O valor será devolvido ao saldo da conta.";

    Alert.alert(
      "Excluir transação",
      `${description} · ${formatCurrency(transaction.amount)}\n\n${impactMessage}`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await removeTransaction(transaction.id);
              await reload();
            } catch (deleteError) {
              console.error("Erro ao excluir transação:", deleteError);

              const message =
                deleteError instanceof Error
                  ? deleteError.message
                  : "Não foi possível excluir a transação.";

              Alert.alert("Não foi possível excluir", message);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <FadeInView style={styles.center}>
        <Text>Carregando transações...</Text>
      </FadeInView>
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
      <Text style={styles.title}>Transações</Text>

      <Text style={styles.subtitle}>
        {visibleTransactions.length === 0
          ? "Nenhuma transação registrada."
          : `${visibleTransactions.length} ${
              visibleTransactions.length === 1 ? "transação" : "transações"
            }`}
      </Text>

      {visibleTransactions.length > 0 && (
        <View style={styles.totalsRow}>
          <Text style={styles.incomeTotals}>
            + {formatCurrency(visibleTotals.income)}
          </Text>

          <Text style={styles.expenseTotals}>
            − {formatCurrency(visibleTotals.expense)}
          </Text>
        </View>
      )}

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>

        <TextInput
          style={styles.searchInput}
          value={filters.search}
          onChangeText={(value) => updateFilters({ search: value })}
          placeholder="Buscar por descrição, estabelecimento, categoria ou conta"
          placeholderTextColor={colors.textSubtle}
          autoCorrect={false}
          returnKeyType="search"
        />

        {filters.search.trim().length > 0 && (
          <AnimatedPressable
            pressedScale={0.9}
            pressedOpacity={0.6}
            onPress={() => updateFilters({ search: "" })}
          >
            <Text style={styles.clearSearch}>✕</Text>
          </AnimatedPressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {([
          ["all", "Todas"],
          ["income", "Entradas"],
          ["expense", "Gastos"],
          ["transfer", "Aportes"],
        ] as [TransactionTypeFilter, string][]).map(([value, label]) => (
          <AnimatedPressable
            key={value}
            pressedScale={0.94}
            style={[
              styles.filterButton,
              filters.type === value && styles.filterButtonActive,
            ]}
            onPress={() => updateFilters({ type: value })}
          >
            <Text
              style={
                filters.type === value
                  ? styles.filterTextActive
                  : styles.filterText
              }
            >
              {label}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {([
          ["all", "Qualquer período"],
          ["month", "Este mês"],
          ["last30", "Últimos 30 dias"],
          ["last90", "Últimos 90 dias"],
        ] as [TransactionPeriodFilter, string][]).map(([value, label]) => (
          <AnimatedPressable
            key={value}
            pressedScale={0.94}
            style={[
              styles.filterButton,
              filters.period === value && styles.filterButtonActive,
            ]}
            onPress={() => updateFilters({ period: value })}
          >
            <Text
              style={
                filters.period === value
                  ? styles.filterTextActive
                  : styles.filterText
              }
            >
              {label}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {([
          ["all", "Qualquer origem"],
          ["manual", "Manual"],
          ["automatic", "Automático"],
        ] as [TransactionOriginFilter, string][]).map(([value, label]) => (
          <AnimatedPressable
            key={value}
            pressedScale={0.94}
            style={[
              styles.filterButton,
              filters.origin === value && styles.filterButtonActive,
            ]}
            onPress={() => updateFilters({ origin: value })}
          >
            <Text
              style={
                filters.origin === value
                  ? styles.filterTextActive
                  : styles.filterText
              }
            >
              {label}
            </Text>
          </AnimatedPressable>
        ))}
      </ScrollView>

      {regularAccounts.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <AnimatedPressable
            pressedScale={0.94}
            style={[
              styles.filterButton,
              filters.accountId === null && styles.filterButtonActive,
            ]}
            onPress={() => updateFilters({ accountId: null })}
          >
            <Text
              style={
                filters.accountId === null
                  ? styles.filterTextActive
                  : styles.filterText
              }
            >
              Todas as contas
            </Text>
          </AnimatedPressable>

          {regularAccounts.map((account) => (
            <AnimatedPressable
              key={account.id}
              pressedScale={0.94}
              style={[
                styles.filterButton,
                filters.accountId === account.id && styles.filterButtonActive,
              ]}
              onPress={() =>
                updateFilters({
                  accountId: filters.accountId === account.id ? null : account.id,
                })
              }
            >
              <Text
                style={
                  filters.accountId === account.id
                    ? styles.filterTextActive
                    : styles.filterText
                }
              >
                {account.name}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      )}

      {/* Fileira só de cartões: filtra os gastos lançados no limite. */}
      {creditCards.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <AnimatedPressable
            pressedScale={0.94}
            style={[
              styles.filterButton,
              filters.cardId === null && styles.filterButtonActive,
            ]}
            onPress={() => updateFilters({ cardId: null })}
          >
            <Text
              style={
                filters.cardId === null
                  ? styles.filterTextActive
                  : styles.filterText
              }
            >
              💳 Todos os cartões
            </Text>
          </AnimatedPressable>

          {creditCards.map((card) => (
            <AnimatedPressable
              key={card.id}
              pressedScale={0.94}
              style={[
                styles.filterButton,
                filters.cardId === card.id && styles.filterButtonActive,
              ]}
              onPress={() =>
                updateFilters({
                  cardId: filters.cardId === card.id ? null : card.id,
                })
              }
            >
              <Text
                style={
                  filters.cardId === card.id
                    ? styles.filterTextActive
                    : styles.filterText
                }
              >
                💳 {card.name}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      )}

      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <AnimatedPressable
            pressedScale={0.94}
            style={[
              styles.filterButton,
              filters.categoryId === null && styles.filterButtonActive,
            ]}
            onPress={() => updateFilters({ categoryId: null })}
          >
            <Text
              style={
                filters.categoryId === null
                  ? styles.filterTextActive
                  : styles.filterText
              }
            >
              Todas as categorias
            </Text>
          </AnimatedPressable>

          {availableCategories.map((category) => (
            <AnimatedPressable
              key={category.id}
              pressedScale={0.94}
              style={[
                styles.filterButton,
                filters.categoryId === category.id && styles.filterButtonActive,
              ]}
              onPress={() =>
                updateFilters({
                  categoryId:
                    filters.categoryId === category.id ? null : category.id,
                })
              }
            >
              <Text
                style={
                  filters.categoryId === category.id
                    ? styles.filterTextActive
                    : styles.filterText
                }
              >
                {category.name}
              </Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      )}

      {hasActiveFilters && (
        <AnimatedPressable
          style={styles.clearButton}
          pressedScale={0.96}
          onPress={clearFilters}
        >
          <Text style={styles.clearButtonText}>Limpar filtros</Text>
        </AnimatedPressable>
      )}

      <FlatList
        data={visibleTransactions}
        keyExtractor={(item) => item.id.toString()}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          visibleTransactions.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {hasActiveFilters
                ? "Nenhuma transação encontrada"
                : "Sem transações"}
            </Text>

            <Text style={styles.emptyText}>
              {hasActiveFilters
                ? "Tente ajustar a busca ou limpar os filtros aplicados."
                : "Você ainda não possui nenhuma transação."}
            </Text>

            {hasActiveFilters ? (
              <AnimatedPressable
                style={styles.emptyButton}
                pressedOpacity={0.85}
                onPress={clearFilters}
              >
                <Text style={styles.emptyButtonText}>Limpar filtros</Text>
              </AnimatedPressable>
            ) : (
              <AnimatedPressable
                style={styles.emptyButton}
                pressedOpacity={0.85}
                onPress={() => router.push("/transaction/new")}
              >
                <Text style={styles.emptyButtonText}>
                  + Adicionar transação
                </Text>
              </AnimatedPressable>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const isIncome = item.type === "income";

          const isGoalContribution =
            item.type === "transfer" && item.goalId !== null;

          const isAutomatic = item.isAutomatic;

          const categoryName =
            (item.categoryId !== null
              ? categoryNameById.get(item.categoryId)
              : null) ??
            item.categoryName ??
            "Sem categoria";

          const isEditingCategory = editingCategoryId === item.id;

          const isCardTransaction =
            item.accountId !== null && cardAccountIds.has(item.accountId);

          return (
            <AnimatedListItem index={index} style={styles.transactionCard}>
              <View style={styles.transactionHeader}>
                <View style={styles.transactionInfo}>
                  <View style={styles.labelRow}>
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
                        {getTransactionLabel(item.type)}
                      </Text>
                    </View>

                    {/*
                     * Origem: separa o que o usuário lançou do que veio de
                     * notificação/importação. O círculo (🟢/🔵) é o código
                     * visual que a leitura automática de notificações vai
                     * reaproveitar quando entrar.
                     */}
                    <View
                      style={[
                        styles.sourceBadge,
                        isAutomatic && styles.automaticBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sourceBadgeText,
                          isAutomatic && styles.automaticBadgeText,
                        ]}
                      >
                        {isAutomatic ? "🟢 Automática" : "🔵 Manual"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.transactionDescription}>
                    {item.description || "Sem descrição"}
                  </Text>

                  <Text style={styles.transactionMeta}>
                    {formatTransactionDate(item.date)}
                    {item.accountName
                      ? ` · ${isCardTransaction ? "💳 " : ""}${item.accountName}`
                      : ""}
                  </Text>
                </View>

                <View style={styles.transactionRight}>
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
                    {getTransactionAmountPrefix(item.type)}{" "}
                    {formatCurrency(item.amount)}
                  </Text>

                  <View style={styles.cardButtons}>
                    {!isGoalContribution && (
                      <AnimatedPressable
                        style={styles.editButton}
                        pressedScale={0.93}
                        onPress={() =>
                          router.push({
                            pathname: "/transaction/edit",
                            params: { id: String(item.id) },
                          })
                        }
                      >
                        <Text style={styles.editButtonText}>Editar</Text>
                      </AnimatedPressable>
                    )}

                    <AnimatedPressable
                      style={styles.deleteButton}
                      pressedScale={0.93}
                      onPress={() => handleDelete(item)}
                    >
                      <Text style={styles.deleteButtonText}>Excluir</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              </View>

              {/* Edição rápida de categoria: o ajuste mais frequente do dia
                  a dia, sem abrir a tela de edição completa. */}
              {isGoalContribution ? (
                <Text style={styles.goalHint}>
                  Aporte para a meta {item.goalName ?? ""}
                </Text>
              ) : !isEditingCategory ? (
                <AnimatedPressable
                  pressedScale={0.97}
                  pressedOpacity={0.7}
                  style={styles.categoryChip}
                  onPress={() => setEditingCategoryId(item.id)}
                >
                  <Text style={styles.categoryChipText}>
                    🏷️ {categoryName} · trocar
                  </Text>
                </AnimatedPressable>
              ) : (
                <View style={styles.categoryPicker}>
                  <Text style={styles.categoryPickerLabel}>
                    Escolha a categoria
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryOptions}
                  >
                    {categories.map((category) => (
                      <AnimatedPressable
                        key={category.id}
                        pressedScale={0.94}
                        style={[
                          styles.categoryOption,
                          item.categoryId === category.id &&
                            styles.categoryOptionActive,
                        ]}
                        onPress={() =>
                          handleChangeCategory(item, category.id)
                        }
                      >
                        <Text
                          style={
                            item.categoryId === category.id
                              ? styles.categoryOptionTextActive
                              : styles.categoryOptionText
                          }
                        >
                          {category.name}
                        </Text>
                      </AnimatedPressable>
                    ))}

                    <AnimatedPressable
                      pressedScale={0.94}
                      style={styles.categoryOption}
                      onPress={() => handleChangeCategory(item, null)}
                    >
                      <Text style={styles.categoryOptionText}>
                        Sem categoria
                      </Text>
                    </AnimatedPressable>
                  </ScrollView>

                  <AnimatedPressable
                    pressedScale={0.94}
                    pressedOpacity={0.7}
                    onPress={() => setEditingCategoryId(null)}
                  >
                    <Text style={styles.cancelLink}>Cancelar</Text>
                  </AnimatedPressable>
                </View>
              )}
            </AnimatedListItem>
          );
        }}
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: colors.textMuted,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },

  searchIcon: {
    marginRight: 8,
    fontSize: 14,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },

  clearSearch: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textSubtle,
  },

  totalsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },

  incomeTotals: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.income,
  },

  expenseTotals: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.expense,
  },

  transactionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  sourceBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: colors.surfaceMuted,
  },

  automaticBadge: {
    backgroundColor: colors.accentSurface,
  },

  sourceBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },

  automaticBadgeText: {
    color: colors.primary,
  },

  cardButtons: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },

  categoryChip: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },

  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },

  categoryPicker: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  categoryPickerLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },

  categoryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },

  categoryOptionActive: {
    backgroundColor: colors.primary,
  },

  categoryOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },

  categoryOptionTextActive: {
    color: colors.onPrimary,
  },

  cancelLink: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSubtle,
  },

  goalHint: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },

  filters: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 2,
  },

  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },

  filterButtonActive: {
    backgroundColor: colors.primary,
  },

  filterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  filterTextActive: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: "700",
  },

  list: {
    paddingTop: 24,
    paddingBottom: 32,
    gap: 12,
  },

  emptyList: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },

  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: colors.textMuted,
  },

  emptyButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },

  emptyButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onPrimary,
  },

  clearButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.accentSurface,
  },

  clearButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },

  transactionCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },

  incomeBadge: {
    backgroundColor: colors.incomeSurface,
  },

  expenseBadge: {
    backgroundColor: colors.expenseSurface,
  },

  goalBadge: {
    backgroundColor: colors.accentSurface,
  },

  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  incomeBadgeText: {
    color: colors.income,
  },

  expenseBadgeText: {
    color: colors.expense,
  },

  goalBadgeText: {
    color: colors.primary,
  },

  transactionDescription: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },

  transactionMeta: {
    marginTop: 5,
    fontSize: 13,
    color: colors.textSubtle,
  },

  transactionRight: {
    alignItems: "flex-end",
  },

  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },

  income: {
    color: colors.income,
  },

  expense: {
    color: colors.expense,
  },

  goal: {
    color: colors.primary,
  },

  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.expenseSurface,
  },

  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.accentSurface,
  },

  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },

  deleteButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.expense,
  },
  });
