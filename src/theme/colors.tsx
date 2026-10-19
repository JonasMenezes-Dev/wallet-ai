import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { getDatabase } from "../database/database";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  primary: string;
  onPrimary: string;
  income: string;
  incomeSurface: string;
  expense: string;
  expenseSurface: string;
  accentSurface: string;
  warning: string;
  warningSurface: string;
};

export const lightColors: ThemeColors = {
  background: "#F4F7F4",
  surface: "#FFFFFF",
  surfaceMuted: "#EDF2EE",
  text: "#1D2B24",
  textMuted: "#5F6F66",
  textSubtle: "#849188",
  border: "#DEE7E0",
  primary: "#174D3D",
  onPrimary: "#FFFFFF",
  income: "#287A59",
  incomeSurface: "#E4F2E9",
  expense: "#B84E4B",
  expenseSurface: "#F9E9E7",
  accentSurface: "#E6EFE9",
  warning: "#8F5C2D",
  warningSurface: "#F8EFE4",
};

export const darkColors: ThemeColors = {
  background: "#101915",
  surface: "#19241E",
  surfaceMuted: "#223129",
  text: "#F0F5F1",
  textMuted: "#B1C0B6",
  textSubtle: "#829389",
  border: "#304238",
  primary: "#2A604B",
  onPrimary: "#FFFFFF",
  income: "#7AC4A0",
  incomeSurface: "#1C382A",
  expense: "#F08E85",
  expenseSurface: "#3D2423",
  accentSurface: "#23382D",
  warning: "#E8B77E",
  warningSurface: "#3B3023",
};

export const themes = {
  light: lightColors,
  dark: darkColors,
} as const;

export type ThemeName = keyof typeof themes;
export type ThemePreference = ThemeName | "system";

type ThemeContextValue = {
  /** Tema efetivo usado nas cores e na barra de status. */
  themeName: ThemeName;
  /** Preferência selecionada pelo usuário, incluindo o modo automático. */
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
  loading: boolean;
};

const ThemeContext = createContext<ThemeContextValue>({
  themeName: "light",
  themePreference: "system",
  setThemePreference: async () => undefined,
  loading: true,
});

type ThemeProviderProps = {
  children: ReactNode;
};

/**
 * O modo automático acompanha o tema do sistema em tempo real. Preferências
 * manuais continuam salvas no SQLite e prevalecem sobre a aparência do celular.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>("system");
  const [loading, setLoading] = useState(true);

  const themeName: ThemeName =
    themePreference === "system"
      ? systemColorScheme === "dark"
        ? "dark"
        : "light"
      : themePreference;

  useEffect(() => {
    let mounted = true;

    async function loadTheme() {
      try {
        const database = await getDatabase();

        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS app_preferences (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
          );
        `);

        const preference = await database.getFirstAsync<{ value: string }>(
          "SELECT value FROM app_preferences WHERE key = 'theme'",
        );

        if (
          mounted &&
          (preference?.value === "light" ||
            preference?.value === "dark" ||
            preference?.value === "system")
        ) {
          setThemePreferenceState(preference.value);
        }
      } catch (error) {
        console.error("Não foi possível carregar o tema:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  const setThemePreference = useCallback(
    async (nextPreference: ThemePreference) => {
      setThemePreferenceState(nextPreference);

      try {
        const database = await getDatabase();

        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS app_preferences (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
          );
        `);

        await database.runAsync(
          "INSERT INTO app_preferences (key, value) VALUES ('theme', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          nextPreference,
        );
      } catch (error) {
        console.error("Não foi possível salvar o tema:", error);
      }
    },
    [],
  );

  return (
    <ThemeContext.Provider
      value={{
        themeName,
        themePreference,
        setThemePreference,
        loading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreference() {
  return useContext(ThemeContext);
}

export function useThemeColors(): ThemeColors {
  const { themeName } = useContext(ThemeContext);
  return themes[themeName];
}

export function useThemeName(): ThemeName {
  return useContext(ThemeContext).themeName;
}
