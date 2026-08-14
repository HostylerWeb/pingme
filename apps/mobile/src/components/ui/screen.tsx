import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

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

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: spacing.container,
  },
});
