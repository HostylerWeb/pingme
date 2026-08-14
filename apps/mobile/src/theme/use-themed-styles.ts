import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme, type Theme } from './theme-context';

type Styles = Record<string, ViewStyle | TextStyle | ImageStyle>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useThemedStyles(factory: (theme: Theme) => Styles): any {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme) as Styles), [theme]);
}
