import { ReactNode } from "react";

import Animated, {
  useReducedMotion,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { durations, easings, staggerDelay } from "../animations";

type AnimatedListItemProps = {
  children: ReactNode;
  /** Posição na lista — usada para o efeito cascata. */
  index?: number;
  delayStep?: number;
  style?: React.ComponentProps<typeof Animated.View>["style"];
};

/**
 * Item de lista animado: aparece deslizando de baixo para cima e sai com fade.
 * Mantém o layout animado para que remoções não causem "pulos" bruscos.
 */
export function AnimatedListItem({
  children,
  index = 0,
  delayStep = 30,
  style,
}: AnimatedListItemProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(durations.base).easing(easings.inOut).build()}
      entering={reduceMotion || index > 11 ? undefined : FadeInDown.delay(staggerDelay(index, delayStep))
        .duration(durations.smooth)
        .easing(easings.out)}
      exiting={reduceMotion ? undefined : FadeOut.duration(durations.fast).easing(easings.in)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Bloco animado genérico (headers, seções, cards). */
export function AnimatedBlock({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: React.ComponentProps<typeof Animated.View>["style"];
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(delay, 160)).duration(durations.smooth).easing(easings.out)}
      exiting={reduceMotion ? undefined : FadeOut.duration(durations.fast).easing(easings.in)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Aparecimento simples com fade (formulários, estados vazios). */
export function FadeInView({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: React.ComponentProps<typeof Animated.View>["style"];
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.delay(delay).duration(durations.base).easing(easings.out)}
      exiting={reduceMotion ? undefined : FadeOut.duration(durations.fast).easing(easings.in)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
