import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

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
        <SafeAreaView
          edges={["top"]}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
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
        </SafeAreaView>
        <StatusBar style={themeName === "dark" ? "light" : "dark"} />
      </>
    );
  }

  return (
    <>
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            animation: screenTransition.animation,
            animationDuration: screenTransition.animationDuration,
            gestureEnabled: true,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </SafeAreaView>

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
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
