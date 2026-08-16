import { useEffect, useRef } from 'react';
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

export const WHEEL_ITEM_HEIGHT = 44;
export const WHEEL_VISIBLE_ROWS = 5;
export const WHEEL_PICKER_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;

export function WheelColumn({
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
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  const styles = useThemedStyles(({ colors }) => ({
    column: { width, height: WHEEL_PICKER_HEIGHT },
    item: {
      height: WHEEL_ITEM_HEIGHT,
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
      top: WHEEL_ITEM_HEIGHT * 2,
      height: WHEEL_ITEM_HEIGHT,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
  }));

  useEffect(() => {
    if (selectedIndex < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: selectedIndex * WHEEL_ITEM_HEIGHT,
        animated: false,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedIndex, items.length]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    const targetOffset = clamped * WHEEL_ITEM_HEIGHT;
    const currentOffset = event.nativeEvent.contentOffset.y;

    if (clamped !== selectedIndexRef.current) {
      onSelect(clamped);
      return;
    }

    if (Math.abs(currentOffset - targetOffset) > 1) {
      listRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: false,
      });
    }
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
        snapToInterval={WHEEL_ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: WHEEL_ITEM_HEIGHT,
          offset: WHEEL_ITEM_HEIGHT * index,
          index,
        })}
        contentContainerStyle={{
          paddingVertical: WHEEL_ITEM_HEIGHT * 2,
        }}
        onScrollEndDrag={onScrollEnd}
        onMomentumScrollEnd={onScrollEnd}
      />
    </View>
  );
}
