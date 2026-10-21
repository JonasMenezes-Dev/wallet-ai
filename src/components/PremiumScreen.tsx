import { StyleSheet, View, type ViewProps } from "react-native";

import { useThemeColors } from "../theme";
import { PremiumAmbient } from "./PremiumAmbient";

type PremiumScreenProps = ViewProps & { ambient?: "subtle" | "standard" | "highlight" };

/** A tela mantém controle do scroll, safe areas e teclado já existentes. */
export function PremiumScreen({ children, style, ambient = "standard", ...props }: PremiumScreenProps) {
  const colors = useThemeColors();
  return (
    <View {...props} style={[styles.screen, { backgroundColor: colors.background }, style]}>
      <PremiumAmbient variant={ambient} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, position: "relative" } });
