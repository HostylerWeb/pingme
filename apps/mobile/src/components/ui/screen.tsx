import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { useTheme } from '../../theme/theme-context';
import { useThemedStyles } from '../../theme/use-themed-styles';

export function Screen({
  children,
  style,
  padded = true,
  edges = ['top', 'bottom'],
}: {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(({ colors }) => ({
    base: {
      flex: 1,
      backgroundColor: colors.background,
    },
    padded: {
      paddingHorizontal: spacing.container,
    },
  }));

  return (
    <View
      style={[
        styles.base,
        edges.includes('top') && { paddingTop: insets.top },
        edges.includes('bottom') && { paddingBottom: insets.bottom },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}
