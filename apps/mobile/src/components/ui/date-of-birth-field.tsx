import { MIN_AGE_YEARS } from '@pingme/shared';
import { AppIcon } from './app-icon';
import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { radius, spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { DateWheelPicker } from './date-wheel-picker';

function formatDisplayDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function toApiDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseApiDateString(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function getDefaultBirthDate() {
  const today = new Date();
  return new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
}

function getMaximumBirthDate() {
  const today = new Date();
  return new Date(today.getFullYear() - MIN_AGE_YEARS, today.getMonth(), today.getDate());
}

export function DateOfBirthField({
  label = 'Date of birth (18+)',
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (apiValue: string, displayValue: string) => void;
}) {
  const { colors } = useTheme();
  const parsed = parseApiDateString(value);
  const [selectedDate, setSelectedDate] = useState(parsed ?? getDefaultBirthDate());
  const [showPicker, setShowPicker] = useState(false);
  const maximumDate = useMemo(() => getMaximumBirthDate(), []);
  const minimumDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
  }, []);

  const styles = useThemedStyles(({ colors }) => ({
    wrap: { marginBottom: spacing.lg },
    label: {
      ...typography.labelSm,
      color: colors.inkSecondary,
      marginBottom: spacing.sm,
      textTransform: 'none',
      letterSpacing: 0,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
    },
    value: {
      ...typography.bodyMd,
      color: colors.ink,
    },
    placeholder: {
      color: colors.inkMuted,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingBottom: spacing.xl,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    modalTitle: {
      ...typography.bodySemiBold,
      color: colors.ink,
      fontSize: 16,
    },
    modalAction: {
      ...typography.bodySemiBold,
      color: colors.accent,
      fontSize: 16,
    },
  }));

  const displayValue = parsed ? formatDisplayDate(parsed) : '';

  const commitDate = (date: Date) => {
    setSelectedDate(date);
    onChange(toApiDateString(date), formatDisplayDate(date));
  };

  const openPicker = () => {
    setSelectedDate(parsed ?? getDefaultBirthDate());
    setShowPicker(true);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openPicker} style={styles.field} accessibilityRole="button">
        <Text style={[styles.value, !displayValue && styles.placeholder]}>
          {displayValue || 'DD/MM/YYYY'}
        </Text>
        <AppIcon name="calendar" size={20} color={colors.inkTertiary} />
      </Pressable>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPicker(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowPicker(false)}>
                <Text style={[styles.modalAction, { color: colors.inkSecondary }]}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Date of birth</Text>
              <Pressable
                onPress={() => {
                  commitDate(selectedDate);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.modalAction}>Done</Text>
              </Pressable>
            </View>
            <DateWheelPicker
              value={selectedDate}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={setSelectedDate}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
