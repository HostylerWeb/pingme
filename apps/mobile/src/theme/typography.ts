import { TextStyle } from 'react-native';

export const fontFamilies = {
  display: 'Outfit_700Bold',
  displayMedium: 'Outfit_600SemiBold',
  headline: 'Outfit_600SemiBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
} as const;

export const typography = {
  display: {
    fontFamily: fontFamilies.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  headlineLg: {
    fontFamily: fontFamilies.headline,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  headlineMd: {
    fontFamily: fontFamilies.headline,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  title: {
    fontFamily: fontFamilies.displayMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  bodyLg: {
    fontFamily: fontFamilies.body,
    fontSize: 17,
    lineHeight: 26,
  },
  bodyMd: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 22,
  },
  bodySemiBold: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 15,
    lineHeight: 22,
  },
  labelSm: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  caption: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
  },
  overline: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  distance: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
} satisfies Record<string, TextStyle>;
