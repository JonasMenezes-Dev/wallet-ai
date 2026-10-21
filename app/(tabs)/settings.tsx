import { ScrollView, StyleSheet, View } from "react-native";

import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { AppCard } from "../../src/components/AppCard";
import { AppText as Text } from "../../src/components/AppText";
import { PremiumScreen } from "../../src/components/PremiumScreen";
import { BankNotificationSettings } from "../../src/components/BankNotificationSettings";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import {
  ThemeColors,
  useThemePreference,
  useThemedStyles,
  type ThemePreference,
} from "../../src/theme";

const themeOptions: {
  value: ThemePreference;
  title: string;
  description: string;
}[] = [
  {
    value: "system",
    title: "Automático",
    description: "Acompanha o modo claro ou escuro do seu celular.",
  },
  {
    value: "light",
    title: "Modo claro",
    description: "Fundo suave, leitura leve e contraste confortável.",
  },
  {
    value: "dark",
    title: "Modo escuro",
    description: "Tons profundos para ambientes com pouca iluminação.",
  },
];

export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { themePreference, setThemePreference } = useThemePreference();

  return (
    <PremiumScreen ambient="subtle">
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Configurações"
        subtitle="Ajuste o Wallet AI para acompanhar sua rotina."
        eyebrow="Preferências"
      />

      <AppCard style={styles.section} padded={false}>
        <Text style={styles.sectionTitle}>Aparência</Text>
        <Text style={styles.sectionDescription}>
          Escolha o visual mais confortável para acompanhar suas finanças.
        </Text>

        {themeOptions.map((option) => {
          const selected = themePreference === option.value;

          return (
            <AnimatedPressable
              key={option.value}
              style={[
                styles.themeOption,
                selected && styles.themeOptionSelected,
              ]}
              pressedOpacity={0.82}
              accessibilityRole="radio"
              accessibilityLabel={option.title}
              accessibilityState={{ selected }}
              onPress={() => void setThemePreference(option.value)}
            >
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>
                  {option.description}
                </Text>
              </View>
              <View
                style={[
                  styles.radio,
                  selected && styles.radioSelected,
                ]}
              >
                {selected && <View style={styles.radioDot} />}
              </View>
            </AnimatedPressable>
          );
        })}
      </AppCard>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Sua preferência fica salva</Text>
        <Text style={styles.noteText}>
          O modo automático acompanha as mudanças de aparência do celular. Se
          escolher claro ou escuro manualmente, o Wallet AI mantém sua escolha
          mesmo quando o tema do sistema mudar.
        </Text>
      </View>
      <BankNotificationSettings />
    </ScrollView>
    </PremiumScreen>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 32,
    },
    section: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    sectionDescription: {
      marginTop: 6,
      marginBottom: 16,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
    },
    themeOption: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginTop: 10,
    },
    themeOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.accentSurface,
    },
    optionCopy: {
      flex: 1,
      marginRight: 12,
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    optionDescription: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.textSubtle,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    note: {
      marginTop: 24,
      padding: 20,
      borderRadius: 21,
      backgroundColor: colors.surfaceMuted,
    },
    noteTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    noteText: {
      marginTop: 5,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
    },
  });
