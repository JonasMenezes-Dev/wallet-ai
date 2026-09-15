import { useCallback } from "react";
import {
    GestureResponderEvent,
    Pressable,
    PressableProps,
} from "react-native";

import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

import { durations, spring } from "../animations";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = PressableProps & {
  /** Quanto o elemento encolhe ao ser pressionado. */
  pressedScale?: number;
  /** Opacidade mínima durante o toque (1 = sem fade). */
  pressedOpacity?: number;
};

/**
 * Pressable com feedback suave de toque (escala + opacidade com spring).
 * Usado em todos os botões, chips, filtros e cards clicáveis do app para
 * manter a mesma sensação de resposta ao toque.
 */
export function AnimatedPressable({
  children,
  style,
  pressedScale = 0.97,
  pressedOpacity = 1,
  onPressIn,
  onPressOut,
  ...props
}: AnimatedPressableProps) {
  const progress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [1, pressedScale]),
      },
    ],
    opacity: interpolate(progress.value, [0, 1], [1, pressedOpacity]),
  }));

  // Handlers criados fora do JSX para que o React Compiler não trate a
  // escrita em `progress.value` como mutação de uma variável imutável.
  const pressIn = useCallback((event: GestureResponderEvent) => {
    progress.set(withSpring(1, spring.press));
    onPressIn?.(event);
  }, [progress, onPressIn]);

  const pressOut = useCallback((event: GestureResponderEvent) => {
    progress.set(withTiming(0, { duration: durations.fast }));
    onPressOut?.(event);
  }, [progress, onPressOut]);

  return (
    <AnimatedPressableBase
      {...props}
      style={[style, animatedStyle]}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      {children}
    </AnimatedPressableBase>
  );
}
