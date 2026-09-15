import { StyleSheet, Text } from 'react-native';

import { FadeInView } from '../../src/components/AnimatedListItem';

export default function SettingsScreen() {
  return (
    <FadeInView style={styles.container}>
      <Text style={styles.title}>Configurações</Text>
      <Text style={styles.subtitle}>
        Configurações do Wallet.ai.
      </Text>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    color: '#666',
  },
});