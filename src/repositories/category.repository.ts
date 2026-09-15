import { getDatabase } from '../database/database';
import { Category } from '../types/category';

export async function getAllCategories(): Promise<Category[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<Category>(`
    SELECT
      id,
      name,
      created_at AS createdAt
    FROM categories
    ORDER BY name ASC
  `);

  return rows;
}