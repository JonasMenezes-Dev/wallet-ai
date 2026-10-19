import { Tabs } from "expo-router";
import { View } from "react-native";

import { useThemeColors } from "../../src/theme";

export default function TabsLayout() {
  const colors = useThemeColors();

  const pageDot = (focused: boolean) => (
    <View
      style={{
        width: focused ? 9 : 7,
        height: focused ? 9 : 7,
        borderRadius: 99,
        backgroundColor: focused ? colors.primary : colors.textSubtle,
        opacity: focused ? 1 : 0.55,
      }}
    />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        transitionSpec: {
          animation: "timing",
          config: { duration: 260 },
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          paddingVertical: 9,
        },
        tabBarStyle: {
          height: 58,
          paddingTop: 10,
          paddingBottom: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Início", tabBarAccessibilityLabel: "Início", tabBarIcon: ({ focused }) => pageDot(focused) }}
      />
      <Tabs.Screen
        name="transactions"
        options={{ title: "Transações", tabBarAccessibilityLabel: "Transações", tabBarIcon: ({ focused }) => pageDot(focused) }}
      />
      <Tabs.Screen
        name="accounts"
        options={{ title: "Contas", tabBarAccessibilityLabel: "Contas", tabBarIcon: ({ focused }) => pageDot(focused) }}
      />
      <Tabs.Screen
        name="goals"
        options={{ title: "Metas", tabBarAccessibilityLabel: "Metas", tabBarIcon: ({ focused }) => pageDot(focused) }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Configurações", tabBarAccessibilityLabel: "Configurações", tabBarIcon: ({ focused }) => pageDot(focused) }}
      />
    </Tabs>
  );
}
