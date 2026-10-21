import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useThemeColors, spacing, typography } from "../theme";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

/** Título de seção para listas, resumos e cartões agrupados. */
export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.subtitle,
    fontWeight: typography.weight.bold,
  },
  subtitle: {
    fontFamily: typography.family.regular,
    marginTop: spacing.xxs,
    fontSize: typography.size.small,
    lineHeight: Math.round(typography.size.small * typography.lineHeight.relaxed),
  },
});
