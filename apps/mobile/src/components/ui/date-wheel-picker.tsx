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

export function DateWheelPicker({
  value,
  minimumDate,
  maximumDate,
  onChange,
  yearOrder = 'desc',
}: {
  value: Date;
  minimumDate: Date;
  maximumDate: Date;
  onChange: (date: Date) => void;
  yearOrder?: 'asc' | 'desc';
}) {
  const minYear = minimumDate.getFullYear();
  const maxYear = maximumDate.getFullYear();

  const years = useMemo(() => {
    const count = maxYear - minYear + 1;
    return yearOrder === 'asc'
      ? Array.from({ length: count }, (_, index) => String(minYear + index))
      : Array.from({ length: count }, (_, index) => String(maxYear - index));
  }, [maxYear, minYear, yearOrder]);

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

  const valueDay = value.getDate();
  const valueMonth = value.getMonth();
  const valueYear = value.getFullYear();

  useEffect(() => {
    setDay((current) => (current === valueDay ? current : valueDay));
    setMonthIndex((current) => (current === valueMonth ? current : valueMonth));
    setYear((current) => (current === valueYear ? current : valueYear));
  }, [valueDay, valueMonth, valueYear]);

  const emitChange = (nextDay: number, nextMonthIndex: number, nextYear: number) => {
    const clampedDay = clampDay(nextYear, nextMonthIndex, nextDay);
    let next = new Date(nextYear, nextMonthIndex, clampedDay);

    if (next < minimumDate) {
      next = minimumDate;
    } else if (next > maximumDate) {
      next = maximumDate;
    }

    const resolvedDay = next.getDate();
    const resolvedMonth = next.getMonth();
    const resolvedYear = next.getFullYear();

    setDay(resolvedDay);
    setMonthIndex(resolvedMonth);
    setYear(resolvedYear);
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
