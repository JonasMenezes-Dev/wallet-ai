import { Stack } from "expo-router";
import { useEffect } from "react";

import { StatusBar } from "expo-status-bar";

import { screenTransition } from "../src/animations";
import { getDatabase } from "../src/database/database";
import { ThemeProvider, useThemeColors, useThemeName } from "../src/theme";

function RootNavigator() {
  const colors = useThemeColors();
  const themeName = useThemeName();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: screenTransition.animation,
          animationDuration: screenTransition.animationDuration,
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.background },
        }}
      />

      <StatusBar style={themeName === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    getDatabase().catch((error) => {
      console.error("Erro ao inicializar banco de dados:", error);
    });
  }, []);

  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
