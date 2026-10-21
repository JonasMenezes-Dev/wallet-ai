import { useId, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from "react-native";

import { controlSizes, radii, spacing, typography, useThemeColors } from "../theme";
import { AppText } from "./AppText";

type AppFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Campo controlado: não converte nem formata valores financeiros. */
export function AppField({ label, hint, error, containerStyle, style, onFocus, onBlur, ...props }: AppFieldProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const id = useId();
  return (
    <View style={[styles.container, containerStyle]}>
      <AppText nativeID={`${id}-label`} variant="label" tone="muted">{label}</AppText>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityLabelledBy={`${id}-label`}
        accessibilityHint={error ?? hint ?? props.accessibilityHint}
        placeholderTextColor={props.placeholderTextColor ?? colors.textMuted}
        selectionColor={colors.primary}
        onFocus={event => { setFocused(true); onFocus?.(event); }}
        onBlur={event => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: error ? colors.expense : focused ? colors.primary : colors.border, opacity: props.editable === false ? 0.5 : 1 }, style]}
      />
      {error || hint ? (
        <AppText variant="caption" tone={error ? "error" : "muted"} accessibilityRole={error ? "alert" : undefined} accessibilityLiveRegion="polite">
          {error ?? hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  input: { minHeight: controlSizes.inputHeight, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, fontSize: typography.size.body, fontFamily: typography.family.regular },
});
