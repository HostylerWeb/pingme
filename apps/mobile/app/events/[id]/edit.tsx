import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { showToast } from '../../../src/stores/toast-store';
import { AppHeader, AppSwitch, Button, Input, LoadingView, Screen, SectionLabel } from '../../../src/components/ui';
import { spacing, typography, useThemedStyles } from '../../../src/theme';

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.getEvent(id!),
    enabled: Boolean(id),
  });

  const event = data?.data;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [allowMessages, setAllowMessages] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (event && !initialized) {
      setTitle(event.title);
      setDescription(event.description);
      setAllowMessages(event.allowMessages);
      setInitialized(true);
    }
  }, [event, initialized]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateEvent(id!, {
        title: title.trim(),
        description: description.trim(),
        allowMessages,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event', id] });
      showToast('Event updated', 'success');
      router.back();
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelEvent(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events-nearby'] });
      showToast('Event cancelled', 'info');
      router.replace('/(tabs)/events');
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const styles = useThemedStyles(({ colors }) => ({
    content: { padding: spacing.container, gap: spacing.lg, paddingBottom: spacing.section },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    hint: { ...typography.caption, color: colors.inkSecondary },
  }));

  if (isLoading || !event) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (!event.isHost) {
    return (
      <Screen>
        <AppHeader title="Edit event" showBrand={false} onBack={() => router.back()} />
        <Text style={styles.hint}>Only the host can edit this event.</Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Edit event" showBrand={false} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Input label="Title" value={title} onChangeText={setTitle} maxLength={120} />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <SectionLabel>Allow messages</SectionLabel>
            <Text style={styles.hint}>Let attendees message you</Text>
          </View>
          <AppSwitch value={allowMessages} onValueChange={setAllowMessages} />
        </View>
        <Button
          label="Save changes"
          loading={updateMutation.isPending}
          onPress={() => updateMutation.mutate()}
        />
        {event.status === 'active' ? (
          <Button
            label="Cancel event"
            variant="danger"
            loading={cancelMutation.isPending}
            onPress={() => cancelMutation.mutate()}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
