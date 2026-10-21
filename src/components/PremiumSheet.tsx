import { type ReactNode, useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { durations, easings } from "../animations";
import { controlSizes, radii, spacing, useThemeColors } from "../theme";
import { AppText } from "./AppText";
import { WalletSymbol } from "./WalletSymbol";

type PremiumSheetProps = { visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode };

/** Modal nativo mantém foco e botão Voltar; transição ocorre na thread de UI. */
export function PremiumSheet({ visible, onClose, title, children, footer }: PremiumSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const progress = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(visible ? 1 : 0, { duration: reduceMotion ? 0 : durations.smooth, easing: easings.out }, finished => {
      if (finished && !visible) scheduleOnRN(setMounted, false);
    }));
  }, [visible, reduceMotion, progress]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.5 }));
  const sheetStyle = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * 64 }] }));
  return (
    <Modal visible={mounted || visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar painel" />
        <Animated.View accessibilityViewIsModal style={[styles.sheet, { maxHeight: height - insets.top - spacing.xl, paddingBottom: Math.max(insets.bottom, spacing.lg), backgroundColor: colors.surface, borderColor: colors.border }, sheetStyle]}>
          <View style={styles.header}>
            <AppText variant="subtitle" accessibilityRole="header" style={styles.title}>{title}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar painel" onPress={onClose} style={styles.close}>
              <WalletSymbol name="close" color={colors.textMuted} size={22} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>{children}</ScrollView>
          {footer ? <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "flex-end" },
  scrim: { backgroundColor: "#000000" },
  sheet: { flexShrink: 1, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, overflow: "hidden", width: "100%", maxWidth: 640, alignSelf: "center" },
  header: { paddingLeft: spacing['2xl'], paddingRight: spacing.md, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  title: { flex: 1, minWidth: 0 },
  close: { width: controlSizes.iconButtonSize, height: controlSizes.iconButtonSize, alignItems: "center", justifyContent: "center" },
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: spacing['2xl'], paddingBottom: spacing.xl, gap: spacing.lg },
  footer: { paddingTop: spacing.lg, paddingHorizontal: spacing['2xl'], borderTopWidth: 1, gap: spacing.sm },
});
