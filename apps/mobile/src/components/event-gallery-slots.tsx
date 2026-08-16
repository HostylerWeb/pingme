import { MAX_EVENT_GALLERY_IMAGES } from '@pingme/shared';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { AppIcon } from './ui/app-icon';
import { radius, spacing, useTheme, useThemedStyles } from '../theme';

export type EventGallerySlot =
  | { kind: 'empty' }
  | { kind: 'local'; uri: string }
  | { kind: 'remote'; id: string; url: string };

type EventGallerySlotsProps = {
  slots: EventGallerySlot[];
  onChange: (slots: EventGallerySlot[]) => void;
  maxSlots?: number;
};

function slotImageUri(slot: EventGallerySlot) {
  if (slot.kind === 'local') return slot.uri;
  if (slot.kind === 'remote') return slot.url;
  return null;
}

export function createEmptyGallerySlots(count = MAX_EVENT_GALLERY_IMAGES): EventGallerySlot[] {
  return Array.from({ length: count }, () => ({ kind: 'empty' as const }));
}

export function gallerySlotsFromUris(uris: string[], count = MAX_EVENT_GALLERY_IMAGES): EventGallerySlot[] {
  const slots = createEmptyGallerySlots(count);
  uris.forEach((uri, index) => {
    if (index < count) {
      slots[index] = { kind: 'local', uri };
    }
  });
  return slots;
}

export function gallerySlotsFromRemote(
  images: Array<{ id: string; url: string }>,
  count = MAX_EVENT_GALLERY_IMAGES,
): EventGallerySlot[] {
  const slots = createEmptyGallerySlots(count);
  images.forEach((image, index) => {
    if (index < count) {
      slots[index] = { kind: 'remote', id: image.id, url: image.url };
    }
  });
  return slots;
}

export function localUrisFromGallerySlots(slots: EventGallerySlot[]) {
  return slots
    .filter((slot): slot is { kind: 'local'; uri: string } => slot.kind === 'local')
    .map((slot) => slot.uri);
}

export function remoteIdsMarkedForRemoval(slots: EventGallerySlot[], originalRemoteIds: string[]) {
  const remainingRemoteIds = new Set(
    slots.filter((slot): slot is { kind: 'remote'; id: string; url: string } => slot.kind === 'remote').map((s) => s.id),
  );
  return originalRemoteIds.filter((id) => !remainingRemoteIds.has(id));
}

export function EventGallerySlots({
  slots,
  onChange,
  maxSlots = MAX_EVENT_GALLERY_IMAGES,
}: EventGallerySlotsProps) {
  const { colors } = useTheme();
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const styles = useThemedStyles(({ colors }) => ({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    slot: {
      width: '48%',
      aspectRatio: 1,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    slotEmpty: {
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    slotPressed: { opacity: 0.92 },
    image: { width: '100%', height: '100%' },
    removeOverlay: {
      ...({
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      } as const),
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }));

  const pickForSlot = async (index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const next = [...slots];
    while (next.length < maxSlots) {
      next.push({ kind: 'empty' });
    }
    next[index] = { kind: 'local', uri: result.assets[0].uri };
    onChange(next.slice(0, maxSlots));
    setActiveSlot(null);
  };

  const removeSlot = (index: number) => {
    const next = [...slots];
    next[index] = { kind: 'empty' };
    onChange(next);
    setActiveSlot(null);
  };

  const displaySlots = Array.from({ length: maxSlots }, (_, index) => slots[index] ?? { kind: 'empty' as const });

  return (
    <View style={styles.row}>
      {displaySlots.map((slot, index) => {
        const uri = slotImageUri(slot);
        const isActive = activeSlot === index;

        if (!uri) {
          return (
            <Pressable
              key={`slot-${index}`}
              style={({ pressed }) => [styles.slot, styles.slotEmpty, pressed && styles.slotPressed]}
              onPress={() => void pickForSlot(index)}
              accessibilityRole="button"
              accessibilityLabel={`Add gallery photo ${index + 1}`}
            >
              <AppIcon name="add" size={28} color={colors.inkTertiary} />
            </Pressable>
          );
        }

        return (
          <Pressable
            key={`slot-${index}-${uri}`}
            style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}
            onPress={() => setActiveSlot(isActive ? null : index)}
            accessibilityRole="button"
            accessibilityLabel={`Gallery photo ${index + 1}`}
          >
            <Image source={{ uri }} style={styles.image} resizeMode="cover" />
            {isActive ? (
              <Pressable
                style={styles.removeOverlay}
                onPress={() => removeSlot(index)}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <AppIcon name="delete" size={28} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
