import { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { durations, easings } from "../animations";

type AnimatedProgressFillProps = {
  /** Progresso entre 0 e 1. Valores fora desse intervalo são limitados. */
  progress: number;
  /** Atraso curto para criar uma entrada em cascata sem sobrecarregar a tela. */
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedProgressFill({
  progress,
  delay = 80,
  duration = durations.smooth,
  style,
}: AnimatedProgressFillProps) {
  const animatedProgress = useSharedValue(0);
  const targetProgress = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;

  useEffect(() => {
    animatedProgress.set(
      withDelay(
        delay,
        withTiming(targetProgress, {
          duration,
          easing: easings.out,
        }),
      ),
    );
  }, [animatedProgress, delay, duration, targetProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  return <Animated.View style={[style, animatedStyle]} />;
}
