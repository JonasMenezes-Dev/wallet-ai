import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "../../src/theme";

export default function TabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const pageDot = (focused: boolean) => (
    <View
      style={{
        width: focused ? 10 : 8,
        height: focused ? 10 : 8,
        borderRadius: 99,
        backgroundColor: focused ? colors.primary : colors.textSubtle,
        opacity: focused ? 1 : 0.65,
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
          minHeight: 48,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 0,
        },
        tabBarStyle: {
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
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
          tabBarIcon: ({ focused }) => pageDot(focused),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transações",
          tabBarAccessibilityLabel: "Transações",
          tabBarIcon: ({ focused }) => pageDot(focused),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Contas",
          tabBarAccessibilityLabel: "Contas",
          tabBarIcon: ({ focused }) => pageDot(focused),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Metas",
          tabBarAccessibilityLabel: "Metas",
          tabBarIcon: ({ focused }) => pageDot(focused),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Configurações",
          tabBarAccessibilityLabel: "Configurações",
          tabBarIcon: ({ focused }) => pageDot(focused),
        }}
      />
    </Tabs>
  );
}
