import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { spacing, typography } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

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

function WheelColumn({
  items,
  selectedIndex,
  onSelect,
  width,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number | `${number}%`;
}) {
  const listRef = useRef<FlatList<string>>(null);
  const styles = useThemedStyles(({ colors }) => ({
    column: { width, height: PICKER_HEIGHT },
    item: {
      height: ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemText: {
      ...typography.bodyMd,
      color: colors.inkTertiary,
      fontSize: 18,
    },
    itemTextSelected: {
      color: colors.ink,
      fontWeight: '600',
    },
    highlight: {
      position: 'absolute',
      left: spacing.xs,
      right: spacing.xs,
      top: ITEM_HEIGHT * 2,
      height: ITEM_HEIGHT,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
  }));

  useEffect(() => {
    if (selectedIndex < 0) return;
    listRef.current?.scrollToOffset({
      offset: selectedIndex * ITEM_HEIGHT,
      animated: false,
    });
  }, [selectedIndex, items.length]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    if (clamped !== selectedIndex) {
      onSelect(clamped);
    }
    listRef.current?.scrollToOffset({
      offset: clamped * ITEM_HEIGHT,
      animated: true,
    });
  };

  const renderItem = ({ item, index }: ListRenderItemInfo<string>) => (
    <View style={styles.item}>
      <Text style={[styles.itemText, index === selectedIndex && styles.itemTextSelected]}>{item}</Text>
    </View>
  );

  return (
    <View style={styles.column}>
      <View style={styles.highlight} pointerEvents="none" />
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT * 2,
        }}
        nestedScrollEnabled
        onScrollEndDrag={onScrollEnd}
        onMomentumScrollEnd={onScrollEnd}
      />
    </View>
  );
}

export function DateWheelPicker({
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
  const minYear = minimumDate.getFullYear();
  const maxYear = maximumDate.getFullYear();

  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, index) => String(maxYear - index)),
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

    if (next < minimumDate) {
      onChange(minimumDate);
      return;
    }
    if (next > maximumDate) {
      onChange(maximumDate);
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
