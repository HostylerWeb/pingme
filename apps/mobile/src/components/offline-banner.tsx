import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, useTheme } from '../theme';

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected !== false && state.isInternetReachable !== false;
      setOffline(!connected);
    });
    return unsubscribe;
  }, []);

  if (!offline) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + spacing.sm,
        left: spacing.container,
        right: spacing.container,
        zIndex: 50,
        backgroundColor: colors.error,
        borderRadius: 10,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text style={{ ...typography.caption, color: '#FFFFFF', textAlign: 'center' }}>
        You appear to be offline. Some features may be unavailable.
      </Text>
    </View>
  );
}
