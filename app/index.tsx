import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useThemeColors } from '../src/theme';
import { ThemeColors, useThemedStyles } from '../src/theme';
import { AnimatedPressable } from '../src/components/AnimatedPressable';
import { useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useUserSettings } from '../src/hooks/use-user-settings';

export default function IndexScreen() {
  const { settings, loading } = useUserSettings();
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [introVisible, setIntroVisible] = useState(true);

  useEffect(() => {
    if (loading || introVisible) return;

    const destination = !settings || !settings.onboardingCompleted
      ? '/onboarding'
      : '/(tabs)';
    const timer = setTimeout(() => router.replace(destination), 180);

    return () => clearTimeout(timer);
  }, [settings, loading, introVisible]);

  return (
    <Animated.View entering={FadeIn.duration(420)} style={styles.container}>
      {introVisible ? (
        <Animated.View entering={FadeIn.duration(420)} style={styles.introCard}>
          <Text style={styles.brand}>Wallet.ai</Text>
          <Text style={styles.introTitle}>Seu dinheiro, mais claro.</Text>
          <Text style={styles.introText}>Organize gastos, metas e decisões em um só lugar.</Text>
          <AnimatedPressable style={styles.button} onPress={() => setIntroVisible(false)}>
            <Text style={styles.buttonText}>Começar</Text>
          </AnimatedPressable>
        </Animated.View>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Carregando Wallet.ai...</Text>
        </View>
      )}
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  introCard: { width: '100%', maxWidth: 420, padding: 28, borderRadius: 24, backgroundColor: colors.surface },
  brand: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  introTitle: { marginTop: 28, color: colors.text, fontSize: 34, fontWeight: '800' },
  introText: { marginTop: 12, color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  button: { marginTop: 28, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.primary },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  loading: { alignItems: 'center', gap: 12 },
  loadingText: { color: colors.textMuted },
});