import type * as SQLite from "expo-sqlite";

interface Migration {
  version: number;
  name: string;
  up: (database: SQLite.SQLiteDatabase) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "goal-and-onboarding-columns",
    up: async (database) => {
      await addColumnIfMissing(database, "transactions", "goal_id", "INTEGER");
      await addColumnIfMissing(
        database,
        "user_settings",
        "onboarding_completed",
        "INTEGER NOT NULL DEFAULT 0",
      );
    },
  },
  {
    version: 2,
    name: "external-transaction-identifiers",
    up: async (database) => {
      await addColumnIfMissing(database, "transactions", "external_id", "TEXT");
      await addColumnIfMissing(database, "transactions", "provider", "TEXT");
      await addColumnIfMissing(database, "transactions", "institution", "TEXT");
      await database.execAsync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_source
        ON transactions (external_id, provider, institution)
        WHERE external_id IS NOT NULL;
      `);
    },
  },
  {
    /*
     * Prepara transações automáticas e cria índices usados nas consultas.
     */
    version: 3,
    name: "automatic-transactions-readiness",
    up: async (database) => {
      await addColumnIfMissing(
        database,
        "transactions",
        "source",
        "TEXT NOT NULL DEFAULT 'manual'",
      );
      await addColumnIfMissing(
        database,
        "transactions",
        "is_automatic",
        "INTEGER NOT NULL DEFAULT 0",
      );

      await database.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_transactions_date
        ON transactions (date DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_account
        ON transactions (account_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_category
        ON transactions (category_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_goal
        ON transactions (goal_id)
        WHERE goal_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_transactions_source
        ON transactions (source);
      `);
    },
  },
  {
    /*
     * Prepara categorias para identidade visual e personalização futura.
     */
    version: 4,
    name: "custom-categories-readiness",
    up: async (database) => {
      await addColumnIfMissing(database, "categories", "color", "TEXT");
      await addColumnIfMissing(database, "categories", "icon", "TEXT");
      await addColumnIfMissing(
        database,
        "categories",
        "is_default",
        "INTEGER NOT NULL DEFAULT 0",
      );
      await addColumnIfMissing(database, "categories", "updated_at", "TEXT");

      await database.execAsync(`
        UPDATE categories
        SET is_default = 1
        WHERE is_default = 0;
        CREATE INDEX IF NOT EXISTS idx_categories_name
        ON categories (name);
      `);
    },
  },
  {
    /*
     * Limite de crédito: contas existentes permanecem sem limite informado.
     */
    version: 5,
    name: "account-credit-limit",
    up: async (database) => {
      await addColumnIfMissing(database, "accounts", "limit_amount", "REAL");
    },
  },
  {
    /*
     * Padroniza cartões antigos para balance positivo = valor utilizado.
     * A magnitude é preservada; só o sinal legado é normalizado.
     */
    version: 6,
    name: "normalize-credit-card-balance",
    up: async (database) => {
      await database.runAsync(`
        UPDATE accounts
        SET balance = ABS(balance)
        WHERE type = 'credit_card'
          AND balance < 0
      `);
    },
  },
  {
    version: 7,
    name: "monthly-category-budgets",
    up: async (database) => {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS monthly_budgets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL,
          month_key TEXT NOT NULL,
          amount REAL NOT NULL CHECK (amount > 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (category_id, month_key),
          FOREIGN KEY (category_id) REFERENCES categories(id)
        );

        CREATE INDEX IF NOT EXISTS idx_monthly_budgets_month
        ON monthly_budgets (month_key);
      `);
    },
  },
  {
    version: 8,
    name: "recurring-cashflow-items",
    up: async (database) => {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS recurring_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
          amount REAL NOT NULL CHECK (amount > 0),
          category_id INTEGER,
          next_due_date TEXT NOT NULL,
          due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
          frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency = 'monthly'),
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (category_id) REFERENCES categories(id)
        );

        CREATE INDEX IF NOT EXISTS idx_recurring_items_due
        ON recurring_items (is_active, next_due_date);
      `);
    },
  },
];

export async function runMigrations(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  const current = await database.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  let version = current?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= version) continue;

    await database.withTransactionAsync(async () => {
      await migration.up(database);
      await database.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    version = migration.version;
  }
}

async function addColumnIfMissing(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );

  if (columns.some((item) => item.name === column)) return;

  await database.execAsync(
    `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
  );
}
