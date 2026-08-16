import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { radius, spacing, typography, useThemedStyles } from '../theme';
import { PickerSheet } from './ui/picker-sheet';
import { DateWheelPicker } from './ui/date-wheel-picker';
import { TimeWheelPicker } from './ui/time-wheel-picker';

type PickerTarget = 'starts-date' | 'starts-time' | 'ends-date' | 'ends-time' | null;

type EventScheduleFieldsProps = {
  startsAt: Date;
  endsAt: Date;
  onStartsAtChange: (date: Date) => void;
  onEndsAtChange: (date: Date) => void;
};

const MAX_EVENT_YEARS_AHEAD = 3;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function mergeDateAndTime(datePart: Date, timePart: Date) {
  const merged = new Date(datePart);
  merged.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return merged;
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeLabel(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function maxEventDate() {
  const next = new Date();
  next.setFullYear(next.getFullYear() + MAX_EVENT_YEARS_AHEAD);
  return next;
}

function DateTimeRow({
  label,
  date,
  onOpenDate,
  onOpenTime,
}: {
  label: string;
  date: Date;
  onOpenDate: () => void;
  onOpenTime: () => void;
}) {
  const styles = useThemedStyles(({ colors }) => ({
    row: { gap: spacing.sm },
    label: { ...typography.bodySemiBold, color: colors.ink },
    fields: { flexDirection: 'row', gap: spacing.sm },
    field: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    fieldPressed: { opacity: 0.9 },
    fieldLabel: { ...typography.caption, color: colors.inkSecondary, marginBottom: spacing.xs },
    fieldValue: { ...typography.bodyMd, color: colors.ink },
  }));

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.fields}>
        <Pressable
          style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
          onPress={onOpenDate}
          accessibilityRole="button"
          accessibilityLabel={`${label} date`}
        >
          <Text style={styles.fieldLabel}>Date</Text>
          <Text style={styles.fieldValue}>{formatDateLabel(date)}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
          onPress={onOpenTime}
          accessibilityRole="button"
          accessibilityLabel={`${label} time`}
        >
          <Text style={styles.fieldLabel}>Time</Text>
          <Text style={styles.fieldValue}>{formatTimeLabel(date)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function EventScheduleFields({
  startsAt,
  endsAt,
  onStartsAtChange,
  onEndsAtChange,
}: EventScheduleFieldsProps) {
  const [activePicker, setActivePicker] = useState<PickerTarget>(null);
  const [draft, setDraft] = useState(new Date());
  const now = new Date();
  const todayStart = startOfDay(now);
  const eventMaxDate = useMemo(() => maxEventDate(), []);

  const sheetMeta = useMemo(() => {
    switch (activePicker) {
      case 'starts-date':
        return {
          title: 'Start date',
          mode: 'date' as const,
          minimumDate: todayStart,
          maximumDate: eventMaxDate,
        };
      case 'starts-time':
        return {
          title: 'Start time',
          mode: 'time' as const,
          minimumTime: isSameDay(startsAt, now) ? now : undefined,
        };
      case 'ends-date':
        return {
          title: 'End date',
          mode: 'date' as const,
          minimumDate: startOfDay(startsAt),
          maximumDate: eventMaxDate,
        };
      case 'ends-time':
        return {
          title: 'End time',
          mode: 'time' as const,
          minimumTime: isSameDay(endsAt, startsAt) ? startsAt : undefined,
        };
      default:
        return null;
    }
  }, [activePicker, endsAt, eventMaxDate, now, startsAt, todayStart]);

  const openPicker = (target: PickerTarget, value: Date) => {
    setDraft(new Date(value));
    setActivePicker(target);
  };

  const closePicker = () => setActivePicker(null);

  const updateStartsDate = (picked: Date) => {
    const next = mergeDateAndTime(picked, startsAt);
    const min = isSameDay(picked, now) ? now : todayStart;
    const clamped = next < min ? min : next;
    onStartsAtChange(clamped);
    if (endsAt <= clamped) {
      const end = new Date(clamped);
      end.setHours(end.getHours() + 3);
      onEndsAtChange(end);
    }
  };

  const updateStartsTime = (picked: Date) => {
    const next = mergeDateAndTime(startsAt, picked);
    const clamped = next < now ? now : next;
    onStartsAtChange(clamped);
    if (endsAt <= clamped) {
      const end = new Date(clamped);
      end.setHours(end.getHours() + 3);
      onEndsAtChange(end);
    }
  };

  const updateEndsDate = (picked: Date) => {
    const next = mergeDateAndTime(picked, endsAt);
    onEndsAtChange(next <= startsAt ? new Date(startsAt.getTime() + 60_000) : next);
  };

  const updateEndsTime = (picked: Date) => {
    const next = mergeDateAndTime(endsAt, picked);
    onEndsAtChange(next <= startsAt ? new Date(startsAt.getTime() + 60_000) : next);
  };

  const commitPicker = () => {
    if (!activePicker || !sheetMeta) return;

    if (activePicker === 'starts-date') {
      updateStartsDate(draft);
    } else if (activePicker === 'starts-time') {
      const next = mergeDateAndTime(startsAt, draft);
      const min = sheetMeta.mode === 'time' ? sheetMeta.minimumTime : undefined;
      updateStartsTime(min && next < min ? min : next);
    } else if (activePicker === 'ends-date') {
      updateEndsDate(draft);
    } else if (activePicker === 'ends-time') {
      const next = mergeDateAndTime(endsAt, draft);
      const min = sheetMeta.mode === 'time' ? sheetMeta.minimumTime : undefined;
      updateEndsTime(min && next < min ? min : next);
    }

    closePicker();
  };

  return (
    <>
      <View style={{ gap: spacing.lg }}>
        <DateTimeRow
          label="Starts"
          date={startsAt}
          onOpenDate={() => openPicker('starts-date', startsAt)}
          onOpenTime={() => openPicker('starts-time', startsAt)}
        />
        <DateTimeRow
          label="Ends"
          date={endsAt}
          onOpenDate={() => openPicker('ends-date', endsAt)}
          onOpenTime={() => openPicker('ends-time', endsAt)}
        />
      </View>

      <PickerSheet
        visible={activePicker !== null}
        title={sheetMeta?.title ?? 'Pick date'}
        onClose={closePicker}
        onDone={commitPicker}
      >
        {sheetMeta?.mode === 'date' ? (
          <DateWheelPicker
            value={draft}
            minimumDate={sheetMeta.minimumDate}
            maximumDate={sheetMeta.maximumDate}
            yearOrder="asc"
            onChange={setDraft}
          />
        ) : sheetMeta?.mode === 'time' ? (
          <TimeWheelPicker value={draft} onChange={setDraft} />
        ) : null}
      </PickerSheet>
    </>
  );
}
