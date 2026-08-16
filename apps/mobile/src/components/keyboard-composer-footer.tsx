import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';

type KeyboardComposerFooterProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/**
 * Keeps a bottom composer (message input, reply field) above the software keyboard.
 * Wrap only the composer — not the whole screen — for reliable avoidance on iOS and Android.
 */
export function KeyboardComposerFooter({ children, style }: KeyboardComposerFooterProps) {
  const insets = useSafeAreaInsets();

  const footer = (
    <View style={[{ paddingBottom: insets.bottom + spacing.sm }, style]}>{children}</View>
  );

  if (Platform.OS !== 'ios') {
    return footer;
  }

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
      {footer}
    </KeyboardAvoidingView>
  );
}
