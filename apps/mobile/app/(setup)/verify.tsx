import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';

export default function VerifyScreen() {
  const router = useRouter();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [code, setCode] = useState('');

  const resend = async () => {
    try {
      await api.sendEmailOtp();
      Alert.alert('Code sent', 'Check the API server logs in development.');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not send code';
      Alert.alert('Error', message);
    }
  };

  const verify = async () => {
    try {
      await api.verifyEmail(code.trim());
      await refreshMe();
      router.replace('/(setup)/profile');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Invalid code';
      Alert.alert('Verification failed', message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.hint}>Enter the 6-digit code. In dev, check the API terminal.</Text>
      <TextInput
        style={styles.input}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
      />
      <Pressable style={styles.button} onPress={verify}>
        <Text style={styles.buttonText}>Verify</Text>
      </Pressable>
      <Pressable onPress={resend}>
        <Text style={styles.link}>Resend code</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  hint: { color: '#666', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 20, textAlign: 'center', color: '#2563eb' },
});
