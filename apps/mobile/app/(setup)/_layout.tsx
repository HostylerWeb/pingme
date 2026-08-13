import { Stack } from 'expo-router';

export default function SetupLayout() {
  return (
    <Stack>
      <Stack.Screen name="verify" options={{ title: 'Verify email' }} />
      <Stack.Screen name="profile" options={{ title: 'Your profile' }} />
      <Stack.Screen name="location" options={{ title: 'Location', headerShown: false }} />
      <Stack.Screen name="liveness" options={{ title: 'Liveness check', headerShown: false }} />
      <Stack.Screen name="didit-spike" options={{ title: 'Didit spike' }} />
    </Stack>
  );
}
