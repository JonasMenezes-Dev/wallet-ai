import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';

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
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text>Carregando Wallet.ai...</Text>
    </View>
  );
}