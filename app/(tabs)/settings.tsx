import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import {
  ThemeColors,
  useThemePreference,
  useThemedStyles,
} from "../../src/theme";

export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { themeName, setThemeName } = useThemePreference();

  return (
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aparência</Text>
        <Text style={styles.sectionDescription}>
          Escolha o visual mais confortável para acompanhar suas finanças.
        </Text>

        <AnimatedPressable
          style={[
            styles.themeOption,
            themeName === "light" && styles.themeOptionSelected,
          ]}
          pressedOpacity={0.82}
          onPress={() => void setThemeName("light")}
        >
          <View style={styles.optionCopy}>
            <Text style={styles.optionTitle}>Modo claro</Text>
            <Text style={styles.optionDescription}>
              Fundo suave, leitura leve e contraste confortável.
            </Text>
          </View>
          <View
            style={[
              styles.radio,
              themeName === "light" && styles.radioSelected,
            ]}
          >
            {themeName === "light" && <View style={styles.radioDot} />}
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          style={[
            styles.themeOption,
            themeName === "dark" && styles.themeOptionSelected,
          ]}
          pressedOpacity={0.82}
          onPress={() => void setThemeName("dark")}
        >
          <View style={styles.optionCopy}>
            <Text style={styles.optionTitle}>Modo escuro</Text>
            <Text style={styles.optionDescription}>
              Tons profundos para ambientes com pouca iluminação.
            </Text>
          </View>
          <View
            style={[
              styles.radio,
              themeName === "dark" && styles.radioSelected,
            ]}
          >
            {themeName === "dark" && <View style={styles.radioDot} />}
          </View>
        </AnimatedPressable>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Sua preferência fica salva</Text>
        <Text style={styles.noteText}>
          O tema escolhido será mantido quando você fechar e abrir o aplicativo.
        </Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 24,
      paddingTop: 28,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 28,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.3,
      color: colors.primary,
    },
    title: {
      marginTop: 8,
      fontSize: 30,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textMuted,
    },
    section: {
      padding: 18,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 14,
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
      marginTop: 16,
      padding: 16,
      borderRadius: 16,
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
