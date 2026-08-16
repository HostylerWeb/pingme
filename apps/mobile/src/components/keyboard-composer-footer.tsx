import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';

type KeyboardComposerFooterProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/**
 * Pins a bottom composer (chat input, reply field) above the software keyboard.
 */
export function KeyboardComposerFooter({ children, style }: KeyboardComposerFooterProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardStickyView offset={{ closed: insets.bottom + spacing.sm, opened: spacing.sm }}>
      <View style={style}>{children}</View>
    </KeyboardStickyView>
  );
}
