import { useEffect, useMemo, useRef, type ReactNode } from "react";
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

/** Navegação horizontal com proteção contra disparos repetidos e scroll vertical. */
export function SwipeableTabScreen({ routeName, children }: Props) {
  const isNavigating = useRef(false);

  useEffect(() => {
    isNavigating.current = false;
  }, [routeName]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 32 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.7,
        onPanResponderRelease: (_, gesture) => {
          if (isNavigating.current) return;

          const distance = Math.abs(gesture.dx);
          const velocity = Math.abs(gesture.vx);

          // Exige um deslize claro ou um movimento rápido, sem reagir a toques curtos.
          if (distance < 82 && !(distance > 45 && velocity > 0.85)) return;

          const currentIndex = TAB_ORDER.indexOf(routeName);
          const nextIndex = gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1;
          const nextRoute = TAB_ORDER[nextIndex];

          // Não tenta navegar além da primeira ou da última aba.
          if (!nextRoute) return;

          isNavigating.current = true;
          router.navigate(TAB_PATHS[nextRoute]);
        },
        onPanResponderTerminate: () => {
          isNavigating.current = false;
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
