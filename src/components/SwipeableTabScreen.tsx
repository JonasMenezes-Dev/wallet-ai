import { useMemo, type ReactNode } from "react";
import { PanResponder, View } from "react-native";
import { router } from "expo-router";

const TAB_ORDER = ["index", "transactions", "accounts", "goals", "settings"] as const;
type TabName = (typeof TAB_ORDER)[number];

const TAB_PATHS = {
  index: "/(tabs)/index",
  transactions: "/(tabs)/transactions",
  accounts: "/(tabs)/accounts",
  goals: "/(tabs)/goals",
  settings: "/(tabs)/settings",
} as const;

type Props = {
  routeName: TabName;
  children: ReactNode;
};

/** Permite trocar de aba com um gesto horizontal sem atrapalhar a rolagem vertical. */
export function SwipeableTabScreen({ routeName, children }: Props) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 14 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < 64) return;

          const currentIndex = TAB_ORDER.indexOf(routeName);
          const nextIndex = gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1;
          const nextRoute = TAB_ORDER[nextIndex];

          if (nextRoute) router.navigate(TAB_PATHS[nextRoute]);
        },
      }),
    [routeName],
  );

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
