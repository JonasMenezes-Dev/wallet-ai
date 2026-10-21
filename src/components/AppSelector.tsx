import { StyleSheet, View } from "react-native";

import { controlSizes, radii, spacing, typography, useThemeColors } from "../theme";
import { AnimatedPressable } from "./AnimatedPressable";
import { AppText } from "./AppText";

type Option<T extends string | number> = { label: string; value: T; disabled?: boolean };
type AppSelectorProps<T extends string | number> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function AppSelector<T extends string | number>({ options, value, onChange, accessibilityLabel, disabled = false }: AppSelectorProps<T>) {
  const colors = useThemeColors();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.row}>
      {options.map(option => {
        const selected = value === option.value;
        const blocked = disabled || option.disabled === true;
        return (
          <AnimatedPressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled: blocked }}
            disabled={blocked}
            onPress={() => { if (!blocked) onChange(option.value); }}
            style={[styles.option, { backgroundColor: selected ? colors.accentSurface : colors.surfaceMuted, borderColor: selected ? colors.primary : "transparent", opacity: blocked ? 0.5 : 1 }]}
          >
            <AppText variant="caption" tone={selected ? "primary" : "muted"} style={selected ? styles.selected : undefined}>{option.label}</AppText>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: { minWidth: controlSizes.touchTargetMin, minHeight: controlSizes.touchTargetMin, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderRadius: radii.sm, justifyContent: "center" },
  selected: { fontFamily: typography.family.bold, fontWeight: "700" },
});
