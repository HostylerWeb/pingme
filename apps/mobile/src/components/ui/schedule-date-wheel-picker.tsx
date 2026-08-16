import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { spacing } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { WheelColumn } from './wheel-column';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDay(year: number, monthIndex: number, day: number) {
  return Math.min(day, daysInMonth(year, monthIndex));
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function ScheduleDateWheelPicker({
  value,
  minimumDate,
  maximumDate,
  onChange,
}: {
  value: Date;
  minimumDate: Date;
  maximumDate: Date;
  onChange: (date: Date) => void;
}) {
  const min = startOfDay(minimumDate);
  const max = startOfDay(maximumDate);
  const minYear = min.getFullYear();
  const maxYear = max.getFullYear();

  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, index) => String(minYear + index)),
    [maxYear, minYear],
  );

  const [day, setDay] = useState(value.getDate());
  const [monthIndex, setMonthIndex] = useState(value.getMonth());
  const [year, setYear] = useState(value.getFullYear());

  const days = useMemo(() => {
    const count = daysInMonth(year, monthIndex);
    return Array.from({ length: count }, (_, index) => String(index + 1).padStart(2, '0'));
  }, [monthIndex, year]);

  const styles = useThemedStyles(() => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
    },
  }));

  useEffect(() => {
    setDay(value.getDate());
    setMonthIndex(value.getMonth());
    setYear(value.getFullYear());
  }, [value]);

  const emitChange = (nextDay: number, nextMonthIndex: number, nextYear: number) => {
    const clampedDay = clampDay(nextYear, nextMonthIndex, nextDay);
    const next = new Date(nextYear, nextMonthIndex, clampedDay);

    if (next < min) {
      onChange(min);
      return;
    }
    if (next > max) {
      onChange(max);
      return;
    }

    onChange(next);
  };

  const yearIndex = Math.max(0, years.indexOf(String(year)));
  const dayIndex = Math.max(0, Math.min(day - 1, days.length - 1));

  return (
    <View style={styles.row}>
      <WheelColumn
        width="28%"
        items={days}
        selectedIndex={dayIndex}
        onSelect={(index) => {
          const nextDay = index + 1;
          setDay(nextDay);
          emitChange(nextDay, monthIndex, year);
        }}
      />
      <WheelColumn
        width="34%"
        items={[...MONTHS]}
        selectedIndex={monthIndex}
        onSelect={(index) => {
          const nextDay = clampDay(year, index, day);
          setMonthIndex(index);
          setDay(nextDay);
          emitChange(nextDay, index, year);
        }}
      />
      <WheelColumn
        width="38%"
        items={years}
        selectedIndex={yearIndex}
        onSelect={(index) => {
          const nextYear = Number(years[index]);
          const nextDay = clampDay(nextYear, monthIndex, day);
          setYear(nextYear);
          setDay(nextDay);
          emitChange(nextDay, monthIndex, nextYear);
        }}
      />
    </View>
  );
}
