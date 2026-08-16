import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button } from './ui';
import { spacing, typography, useTheme } from '../theme';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        padding: spacing.container,
        gap: spacing.lg,
      }}
    >
      <Text style={{ ...typography.title, color: colors.ink, textAlign: 'center' }}>
        Something went wrong
      </Text>
      <Text style={{ ...typography.bodyMd, color: colors.inkSecondary, textAlign: 'center' }}>
        The app hit an unexpected error. You can try again.
      </Text>
      <Button label="Try again" onPress={onRetry} />
    </View>
  );
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
