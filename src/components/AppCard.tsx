import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useThemeColors, elevation, radii, spacing } from "../theme";
import { PremiumAmbient } from "./PremiumAmbient";

type AppCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
  padded?: boolean;
  ambient?: "none" | "subtle" | "highlight";
};

/** Superfície consistente para blocos de conteúdo em qualquer tema. */
export function AppCard({
  children,
  style,
  muted = false,
  padded = true,
  ambient = "none",
}: AppCardProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: muted ? colors.surfaceMuted : colors.surface,
          borderColor: colors.border,
          padding: padded ? spacing.xl : 0,
          ...elevation.card,
        },
        style,
      ]}
    >
      {ambient !== "none" ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.texture]}>
          <PremiumAmbient variant={ambient} placement="card" />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  texture: { borderRadius: radii.lg, overflow: "hidden" },
});
