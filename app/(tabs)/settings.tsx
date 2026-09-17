import { StyleSheet, Text } from 'react-native';

import { FadeInView } from '../../src/components/AnimatedListItem';
import { ThemeColors, useThemedStyles, useThemeName } from '../../src/theme';

export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const themeName = useThemeName();

  return (
    <FadeInView style={styles.container}>
      <Text style={styles.title}>Configurações</Text>
      <Text style={styles.subtitle}>Tema atual: {themeName === 'dark' ? 'escuro' : 'claro'}</Text>
      <Text style={styles.helper}>O app acompanha automaticamente o tema do sistema.</Text>
    </FadeInView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { marginTop: 8, color: colors.textMuted },
  helper: { marginTop: 8, textAlign: 'center', color: colors.textSubtle },
});