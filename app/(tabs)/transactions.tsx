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
import { PremiumScreen } from "../../src/components/PremiumScreen";
import { TransactionFilterPanel } from "../../src/components/TransactionFilterPanel";
import { WalletSymbol } from "../../src/components/WalletSymbol";
import { AppState } from "../../src/components/AppState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { useAccounts } from "../../src/hooks/use-accounts";
import { useTransactions } from "../../src/hooks/use-transactions";
import { listCategories } from "../../src/services/category.service";
import {
  editTransaction,
  removeTransaction,
} from "../../src/services/transaction.service";
import { ThemeColors, typography, useThemeColors, useThemedStyles } from "../../src/theme";
import type { Category } from "../../src/types/category";
import {
  emptyTransactionFilters,
  filterTransactions,
  hasActiveTransactionFilters,
  type TransactionFilters,
} from "../../src/types/transaction-filters";
import type { TransactionWithRelations } from "../../src/types/transaction";
import { formatTransactionDateTime } from "../../src/utils/date-time";

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function getTransactionLabel(type: string, isAccountTransfer = false) {
  if (type === "transfer" && isAccountTransfer) return "Transferência";
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

  const [filterPanelVisible, setFilterPanelVisible] = useState(false);

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
    const isGoalContribution = transaction.type === "transfer" && transaction.goalId !== null;
    const isAccountTransfer = Boolean(transaction.transferId);

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
      ? transaction.goalMovement === "withdrawal"
        ? "O valor será retirado da conta e devolvido à meta."
        : "O valor será devolvido ao saldo da conta e retirado da meta."
      : isAccountTransfer
        ? "A transferência inteira será removida e os saldos das duas contas serão restaurados."
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
      <PremiumScreen><AppState variant="loading" title="Carregando transações" /></PremiumScreen>
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
    <PremiumScreen style={styles.container}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        ListHeaderComponent={<View style={styles.listHeader}>
      <ScreenHeader
        title="Transações"
        subtitle={
          visibleTransactions.length === 0
            ? "Nenhuma transação registrada."
            : `${visibleTransactions.length} ${
                visibleTransactions.length === 1 ? "transação" : "transações"
              }`
        }
        eyebrow="Movimentações"
      />

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
        <WalletSymbol name="search" color={colors.textMuted} size={20} />

        <TextInput
          accessibilityLabel="Buscar transações"
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
            accessibilityRole="button"
            accessibilityLabel="Limpar busca"
            style={styles.clearSearchButton}
            onPress={() => updateFilters({ search: "" })}
          >
            <WalletSymbol name="close" color={colors.textMuted} size={18} />
          </AnimatedPressable>
        )}
      </View>

      <AnimatedPressable accessibilityRole="button" accessibilityLabel="Abrir filtros de transações" onPress={() => setFilterPanelVisible(true)} style={styles.filterPanelButton}>
        <WalletSymbol name="filter" color={colors.primary} size={20} />
        <Text style={styles.filterPanelTitle}>Filtros</Text>
        <Text style={styles.filterPanelCount}>{[filters.search.trim() !== "", filters.type !== "all", filters.period !== "all", filters.origin !== "all", filters.accountId !== null, filters.cardId !== null, filters.categoryId !== null].filter(Boolean).length} ativos</Text>
        <WalletSymbol name="chevron" color={colors.primary} size={18} />
      </AnimatedPressable>

      {hasActiveFilters && (
        <AnimatedPressable
          style={styles.clearButton}
          pressedScale={0.96}
          onPress={clearFilters}
        >
          <Text style={styles.clearButtonText}>Limpar filtros</Text>
        </AnimatedPressable>
      )}


        </View>}
        data={visibleTransactions}
        keyExtractor={(item) => item.id.toString()}
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
          const isAccountTransfer = Boolean(item.transferId);

          const isAutomatic = item.isAutomatic;

          const categoryName =
            (item.categoryId !== null
              ? categoryNameById.get(item.categoryId)
              : null) ??
            item.categoryName ??
            "Sem categoria";

          const isEditingCategory = editingCategoryId === item.id;

          return (
            <AnimatedListItem index={index} style={styles.transactionCard}>
              <View style={styles.transactionHeader}>
                <View style={[styles.transactionIcon, { backgroundColor: isIncome ? colors.incomeSurface : colors.accentSurface }]}>
                  <WalletSymbol name={isIncome ? "income" : isGoalContribution || isAccountTransfer ? "transfer" : "receipt"} color={isIncome ? colors.income : isGoalContribution || isAccountTransfer ? colors.primary : colors.expense} size={19} />
                </View>
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
                        {item.goalMovement === "withdrawal" ? "Resgate de meta" : getTransactionLabel(item.type, isAccountTransfer)}
                      </Text>
                    </View>

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
                        {isAutomatic ? "Automática" : "Manual"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.transactionDescription}>
                    {item.description || "Sem descrição"}
                  </Text>

                  <Text style={styles.transactionMeta}>
                    {formatTransactionDateTime(item.date)}
                    {item.accountName
                      ? ` · ${item.accountName}`
                      : ""}
                    {item.counterpartyAccountName ? ` ↔ ${item.counterpartyAccountName}` : ""}
                  </Text>
                </View>

                <View style={styles.transactionRight}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      isIncome
                        ? styles.income
                        : isGoalContribution || isAccountTransfer
                          ? styles.goal
                          : styles.expense,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.68}
                  >
                    {getTransactionAmountPrefix(item.type)}{" "}
                    {formatCurrency(item.amount)}
                  </Text>


                </View>
              </View>

                  <View style={styles.cardButtons}>
                    {!isAccountTransfer && (
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

              {/* Edição rápida de categoria: o ajuste mais frequente do dia
                  a dia, sem abrir a tela de edição completa. */}
              {isGoalContribution || isAccountTransfer ? (
                <Text style={styles.goalHint}>
                  {isAccountTransfer ? "Transferência entre contas" : `Aporte para a meta ${item.goalName ?? ""}`}
                </Text>
              ) : !isEditingCategory ? (
                <AnimatedPressable
                  pressedScale={0.97}
                  pressedOpacity={0.7}
                  style={styles.categoryChip}
                  onPress={() => setEditingCategoryId(item.id)}
                >
                  <Text style={styles.categoryChipText}>
                    {categoryName} · trocar
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
      <TransactionFilterPanel visible={filterPanelVisible} filters={filters} accounts={accounts} categories={availableCategories} onClose={() => setFilterPanelVisible(false)} onApply={setFilters} />
      <AnimatedPressable accessibilityRole="button" accessibilityLabel="Nova transação" onPress={() => router.push("/transaction/new")} style={styles.fab}>
        <WalletSymbol name="plus" color={colors.onPrimary} size={26} />
      </AnimatedPressable>
    </PremiumScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  listHeader: { paddingBottom: 8 },
  transactionIcon: { width: 36, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 10 },
  clearSearchButton: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  filterPanelButton: { minHeight: 54, padding: 16, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 15, backgroundColor: colors.accentSurface },
  filterPanelTitle: { fontFamily: typography.family.bold,  flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  filterPanelCount: { fontFamily: typography.family.regular,  fontSize: 12, color: colors.primary },
  fab: { position: "absolute", right: 24, bottom: 24, width: 60, height: 55, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, elevation: 2 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: colors.background,
  },

  errorText: { fontFamily: typography.family.regular,  fontSize: 14, textAlign: "center", color: colors.expense, marginHorizontal: 24 },
  retryButton: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primary },
  retryButtonText: { fontFamily: typography.family.bold,  fontSize: 14, fontWeight: "700", color: colors.onPrimary },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  title: { fontFamily: typography.family.bold,
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
  },

  subtitle: { fontFamily: typography.family.regular,
    marginTop: 8,
    fontSize: 15,
    color: colors.textMuted,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 55,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  searchIcon: { fontFamily: typography.family.regular,
    marginRight: 8,
    fontSize: 14,
  },

  searchInput: { fontFamily: typography.family.regular,
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },

  clearSearch: { fontFamily: typography.family.bold,
    fontSize: 15,
    fontWeight: "700",
    color: colors.textSubtle,
  },

  totalsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },

  incomeTotals: { fontFamily: typography.family.bold,
    fontSize: 13,
    fontWeight: "700",
    color: colors.income,
  },

  expenseTotals: { fontFamily: typography.family.bold,
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

  sourceBadgeText: { fontFamily: typography.family.bold,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },

  automaticBadgeText: {
    color: colors.primary,
  },

  cardButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 8,
  },

  categoryChip: {
    alignSelf: "stretch",
    marginTop: 12,
    paddingTop: 12,
    minHeight: 44,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  categoryChipText: { fontFamily: typography.family.bold,
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

  categoryPickerLabel: { fontFamily: typography.family.bold,
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
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },

  categoryOptionActive: {
    backgroundColor: colors.primary,
  },

  categoryOptionText: { fontFamily: typography.family.bold,
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },

  categoryOptionTextActive: {
    color: colors.onPrimary,
  },

  cancelLink: { fontFamily: typography.family.bold,
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSubtle,
  },

  goalHint: { fontFamily: typography.family.bold,
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
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },

  filterButtonActive: {
    backgroundColor: colors.primary,
  },

  filterText: { fontFamily: typography.family.bold,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  filterTextActive: { fontFamily: typography.family.bold,
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: "700",
  },

  list: {
    paddingTop: 18,
    paddingBottom: 100,
    gap: 12,
  },

  emptyList: {
    flexGrow: 1,
    paddingBottom: 100,
  },

  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  emptyTitle: { fontFamily: typography.family.bold,
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },

  emptyText: { fontFamily: typography.family.regular,
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

  emptyButtonText: { fontFamily: typography.family.bold,
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

  clearButtonText: { fontFamily: typography.family.bold,
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },

  transactionCard: {
    padding: 20,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
  },

  transactionInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },

  labelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
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

  typeBadgeText: { fontFamily: typography.family.bold,
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

  transactionDescription: { fontFamily: typography.family.bold,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },

  transactionMeta: { fontFamily: typography.family.regular,
    marginTop: 5,
    fontSize: 13,
    color: colors.textSubtle,
  },

  transactionRight: {
    alignItems: "flex-end",
    flexShrink: 1,
    maxWidth: "48%",
  },

  transactionAmount: { fontFamily: typography.family.bold,
    maxWidth: "100%",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
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
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.expenseSurface,
  },

  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.accentSurface,
  },

  editButtonText: { fontFamily: typography.family.bold,
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },

  deleteButtonText: { fontFamily: typography.family.bold,
    fontSize: 12,
    fontWeight: "600",
    color: colors.expense,
  },
  });
