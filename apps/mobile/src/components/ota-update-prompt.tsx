import { useState } from 'react';
import { Text, View } from 'react-native';
import type { OtaUpdateState } from '../hooks/use-ota-updates';
import { spacing, typography, useThemedStyles } from '../theme';
import { BottomSheet, Button } from './ui';

export function OtaUpdatePrompt({ state }: { state: OtaUpdateState }) {
  const [restarting, setRestarting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const styles = useThemedStyles(({ colors }) => ({
    body: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
    actions: { gap: spacing.sm },
  }));

  if (state.status !== 'ready' || dismissed) {
    return null;
  }

  return (
    <BottomSheet
      visible
      title="Update available"
      subtitle="A new version of PingMe is ready."
      onClose={() => setDismissed(true)}
    >
      <Text style={styles.body}>
        Restart to load the latest improvements. Your session stays signed in.
      </Text>
      <View style={styles.actions}>
        <Button
          label="Restart now"
          loading={restarting}
          onPress={async () => {
            setRestarting(true);
            try {
              await state.onRestart();
            } finally {
              setRestarting(false);
            }
          }}
        />
        <Button label="Later" variant="ghost" onPress={() => setDismissed(true)} />
      </View>
    </BottomSheet>
  );
}
