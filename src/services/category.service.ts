import { getAllCategories } from '../repositories/category.repository';
import { Category } from '../types/category';

export async function listCategories(): Promise<Category[]> {
  return getAllCategories();
}

/** Escolhe uma categoria usando palavras-chave do estabelecimento/descrição. */
export function suggestCategoryId(
  description: string,
  categories: Category[],
  fallback: number | null,
): number | null {
  const normalized = description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const keywords: Record<string, string[]> = {
    Alimentacao: ['mercadinho', 'mercado', 'supermercado', 'ifood', 'restaurante', 'lanchonete', 'padaria', 'comida'],
    Transporte: ['uber', '99', 'posto', 'gasolina', 'estacionamento', 'onibus', 'metro'],
    Moradia: ['aluguel', 'condominio', 'energia', 'luz', 'agua', 'gas'],
    Assinaturas: ['netflix', 'spotify', 'prime', 'streaming'],
    Saude: ['farmacia', 'hospital', 'consulta', 'academia'],
    Compras: ['shopping', 'loja', 'magalu', 'amazon', 'mercadolivre'],
    Lazer: ['cinema', 'bar', 'show', 'jogo'],
  };

  const match = Object.entries(keywords).find(([, terms]) =>
    terms.some((term) => normalized.includes(term)),
  );

  if (!match) return fallback;

  const category = categories.find((item) =>
    item.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase() === match[0].toLowerCase(),
  );

  return category?.id ?? fallback;
}