import { ViewStyle } from 'react-native';
import type { AppColors } from './colors';
import { lightColors } from './colors';

export type AppShadows = {
  card: ViewStyle;
  cardHover: ViewStyle;
  fab: ViewStyle;
  header: ViewStyle;
  sheet: ViewStyle;
};

export function createShadows(colors: AppColors): AppShadows {
  return {
    card: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 2,
    },
    cardHover: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 1,
      shadowRadius: 20,
      elevation: 4,
    },
    fab: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius: 16,
      elevation: 8,
    },
    header: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sheet: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 1,
      shadowRadius: 24,
      elevation: 12,
    },
  };
}

/** @deprecated Use `useTheme().shadows` instead */
export const shadows = createShadows(lightColors);
