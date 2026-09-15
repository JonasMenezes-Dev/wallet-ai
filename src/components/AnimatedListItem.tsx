import { ReactNode } from "react";

import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { durations, staggerDelay } from "../animations";

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
  delayStep = 45,
  style,
}: AnimatedListItemProps) {
  return (
    <Animated.View
      layout={LinearTransition.duration(durations.base).build()}
      entering={FadeInDown.delay(staggerDelay(index, delayStep)).duration(
        durations.smooth,
      )}
      exiting={FadeOut.duration(durations.fast)}
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
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(durations.smooth)}
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
  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(durations.base)}
      exiting={FadeOut.duration(durations.fast)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
