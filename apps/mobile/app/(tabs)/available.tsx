import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { api } from '../../src/lib/api';
import {
  requestBackgroundPermissions,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '../../src/lib/background-location';
import { useLocationPing } from '../../src/hooks/use-location-ping';

export default function AvailableScreen() {
  const queryClient = useQueryClient();
  const { requestPermission } = useLocationPing(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: statusData } = useQuery({
    queryKey: ['presence-status'],
    queryFn: () => api.getPresenceStatus(),
  });

  const mutation = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      if (isAvailable) {
        const foregroundGranted = await requestPermission();
        if (!foregroundGranted) {
          throw new Error('Location permission is required to go Available.');
        }
        const backgroundGranted = await requestBackgroundPermissions();
        if (!backgroundGranted) {
          // Degrade to foreground-only per Phase 3 plan
          console.warn('Background location denied — foreground-only mode');
        } else {
          await startBackgroundLocation();
        }
      } else {
        await stopBackgroundLocation();
      }

      return api.setAvailable(isAvailable);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presence-status'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-count'] });
      setConfirmOpen(false);
    },
    onError: (error: Error) => {
      alert(error.message);
      setConfirmOpen(false);
    },
  });

  const isAvailable = statusData?.data.isAvailable ?? false;

  const onToggle = (value: boolean) => {
    if (value) {
      setConfirmOpen(true);
      return;
    }
    mutation.mutate(false);
  };

  const confirmAvailable = () => {
    mutation.mutate(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available mode</Text>
      <Text style={styles.hint}>
        When ON, people nearby can see you&apos;re open to connect. PingMe will keep your location
        updated in the background while Available (best-effort every few minutes).
      </Text>

      {isAvailable && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>You&apos;re available nearby</Text>
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.rowLabel}>I&apos;m available nearby</Text>
        <Switch
          value={isAvailable}
          onValueChange={onToggle}
          disabled={mutation.isPending}
        />
      </View>

      <Text style={styles.meta}>
        Last location ping: {statusData?.data.lastPingAt ? 'recent' : 'not yet'}
      </Text>

      <Modal visible={confirmOpen} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Go Available?</Text>
            <Text style={styles.modalBody}>
              People within ~250m can see you&apos;re open to connect. PingMe may use background
              location while Available is ON. You can turn it off anytime.
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setConfirmOpen(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmButton} onPress={confirmAvailable}>
                {mutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmText}>Turn on</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 56, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  hint: { fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 20 },
  banner: {
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  bannerText: { color: '#166534', fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  meta: { marginTop: 16, color: '#94a3b8', fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  modalBody: { fontSize: 15, lineHeight: 22, color: '#475569', marginBottom: 20 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancel: { color: '#64748b', fontSize: 16 },
  confirmButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontWeight: '600' },
});
