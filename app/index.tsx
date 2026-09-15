import { useEffect } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useUserSettings } from '../src/hooks/use-user-settings';

export default function IndexScreen() {
  const { settings, loading } = useUserSettings();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!settings || !settings.onboardingCompleted) {
      router.replace('/onboarding');
      return;
    }

    router.replace('/(tabs)');
  }, [settings, loading]);

  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text>Carregando Wallet.ai...</Text>
    </Animated.View>
  );
}