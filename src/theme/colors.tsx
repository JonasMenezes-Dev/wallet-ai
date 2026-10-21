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
  background: "#F3F8F5",
  surface: "#FFFFFF",
  surfaceMuted: "#E8F2EC",
  text: "#102B1F",
  textMuted: "#506B5D",
  textSubtle: "#627B6E",
  border: "#CCDED3",
  primary: "#146348",
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
  background: "#091611",
  surface: "#11241C",
  surfaceMuted: "#183329",
  text: "#E9F7ED",
  textMuted: "#9BAFA3",
  textSubtle: "#88A495",
  border: "#294B3B",
  primary: "#51D9A0",
  onPrimary: "#091611",
  income: "#51D9A0",
  incomeSurface: "#183E2E",
  expense: "#F18B91",
  expenseSurface: "#392326",
  accentSurface: "#183E2E",
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
