import { Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedTabIcon } from "../../src/components/AnimatedTabIcon";
import { useThemeColors, spacing, typography } from "../../src/theme";

export default function TabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabLabelSize = width < 360 ? 10 : 11;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "fade",
        transitionSpec: {
          animation: "timing",
          config: { duration: 180 },
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontSize: tabLabelSize,
          fontWeight: typography.weight.semibold,
          textAlign: "center",
          marginTop: spacing.xxs,
          marginBottom: 1,
        },
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          flex: 1,
          minWidth: 0,
          minHeight: 60,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 0,
          paddingTop: spacing.xs,
        },
        tabBarStyle: {
          height: 66 + insets.bottom,
          minHeight: 66 + insets.bottom,
          paddingTop: spacing.xs,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          paddingHorizontal: spacing.xs,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarAccessibilityLabel: "Início",
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon
              name="home"
              focused={focused}
              color={color}
              activeBackgroundColor={colors.accentSurface}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transações",
          tabBarAccessibilityLabel: "Transações",
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon
              name="transactions"
              focused={focused}
              color={color}
              activeBackgroundColor={colors.accentSurface}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Contas",
          tabBarAccessibilityLabel: "Contas",
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon
              name="accounts"
              focused={focused}
              color={color}
              activeBackgroundColor={colors.accentSurface}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Metas",
          tabBarAccessibilityLabel: "Metas",
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon
              name="goals"
              focused={focused}
              color={color}
              activeBackgroundColor={colors.accentSurface}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarAccessibilityLabel: "Configurações",
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon
              name="settings"
              focused={focused}
              color={color}
              activeBackgroundColor={colors.accentSurface}
            />
          ),
        }}
      />
    </Tabs>
  );
}
