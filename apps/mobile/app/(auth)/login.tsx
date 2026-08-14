import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth-store';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [usePhone, setUsePhone] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async () => {
    try {
      if (usePhone) {
        await login(phone.trim(), password, 'phone');
      } else {
        await login(email.trim(), password, 'email');
      }
      router.replace('/(tabs)/home');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Login failed';
      Alert.alert('Login failed', message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>

      <View style={styles.toggleRow}>
        <Pressable onPress={() => setUsePhone(false)}>
          <Text style={[styles.toggle, !usePhone && styles.toggleActive]}>Email</Text>
        </Pressable>
        <Pressable onPress={() => setUsePhone(true)}>
          <Text style={[styles.toggle, usePhone && styles.toggleActive]}>Phone</Text>
        </Pressable>
      </View>

      {usePhone ? (
        <TextInput
          style={styles.input}
          placeholder="+15551234567"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.button} onPress={onSubmit} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
      </Pressable>
      <Link href="/(auth)/forgot-password" style={styles.link}>
        Forgot password?
      </Link>
      <Link href="/(auth)/register" style={styles.link}>
        Create an account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  toggleRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  toggle: { color: '#64748b', fontWeight: '600' },
  toggleActive: { color: '#2563eb' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 20, textAlign: 'center', color: '#2563eb', fontSize: 16 },
});
