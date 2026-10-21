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
  lg: 21,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  family: {
    regular: 'Inter-Regular',
    bold: 'Inter-Bold',
  },
  size: {
    caption: 11,
    small: 12,
    body: 14,
    bodyLarge: 16,
    subtitle: 18,
    title: 22,
    titleLarge: 29,
    display: 32,
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
  buttonHeight: 52,
  buttonHeightCompact: 44,
  inputHeight: 55,
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

/** Opacidade aplicada aos SVGs de linhas; arcos já têm 5,5% no arquivo. */
export const ambientOpacity = { subtle: 0.04, standard: 0.06, highlight: 0.07 } as const;

export const elevation = {
  card: {
    shadowColor: '#06110C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
} as const;
