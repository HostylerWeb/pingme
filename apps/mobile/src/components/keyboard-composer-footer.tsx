import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useBottomInset } from '../hooks/use-tab-bar-insets';
import { spacing } from '../theme';

type KeyboardComposerFooterProps = {
  children: ReactNode;
  style?: ViewStyle;
  /** Stack screens (chat) should not reserve tab bar space. Default true for tab composers. */
  useTabBarInset?: boolean;
};

/**
 * Pins a bottom composer (chat input, reply field) above the software keyboard.
 */
export function KeyboardComposerFooter({
  children,
  style,
  useTabBarInset = true,
}: KeyboardComposerFooterProps) {
  const bottomInset = useBottomInset();
  const closedOffset = useTabBarInset ? bottomInset + spacing.sm : bottomInset;

  return (
    <KeyboardStickyView offset={{ closed: closedOffset, opened: spacing.sm }}>
      <View style={style}>{children}</View>
    </KeyboardStickyView>
  );
}
