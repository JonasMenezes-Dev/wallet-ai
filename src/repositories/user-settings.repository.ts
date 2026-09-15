import { getDatabase } from "../database/database";
import { UserSettings } from "../types/user-settings";

export async function getUserSettings(): Promise<UserSettings | null> {
  const database = await getDatabase();

  const row = await database.getFirstAsync<UserSettings>(`
    SELECT
      id,
      salary,
      benefit_amount AS benefitAmount,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_settings
    LIMIT 1
  `);

  return row ?? null;
}

export async function saveUserSettings(
  settings: Omit<UserSettings, "id" | "createdAt" | "updatedAt">,
): Promise<void> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  await database.runAsync(`
    DELETE FROM user_settings
  `);

  await database.runAsync(
    `
      INSERT INTO user_settings (
        salary,
        benefit_amount,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?)
    `,
    settings.salary,
    settings.benefitAmount,
    now,
    now,
  );
}
