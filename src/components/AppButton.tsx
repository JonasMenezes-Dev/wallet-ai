import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { AnimatedPressable } from "./AnimatedPressable";
import { useThemeColors, controlSizes, radii, spacing, typography } from "../theme";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Botão de ação com altura, contraste e feedback de toque consistentes. */
export function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  leading,
  style,
  accessibilityLabel,
}: AppButtonProps) {
  const colors = useThemeColors();
  const primary = variant === "primary";
  const ghost = variant === "ghost";
  const backgroundColor = primary
    ? colors.primary
    : ghost
      ? "transparent"
      : colors.accentSurface;
  const foregroundColor = primary ? colors.onPrimary : colors.primary;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      pressedOpacity={0.82}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor: primary || ghost ? "transparent" : colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <Text style={[styles.label, { color: foregroundColor }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: controlSizes.buttonHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  leading: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
});
