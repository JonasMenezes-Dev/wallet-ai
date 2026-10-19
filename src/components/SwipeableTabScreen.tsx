import { useMemo, type ReactNode } from "react";
import { PanResponder, View } from "react-native";
import { router } from "expo-router";

const TAB_ORDER = [
  "index",
  "transactions",
  "accounts",
  "goals",
  "settings",
] as const;

type TabName = (typeof TAB_ORDER)[number];

type Props = {
  routeName: TabName;
  children: ReactNode;
};

export function SwipeableTabScreen({ routeName, children }: Props) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 48 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.45,
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < 72) return;

          const currentIndex = TAB_ORDER.indexOf(routeName);
          const nextIndex = gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1;
          const nextRoute = TAB_ORDER[nextIndex];

          if (nextRoute) {
            router.navigate(`/(tabs)/${nextRoute}`);
          }
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
