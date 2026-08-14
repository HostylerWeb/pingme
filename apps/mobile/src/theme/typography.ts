import { TextStyle } from 'react-native';

export const fontFamilies = {
  display: 'PlusJakartaSans_700Bold',
  headline: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const typography = {
  display: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  headlineLg: {
    fontFamily: fontFamilies.headline,
    fontSize: 24,
    lineHeight: 32,
  },
  headlineMd: {
    fontFamily: fontFamilies.headline,
    fontSize: 20,
    lineHeight: 28,
  },
  bodyLg: {
    fontFamily: fontFamilies.body,
    fontSize: 18,
    lineHeight: 28,
  },
  bodyMd: {
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySemiBold: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  labelSm: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
  },
  distance: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
} satisfies Record<string, TextStyle>;
