import { useCallback } from "react";
import {
    GestureResponderEvent,
    Pressable,
    PressableProps,
} from "react-native";

import Animated, {
    interpolate,
    useReducedMotion,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { durations, easings } from "../animations";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = PressableProps & {
  /** Quanto o elemento encolhe ao ser pressionado. */
  pressedScale?: number;
  /** Opacidade mínima durante o toque (1 = sem fade). */
  pressedOpacity?: number;
};

/**
 * Pressable com feedback de "pop": compressão curta no toque e retorno
 * elástico ao soltar. Sem variar opacidade, evitando piscadas visuais.
 * Usado em botões, chips, filtros e cards clicáveis do app.
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
  const reduceMotion = useReducedMotion();

  // Mantém compatibilidade com chamadas antigas, mas o feedback agora é só
  // movimento: variar opacidade causava a piscada que queremos evitar.
  void pressedOpacity;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [1, pressedScale]),
      },
    ],
  }));

  // Handlers criados fora do JSX para que o React Compiler não trate a
  // escrita em `progress.value` como mutação de uma variável imutável.
  const pressIn = useCallback((event: GestureResponderEvent) => {
    progress.set(
      reduceMotion
        ? 0
        : withTiming(1, {
            duration: durations.fast,
            easing: easings.out,
          }),
    );
    onPressIn?.(event);
  }, [progress, onPressIn, reduceMotion]);

  const pressOut = useCallback((event: GestureResponderEvent) => {
    progress.set(
      reduceMotion
        ? 0
        : withTiming(0, {
            duration: durations.fast,
            easing: easings.out,
          }),
    );
    onPressOut?.(event);
  }, [progress, onPressOut, reduceMotion]);

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
