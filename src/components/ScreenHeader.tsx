import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useThemeColors, spacing, typography } from "../theme";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  accessory?: ReactNode;
};

/** Cabeçalho de tela com hierarquia tipográfica padronizada. */
export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  accessory,
}: ScreenHeaderProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {eyebrow.toLocaleUpperCase("pt-BR")}
          </Text>
        ) : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  accessory: {
    flexShrink: 0,
    maxWidth: "42%",
    alignItems: "flex-end",
  },
  eyebrow: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  title: {
    flexShrink: 1,
    fontSize: typography.size.titleLarge,
    lineHeight: Math.round(typography.size.titleLarge * typography.lineHeight.tight),
    fontWeight: typography.weight.heavy,
  },
  subtitle: {
    flexShrink: 1,
    marginTop: spacing.sm,
    fontSize: typography.size.body,
    lineHeight: Math.round(typography.size.body * typography.lineHeight.relaxed),
  },
});
