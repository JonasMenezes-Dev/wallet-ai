import type { Account } from "../types/account";

/** Resolve selections against the accounts actually offered by the form. */
export function selectTransferAccounts(
  accounts: Pick<Account, "id" | "type">[],
  selectedSource: number | null,
  selectedDestination: number | null,
): { fromAccountId: number | null; toAccountId: number | null } {
  const eligible = accounts.filter((account) => account.type !== "credit_card");
  const fromAccountId = eligible.find((account) => account.id === selectedSource)?.id
    ?? eligible[0]?.id ?? null;
  const destinations = eligible.filter((account) => account.id !== fromAccountId);
  const toAccountId = destinations.find((account) => account.id === selectedDestination)?.id
    ?? destinations[0]?.id ?? null;
  return { fromAccountId, toAccountId };
}
