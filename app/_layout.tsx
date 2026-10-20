import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { screenTransition } from "../src/animations";
import { WalletSymbol } from "../src/components/WalletSymbol";
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
              gap: 14,
            }}
          >
            <View
              accessibilityLabel="Wallet.ai"
              style={{
                width: 82,
                height: 82,
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.accentSurface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <WalletSymbol name="accounts" color={colors.primary} size={44} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: 24,
                fontWeight: "800",
                letterSpacing: -0.7,
              }}
            >
              wallet<Text style={{ color: "#00B894" }}>.ai</Text>
            </Text>
            <ActivityIndicator color={colors.primary} style={{ marginTop: 4 }} />
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
