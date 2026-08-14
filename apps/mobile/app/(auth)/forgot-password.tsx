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
import { api, ApiError } from '../../src/lib/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [usePhone, setUsePhone] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    try {
      const result = await api.forgotPassword(
        usePhone ? { phone: phone.trim() } : { email: email.trim() },
      );
      Alert.alert('Check your inbox', result.message);
      router.push({
        pathname: '/(auth)/reset-password',
        params: usePhone ? { phone: phone.trim() } : { email: email.trim() },
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Request failed';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.hint}>
        Enter your account email or phone. In development, check the API logs for the reset token.
      </Text>

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

      <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send reset link</Text>}
      </Pressable>

      <Link href="/(auth)/login" style={styles.link}>
        Back to login
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  hint: { color: '#666', marginBottom: 20, lineHeight: 20 },
  toggleRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  toggle: { color: '#64748b', fontWeight: '600' },
  toggleActive: { color: '#2563eb' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
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
