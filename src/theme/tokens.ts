/**
 * Design tokens compartilhados do Wallet AI.
 *
 * Valores de layout e tipografia não dependem do tema; cores semânticas
 * continuam centralizadas em colors.tsx.
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  size: {
    caption: 11,
    small: 12,
    body: 14,
    bodyLarge: 16,
    subtitle: 18,
    title: 22,
    titleLarge: 28,
    display: 34,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.45,
    relaxed: 1.6,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  },
  letterSpacing: {
    tight: -0.4,
    normal: 0,
    wide: 0.8,
    extraWide: 1.2,
  },
} as const;

export const controlSizes = {
  buttonHeight: 50,
  buttonHeightCompact: 42,
  inputHeight: 52,
  tabBarMinHeight: 60,
  iconButtonSize: 44,
  touchTargetMin: 44,
} as const;

export const iconSizes = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 26,
  xl: 32,
} as const;

export const motion = {
  quick: 140,
  standard: 220,
  emphasis: 300,
} as const;
