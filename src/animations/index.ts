import { Easing } from "react-native-reanimated";

/**
 * Tokens de animação do Wallet.ai.
 * Centraliza durações, easings e presets de entrada/saída para que todas as
 * interações (botões, cards, troca de página, listas) tenham o mesmo "feel".
 */
export const durations = {
  instant: 120,
  fast: 180,
  base: 240,
  smooth: 320,
  slow: 420,
} as const;

export const spring = {
  /** Toque em botões/chips — resposta rápida e firme. */
  press: { damping: 18, stiffness: 300, mass: 0.6 },
  /** Movimentos maiores (cards, progresso). */
  gentle: { damping: 16, stiffness: 180, mass: 0.8 },
} as const;

export const easings = {
  /** Padrão para entradas. */
  out: Easing.out(Easing.cubic),
  /** Para saídas. */
  in: Easing.in(Easing.cubic),
  /** In-out para movimentos contínuos. */
  inOut: Easing.inOut(Easing.quad),
} as const;

/** Como cada tela entra ao ser empilhada. */
export const screenTransition = {
  animation: "slide_from_right",
  animationDuration: durations.base,
} as const;

/** Delay em cascata para itens de lista (limitado para listas longas). */
export function staggerDelay(index: number, step = 45, max = 260) {
  return Math.min(index * step, max);
}
