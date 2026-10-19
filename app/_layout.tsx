import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { StatusBar } from "expo-status-bar";

import { screenTransition } from "../src/animations";
import { getDatabase } from "../src/database/database";
import {
  ThemeProvider,
  useThemeColors,
  useThemeName,
  useThemePreference,
} from "../src/theme";

function RootNavigator() {
  const colors = useThemeColors();
  const themeName = useThemeName();
  const { loading } = useThemePreference();

  if (loading) {
    return (
      <>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
        </View>
        <StatusBar style={themeName === "dark" ? "light" : "dark"} />
      </>
    );
  }

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
