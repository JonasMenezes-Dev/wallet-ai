import { useColorScheme } from "react-native";

export type ThemeColors = {
  /** Fundo geral das telas. */
  background: string;
  /** Superfície de cards, formulários e inputs. */
  surface: string;
  /** Superfície levemente destacada (boxes internos, trilhas). */
  surfaceMuted: string;
  /** Texto principal. */
  text: string;
  /** Texto secundário. */
  textMuted: string;
  /** Texto terciário / placeholders. */
  textSubtle: string;
  /** Bordas e divisores. */
  border: string;
  /** Cor de marca (azul). */
  primary: string;
  /** Texto sobre a cor de marca. */
  onPrimary: string;
  /** Entradas / valores positivos. */
  income: string;
  /** Fundo suave para entradas. */
  incomeSurface: string;
  /** Gastos / valores negativos. */
  expense: string;
  /** Fundo suave para gastos. */
  expenseSurface: string;
  /** Destaque em azul suave (badges, chips). */
  accentSurface: string;
  /** Aviso de prazo vencido. */
  warning: string;
  /** Fundo do aviso de prazo vencido. */
  warningSurface: string;
};

export const lightColors: ThemeColors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F3F4F6",
  text: "#111827",
  textMuted: "#6B7280",
  textSubtle: "#9CA3AF",
  border: "#E5E7EB",
  primary: "#174EA6",
  onPrimary: "#FFFFFF",
  income: "#15803D",
  incomeSurface: "#DCFCE7",
  expense: "#DC2626",
  expenseSurface: "#FEE2E2",
  accentSurface: "#E8F0FE",
  warning: "#9A3412",
  warningSurface: "#FFF4ED",
};

export const darkColors: ThemeColors = {
  background: "#0B1120",
  surface: "#151C2C",
  surfaceMuted: "#1E2637",
  text: "#F3F4F6",
  textMuted: "#9CA3AF",
  textSubtle: "#6B7280",
  border: "#2A3446",
  primary: "#5B8DEF",
  onPrimary: "#0B1120",
  income: "#4ADE80",
  incomeSurface: "#14361F",
  expense: "#F87171",
  expenseSurface: "#3B1618",
  accentSurface: "#1B2A45",
  warning: "#FDBA74",
  warningSurface: "#3A2415",
};

export const themes = {
  light: lightColors,
  dark: darkColors,
} as const;

export type ThemeName = keyof typeof themes;

/**
 * Retorna a paleta conforme o tema do sistema (claro ou escuro).
 * O app acompanha o celular e não tem alternância manual.
 */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();

  return scheme === "dark" ? darkColors : lightColors;
}

export function useThemeName(): ThemeName {
  const scheme = useColorScheme();

  return scheme === "dark" ? "dark" : "light";
}
