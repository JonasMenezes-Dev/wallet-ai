import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import { useUserSettings } from "../src/hooks/use-user-settings";
import { useThemeColors, useThemedStyles, type ThemeColors } from "../src/theme";

export default function IndexScreen() {
  const { settings, loading } = useUserSettings();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [introVisible, setIntroVisible] = useState(true);
  const navigationStarted = useRef(false);

  // Splash curto e automático: não exige que a pessoa toque em "Começar".
  useEffect(() => {
    const timer = setTimeout(() => setIntroVisible(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || introVisible || navigationStarted.current) return;

    navigationStarted.current = true;

    const openApp = async () => {
      // Esta permissão permite ao Wallet.ai exibir suas próprias notificações.
      if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
        try {
          const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
          const alreadyGranted = await PermissionsAndroid.check(permission);
          if (!alreadyGranted) {
            await PermissionsAndroid.request(permission);
          }
        } catch (error) {
          // A permissão é opcional; não bloqueia a entrada no aplicativo.
          console.warn("Não foi possível solicitar permissão de notificações:", error);
        }
      }

      const destination =
        !settings || !settings.onboardingCompleted ? "/onboarding" : "/(tabs)";
      router.replace(destination);
    };

    void openApp();
  }, [settings, loading, introVisible]);

  return (
    <View style={styles.container}>
      {introVisible ? (
        <Animated.View
          entering={FadeIn.duration(350)}
          exiting={FadeOut.duration(250)}
          style={styles.logoWrap}
        >
          <Animated.Text
            entering={ZoomIn.duration(650).springify()}
            style={styles.brand}
            accessibilityRole="header"
          >
            Wallet<Text style={styles.brandAccent}>.ai</Text>
          </Animated.Text>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(180)} style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Preparando seu espaço...</Text>
        </Animated.View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      padding: 24,
    },
    logoWrap: {
      alignItems: "center",
      justifyContent: "center",
    },
    brand: {
      color: colors.text,
      fontSize: 38,
      fontWeight: "900",
      letterSpacing: -1.4,
    },
    brandAccent: {
      color: colors.primary,
    },
    loading: {
      alignItems: "center",
      gap: 12,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 13,
    },
  });
