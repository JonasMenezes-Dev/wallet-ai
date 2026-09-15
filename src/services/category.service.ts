import { getAllCategories } from '../repositories/category.repository';
import { Category } from '../types/category';

export async function listCategories(): Promise<Category[]> {
  return getAllCategories();
}