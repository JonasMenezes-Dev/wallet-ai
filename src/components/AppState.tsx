import { ActivityIndicator, StyleSheet, View } from "react-native";

import { spacing, useThemeColors } from "../theme";
import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { WalletSymbol, type WalletIconName } from "./WalletSymbol";

type StateVariant = "empty" | "loading" | "success" | "error";
type AppStateProps = {
  variant: StateVariant;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
};
const icons: Record<Exclude<StateVariant, "loading">, WalletIconName> = { empty: "accounts", success: "success", error: "error" };

export function AppState({ variant, title, description, action }: AppStateProps) {
  const colors = useThemeColors();
  const color = variant === "error" ? colors.expense : variant === "success" ? colors.income : colors.primary;
  return (
    <View style={styles.container}>
      {variant === "loading" ? <ActivityIndicator color={color} size="large" /> : <WalletSymbol name={icons[variant]} color={color} size={32} />}
      <View accessibilityLiveRegion="polite" accessibilityRole={variant === "error" ? "alert" : undefined} accessibilityState={{ busy: variant === "loading" }} style={styles.copy}>
        <AppText variant="subtitle" style={styles.text}>{title}</AppText>
        {description ? <AppText tone="muted" style={styles.text}>{description}</AppText> : null}
      </View>
      {action ? <AppButton {...action} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: spacing['2xl'], gap: spacing.lg },
  copy: { gap: spacing.sm, alignSelf: "stretch" },
  text: { textAlign: "center" },
});
