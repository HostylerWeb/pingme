import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '../../hooks/use-tab-bar-insets';
import { spacing } from '../../theme';
import { useTheme } from '../../theme/theme-context';
import { useThemedStyles } from '../../theme/use-themed-styles';

export function Screen({
  children,
  style,
  padded = true,
  transparent = false,
  edges = ['top', 'bottom'],
}: {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  transparent?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  const styles = useThemedStyles(({ colors }) => ({
    base: {
      flex: 1,
      backgroundColor: transparent ? 'transparent' : colors.background,
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
        edges.includes('bottom') && { paddingBottom: bottomInset },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}
