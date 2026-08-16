import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AuthBackdrop } from '../../src/components/ui';
import { useTheme } from '../../src/theme';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AuthBackdrop />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
      />
    </View>
  );
}
