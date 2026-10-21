import { useEffect } from "react";
import { type ColorValue, StyleSheet } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useReducedMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { easings } from "../animations";
import { WalletSymbol, type WalletIconName } from "./WalletSymbol";

type AnimatedTabIconProps = {
  name: WalletIconName;
  focused: boolean;
  color: ColorValue;
  activeBackgroundColor: string;
};

export function AnimatedTabIcon({
  name,
  focused,
  color,
  activeBackgroundColor,
}: AnimatedTabIconProps) {
  const focusProgress = useSharedValue(focused ? 1 : 0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    focusProgress.set(
      reduceMotion
        ? Number(focused)
        : withTiming(focused ? 1 : 0, {
            duration: 260,
            easing: easings.out,
          }),
    );
  }, [focused, focusProgress, reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      ["rgba(0, 0, 0, 0)", activeBackgroundColor],
    ),
    transform: [
      {
        scale: interpolate(focusProgress.value, [0, 1], [0.94, 1]),
      },
    ],
  }));

  const symbolStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(focusProgress.value, [0, 1], [1, 0]),
      },
      {
        scale: interpolate(focusProgress.value, [0, 1], [1, 1.06]),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={symbolStyle}>
        <WalletSymbol name={name} color={color} size={21} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 34,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
