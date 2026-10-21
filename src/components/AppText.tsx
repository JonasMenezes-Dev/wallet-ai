import { StyleSheet, Text, type TextProps } from "react-native";

import { typography, useThemeColors } from "../theme";

const variants = StyleSheet.create({
  body: { fontSize: typography.size.body, lineHeight: 21 },
  caption: { fontSize: typography.size.small, lineHeight: 18 },
  label: { fontSize: typography.size.caption, lineHeight: 16, letterSpacing: typography.letterSpacing.wide, textTransform: "uppercase", fontFamily: typography.family.bold, fontWeight: "700" },
  subtitle: { fontSize: typography.size.subtitle, lineHeight: 25, fontFamily: typography.family.bold, fontWeight: "700" },
  title: { fontSize: typography.size.titleLarge, lineHeight: 36, fontFamily: typography.family.bold, fontWeight: "700", letterSpacing: typography.letterSpacing.tight },
  amount: { fontSize: typography.size.display, lineHeight: 40, fontFamily: typography.family.bold, fontWeight: "700", fontVariant: ["tabular-nums"] },
});

type AppTextProps = TextProps & {
  variant?: keyof typeof variants;
  tone?: "default" | "muted" | "primary" | "success" | "error";
};

export function AppText({ variant = "body", tone = "default", style, ...props }: AppTextProps) {
  const colors = useThemeColors();
  const color = { default: colors.text, muted: colors.textMuted, primary: colors.primary, success: colors.income, error: colors.expense }[tone];
  return <Text {...props} style={[{ color, fontFamily: typography.family.regular }, variants[variant], style]} />;
}
