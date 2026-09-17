import { getDatabase } from "../database/database";
import { UserSettings } from "../types/user-settings";

export async function getUserSettings(): Promise<UserSettings | null> {
  const database = await getDatabase();

  const row = await database.getFirstAsync<{
    id: number;
    salary: number;
    benefitAmount: number;
    onboardingCompleted: number;
    createdAt: string;
    updatedAt: string;
  }>(`
    SELECT
      id,
      salary,
      benefit_amount AS benefitAmount,
      onboarding_completed AS onboardingCompleted,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_settings
    LIMIT 1
  `);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    salary: row.salary,
    benefitAmount: row.benefitAmount,
    onboardingCompleted: row.onboardingCompleted === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function saveUserSettings(
  settings: Omit<UserSettings, "id" | "createdAt" | "updatedAt">,
): Promise<void> {
  const database = await getDatabase();

  const now = new Date().toISOString();

  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM user_settings");

    await database.runAsync(
      `
        INSERT INTO user_settings (
          salary,
          benefit_amount,
          onboarding_completed,
          created_at,
          updated_at
        )
        VALUES ($salary, $benefitAmount, $onboardingCompleted, $createdAt, $updatedAt)
      `,
      {
        $salary: settings.salary,
        $benefitAmount: settings.benefitAmount,
        $onboardingCompleted: settings.onboardingCompleted ? 1 : 0,
        $createdAt: now,
        $updatedAt: now,
      },
    );
  });
}