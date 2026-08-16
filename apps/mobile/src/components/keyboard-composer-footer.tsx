import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useBottomInset, useTabBarInsets } from '../hooks/use-tab-bar-insets';

type KeyboardComposerFooterProps = {
  children: ReactNode;
  style?: ViewStyle;
  /** Stack screens (chat) should not reserve tab bar space. Default true for tab composers. */
  useTabBarInset?: boolean;
};

/**
 * Pins a bottom composer (chat input, reply field) above the software keyboard.
 * Safe-area space is padding, not a sticky offset — a closed offset pushed the
 * composer below the visible screen on Android.
 */
export function KeyboardComposerFooter({
  children,
  style,
  useTabBarInset = true,
}: KeyboardComposerFooterProps) {
  const bottomInset = useBottomInset();
  const { tabBarHeight } = useTabBarInsets();
  const paddingBottom = useTabBarInset ? tabBarHeight : bottomInset;

  return (
    <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
      <View style={[style, { paddingBottom }]}>{children}</View>
    </KeyboardStickyView>
  );
}
