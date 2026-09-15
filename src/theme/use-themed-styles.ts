import { useMemo } from "react";

import { StyleSheet } from "react-native";

import { ThemeColors, useThemeColors } from "./colors";

/**
 * Cria estilos que dependem da paleta do tema atual.
 *
 * Uso:
 *   const createStyles = (colors: ThemeColors) =>
 *     StyleSheet.create({ ... });
 *
 *   const styles = useThemedStyles(createStyles);
 *
 * O contrato é deliberadamente simples: a fábrica devolve o objeto JÁ passado
 * pelo `StyleSheet.create`. É isso que dá ao objeto de estilos a mesma
 * inferência contextual do React Native, onde literais como
 * `alignItems: "center"` são validados em vez de alargados para `string`.
 *
 * Memoizado por paleta: trocar o tema do celular recria os estilos uma única
 * vez, sem recriar a cada render.
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  createStyles: (colors: ThemeColors) => T,
): T {
  const colors = useThemeColors();

  return useMemo(() => createStyles(colors), [colors, createStyles]);
}
