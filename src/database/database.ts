import * as SQLite from "expo-sqlite";

import { runMigrations } from "./migrations";

const DATABASE_NAME = "wallet-ai.db";

let db: SQLite.SQLiteDatabase | null = null;
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = initializeDatabase();

  try {
    db = await databasePromise;

    return db;
  } finally {
    databasePromise = null;
  }
}

async function initializeDatabase() {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY NOT NULL,
      salary REAL NOT NULL DEFAULT 0,
      benefit_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      limit_amount REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      merchant TEXT,
      date TEXT NOT NULL,
      category_id INTEGER,
      account_id INTEGER,
      payment_method TEXT,
      is_automatic INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (category_id)
        REFERENCES categories(id),

      FOREIGN KEY (account_id)
        REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      deadline TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await runMigrations(database);
  await seedCategories(database);

  return database;
}

async function seedCategories(database: SQLite.SQLiteDatabase) {
  const categories = [
    "Alimentação",
    "Moradia",
    "Transporte",
    "Lazer",
    "Compras",
    "Contas",
    "Saúde",
    "Educação",
    "Assinaturas",
    "Outros",
  ];

  const now = new Date().toISOString();

  for (const category of categories) {
    await database.runAsync(
      `
        INSERT OR IGNORE INTO categories (
          name,
          created_at,
          updated_at,
          is_default
        )
        VALUES ($name, $createdAt, $updatedAt, 1)
      `,
      {
        $name: category,
        $createdAt: now,
        $updatedAt: now,
      },
    );
  }
}
