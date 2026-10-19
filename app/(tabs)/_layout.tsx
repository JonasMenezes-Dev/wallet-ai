import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors, radii, spacing, typography } from "../../src/theme";

const tabSymbols: Record<string, string> = {
  index: "⌂",
  transactions: "↔",
  accounts: "▤",
  goals: "◎",
  settings: "⚙",
};

export default function TabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        transitionSpec: {
          animation: "timing",
          config: { duration: 220 },
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontSize: typography.size.caption,
          fontWeight: typography.weight.semibold,
          marginTop: spacing.xxs,
          marginBottom: 1,
        },
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          minHeight: 58,
          justifyContent: "center",
          alignItems: "center",
          paddingTop: spacing.xs,
        },
        tabBarStyle: {
          height: 66 + insets.bottom,
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
            <View
              style={{
                width: 34,
                height: 28,
                borderRadius: radii.sm,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused ? colors.accentSurface : "transparent",
              }}
            >
              <Text style={{ color, fontSize: 22, lineHeight: 25, fontWeight: focused ? "700" : "400" }}>
                {tabSymbols.index}
              </Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transações",
          tabBarAccessibilityLabel: "Transações",
          tabBarIcon: ({ focused, color }) => (
            <View style={{ width: 34, height: 28, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: focused ? colors.accentSurface : "transparent" }}>
              <Text style={{ color, fontSize: 21, lineHeight: 25, fontWeight: focused ? "700" : "400" }}>{tabSymbols.transactions}</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Contas",
          tabBarAccessibilityLabel: "Contas",
          tabBarIcon: ({ focused, color }) => (
            <View style={{ width: 34, height: 28, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: focused ? colors.accentSurface : "transparent" }}>
              <Text style={{ color, fontSize: 19, lineHeight: 25, fontWeight: focused ? "700" : "400" }}>{tabSymbols.accounts}</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Metas",
          tabBarAccessibilityLabel: "Metas",
          tabBarIcon: ({ focused, color }) => (
            <View style={{ width: 34, height: 28, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: focused ? colors.accentSurface : "transparent" }}>
              <Text style={{ color, fontSize: 20, lineHeight: 25, fontWeight: focused ? "700" : "400" }}>{tabSymbols.goals}</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarAccessibilityLabel: "Configurações",
          tabBarIcon: ({ focused, color }) => (
            <View style={{ width: 34, height: 28, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: focused ? colors.accentSurface : "transparent" }}>
              <Text style={{ color, fontSize: 19, lineHeight: 25, fontWeight: focused ? "700" : "400" }}>{tabSymbols.settings}</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
