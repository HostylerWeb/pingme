import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { spacing } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { WheelColumn } from './wheel-column';

const HOUR_LABELS = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] as const;
const MINUTE_LABELS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const PERIOD_LABELS = ['AM', 'PM'] as const;

type Period = (typeof PERIOD_LABELS)[number];

function from24Hour(date: Date) {
  const hours24 = date.getHours();
  const period: Period = hours24 >= 12 ? 'PM' : 'AM';
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return { hour12, minute: date.getMinutes(), period };
}

function to24Hour(hour12: number, minute: number, period: Period) {
  if (period === 'AM') {
    return { hours: hour12 === 12 ? 0 : hour12, minutes: minute };
  }
  return { hours: hour12 === 12 ? 12 : hour12 + 12, minutes: minute };
}

function hour12ToIndex(hour12: number) {
  return hour12 === 12 ? 0 : hour12;
}

export function TimeWheelPicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const initial = from24Hour(value);
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<Period>(initial.period);

  const styles = useThemedStyles(() => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
    },
  }));

  useEffect(() => {
    const next = from24Hour(value);
    setHour12(next.hour12);
    setMinute(next.minute);
    setPeriod(next.period);
  }, [value]);

  const emitChange = (nextHour12: number, nextMinute: number, nextPeriod: Period) => {
    const { hours, minutes } = to24Hour(nextHour12, nextMinute, nextPeriod);
    const next = new Date(value);
    next.setHours(hours, minutes, 0, 0);
    onChange(next);
  };

  const periodIndex = useMemo(() => (period === 'AM' ? 0 : 1), [period]);

  return (
    <View style={styles.row}>
      <WheelColumn
        width="34%"
        items={[...HOUR_LABELS]}
        selectedIndex={hour12ToIndex(hour12)}
        onSelect={(index) => {
          const nextHour = index === 0 ? 12 : index;
          setHour12(nextHour);
          emitChange(nextHour, minute, period);
        }}
      />
      <WheelColumn
        width="33%"
        items={MINUTE_LABELS}
        selectedIndex={minute}
        onSelect={(index) => {
          setMinute(index);
          emitChange(hour12, index, period);
        }}
      />
      <WheelColumn
        width="33%"
        items={[...PERIOD_LABELS]}
        selectedIndex={periodIndex}
        onSelect={(index) => {
          const nextPeriod = PERIOD_LABELS[index];
          setPeriod(nextPeriod);
          emitChange(hour12, minute, nextPeriod);
        }}
      />
    </View>
  );
}
