import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { MAX_EVENT_IMAGES } from '@pingme/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EventScheduleFields } from '../../../src/components/event-datetime-field';
import { EventMapPicker } from '../../../src/components/event-map';
import {
  createEmptyGallerySlots,
  EventGallerySlots,
  gallerySlotsFromRemote,
  localUrisFromGallerySlots,
  remoteIdsMarkedForRemoval,
  type EventGallerySlot,
} from '../../../src/components/event-gallery-slots';
import { api } from '../../../src/lib/api';
import { uploadEventImageFromUri } from '../../../src/lib/event-image-upload';
import { useScrollBottomPadding } from '../../../src/hooks/use-tab-bar-insets';
import { showToast } from '../../../src/stores/toast-store';
import {
  AppHeader,
  AppIcon,
  AppSwitch,
  Button,
  Input,
  LoadingView,
  Screen,
} from '../../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../../src/theme';

type MapCenter = { latitude: number; longitude: number };

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.getEvent(id!),
    enabled: Boolean(id),
  });

  const event = data?.data;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [address, setAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ placeName: string; address: string; latitude: number; longitude: number }>
  >([]);
  const [startsAt, setStartsAt] = useState(new Date());
  const [endsAt, setEndsAt] = useState(new Date());
  const [allowMessages, setAllowMessages] = useState(true);
  const [center, setCenter] = useState<MapCenter | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [countryCode, setCountryCode] = useState<string | undefined>();
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [existingImages, setExistingImages] = useState<
    Array<{ id: string; url: string; isCover: boolean; sortOrder: number }>
  >([]);
  const [newPosterUri, setNewPosterUri] = useState<string | null>(null);
  const [gallerySlots, setGallerySlots] = useState<EventGallerySlot[]>(createEmptyGallerySlots());
  const initialGalleryRemoteIdsRef = useRef<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const scrollBottomPadding = useScrollBottomPadding();

  const styles = useThemedStyles(({ colors }) => ({
    content: { padding: spacing.container, gap: spacing.xl, paddingTop: spacing.md },
    section: { gap: spacing.sm },
    sectionTitle: { ...typography.overline, color: colors.inkTertiary },
    sectionHint: { ...typography.caption, color: colors.inkTertiary, marginTop: -2 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    map: { height: 200, borderRadius: radius.lg, overflow: 'hidden' },
    searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
    searchField: { flex: 1, marginBottom: 0 },
    searchBtn: {
      height: 48,
      width: 48,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBtnPressed: { opacity: 0.85 },
    searchResults: { gap: spacing.xs },
    result: {
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    resultPressed: { opacity: 0.88 },
    resultText: { ...typography.bodySemiBold, color: colors.ink, fontSize: 15 },
    resultAddress: { ...typography.caption, color: colors.inkTertiary, marginTop: 2 },
    locationSummary: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    locationIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationCopy: { flex: 1, minWidth: 0 },
    locationTitle: { ...typography.bodySemiBold, color: colors.ink, fontSize: 15 },
    locationAddress: { ...typography.caption, color: colors.inkSecondary, lineHeight: 18, marginTop: 2 },
    cover: {
      height: 188,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverEmpty: { borderStyle: 'dashed' },
    coverPressed: { opacity: 0.92 },
    coverImage: { width: '100%', height: '100%' },
    coverOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: 'rgba(20,20,20,0.45)',
    },
    coverOverlayText: { ...typography.caption, color: '#FFFFFF', fontSize: 12 },
    coverEmptyLabel: { ...typography.bodySemiBold, color: colors.inkSecondary, marginTop: spacing.sm },
    coverEmptyHint: { ...typography.caption, color: colors.inkTertiary, marginTop: 2 },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    toggleTitle: { ...typography.bodySemiBold, color: colors.ink, fontSize: 15 },
    toggleHint: { ...typography.caption, color: colors.inkTertiary, marginTop: 2, lineHeight: 18 },
    publish: { marginTop: spacing.sm },
    hint: { ...typography.caption, color: colors.inkSecondary },
  }));

  const applyReverseGeocode = useCallback(
    async (latitude: number, longitude: number) => {
      setResolvingLocation(true);
      try {
        const result = await api.geocodeReverse(latitude, longitude);
        if (result.data) {
          setPlaceName(result.data.placeName);
          setAddress(result.data.address);
          if (result.data.countryCode) {
            setCountryCode(result.data.countryCode);
          }
        }
      } catch {
        // ignore reverse geocode failures
      } finally {
        setResolvingLocation(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!event || initialized) return;
    setTitle(event.title);
    setDescription(event.description);
    setPlaceName(event.placeName ?? '');
    setAddress(event.address ?? '');
    setStartsAt(new Date(event.startsAt));
    setEndsAt(new Date(event.endsAt));
    setAllowMessages(event.allowMessages);
    setCenter({ latitude: event.latitude, longitude: event.longitude });
    setExistingImages(event.images);
    const cover = event.images.find((img) => img.isCover) ?? event.images[0] ?? null;
    const gallery = event.images.filter((img) => img.id !== cover?.id);
    initialGalleryRemoteIdsRef.current = gallery.map((img) => img.id);
    setGallerySlots(gallerySlotsFromRemote(gallery));
    setInitialized(true);
    void (async () => {
      try {
        const result = await api.geocodeReverse(event.latitude, event.longitude);
        if (result.data?.countryCode) {
          setCountryCode(result.data.countryCode);
        }
      } catch {
        // ignore
      }
    })();
  }, [event, initialized]);

  const onSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const result = await api.geocodeSearch(searchQuery.trim(), countryCode);
      setSearchResults(result.data);
      if (result.data.length === 0) {
        showToast('No places found in your country. Try a different search.', 'info');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Search failed', 'error');
    } finally {
      setSearching(false);
    }
  };

  const selectPlace = (place: (typeof searchResults)[0]) => {
    setPlaceName(place.placeName);
    setAddress(place.address);
    setCenter({
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setRecenterToken((token) => token + 1);
    setSearchResults([]);
    setSearchQuery('');
  };

  const onStartsAtChange = (next: Date) => {
    setStartsAt(next);
    if (endsAt <= next) {
      const end = new Date(next);
      end.setHours(end.getHours() + 3);
      setEndsAt(end);
    }
  };

  const existingCover = existingImages.find((img) => img.isCover) ?? existingImages[0] ?? null;
  const posterPreview = newPosterUri ?? existingCover?.url ?? null;
  const newGalleryUris = localUrisFromGallerySlots(gallerySlots);
  const filledGalleryCount = gallerySlots.filter((slot) => slot.kind !== 'empty').length;
  const totalImageCount = (posterPreview ? 1 : 0) + filledGalleryCount;

  const pickPoster = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewPosterUri(result.assets[0].uri);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!center) throw new Error('Location is required');
      await api.updateEvent(id!, {
        title: title.trim(),
        description: description.trim(),
        latitude: center.latitude,
        longitude: center.longitude,
        placeName: placeName || null,
        address: address || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        allowMessages,
      });

      const removedGalleryIds = remoteIdsMarkedForRemoval(
        gallerySlots,
        initialGalleryRemoteIdsRef.current,
      );
      for (const imageId of removedGalleryIds) {
        await api.deleteEventImage(id!, imageId);
      }

      const uploads: Array<{ uri: string; isCover: boolean; sortOrder: number }> = [];
      const remainingCount = existingImages.length - removedGalleryIds.length;

      if (newPosterUri) {
        uploads.push({ uri: newPosterUri, isCover: true, sortOrder: 0 });
      }

      newGalleryUris.forEach((uri, index) => {
        uploads.push({
          uri,
          isCover: !newPosterUri && !existingCover && index === 0,
          sortOrder: remainingCount + (newPosterUri ? index + 1 : index),
        });
      });

      if (uploads.length > 0) {
        const urls: Array<{ url: string; isCover?: boolean; sortOrder?: number }> = [];
        for (const image of uploads) {
          const url = await uploadEventImageFromUri(id!, image.uri);
          urls.push({ url, isCover: image.isCover, sortOrder: image.sortOrder });
        }
        await api.addEventImages(id!, urls);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event', id] });
      void queryClient.invalidateQueries({ queryKey: ['events-nearby'] });
      void queryClient.invalidateQueries({ queryKey: ['my-events'] });
      showToast('Event updated', 'success');
      router.back();
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelEvent(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events-nearby'] });
      void queryClient.invalidateQueries({ queryKey: ['my-events'] });
      showToast('Event cancelled', 'info');
      router.replace('/(tabs)/events');
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const onSave = () => {
    if (!title.trim() || !description.trim() || !center) {
      showToast('Fill in title, description, and location', 'error');
      return;
    }
    if (endsAt <= startsAt) {
      showToast('End time must be after start time', 'error');
      return;
    }
    if (totalImageCount > MAX_EVENT_IMAGES) {
      showToast(`Events can have at most ${MAX_EVENT_IMAGES} images`, 'error');
      return;
    }
    updateMutation.mutate();
  };

  const selectedLocationLabel =
    placeName || address
      ? placeName || 'Selected location'
      : resolvingLocation
        ? 'Looking up address...'
        : 'Move the map or search to choose a location';

  if (isError) {
    return (
      <Screen>
        <AppHeader title="Edit event" showBrand={false} onBack={() => router.back()} />
        <Text style={styles.hint}>Couldn’t load this event. Go back and try again.</Text>
      </Screen>
    );
  }

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
      <ScrollView
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.card}>
            <Input
              label="Title"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              placeholder="What’s happening?"
              containerStyle={styles.searchField}
            />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholder="Who it’s for, what to bring, anything people should know"
              containerStyle={styles.searchField}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>When</Text>
          <View style={styles.card}>
            <EventScheduleFields
              startsAt={startsAt}
              endsAt={endsAt}
              onStartsAtChange={onStartsAtChange}
              onEndsAtChange={setEndsAt}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.sectionHint}>
            {countryCode ? 'Search is limited to your current country' : 'Search a place or drag the map pin'}
          </Text>
          <View style={styles.card}>
            <View style={styles.searchRow}>
              <Input
                label="Search"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => void onSearch()}
                returnKeyType="search"
                placeholder="Park, cafe, venue…"
                containerStyle={styles.searchField}
              />
              <Pressable
                onPress={() => void onSearch()}
                disabled={searching}
                accessibilityRole="button"
                accessibilityLabel="Search places"
                style={({ pressed }) => [styles.searchBtn, pressed && styles.searchBtnPressed]}
              >
                {searching ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <AppIcon name="location" size={20} color={colors.ink} />
                )}
              </Pressable>
            </View>
            {searchResults.length > 0 ? (
              <View style={styles.searchResults}>
                {searchResults.map((place) => (
                  <Pressable
                    key={`${place.latitude}-${place.longitude}`}
                    style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
                    onPress={() => selectPlace(place)}
                  >
                    <Text style={styles.resultText}>{place.placeName}</Text>
                    <Text style={styles.resultAddress}>{place.address}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {center ? (
              <View
                onTouchStart={() => setScrollEnabled(false)}
                onTouchEnd={() => setScrollEnabled(true)}
                onTouchCancel={() => setScrollEnabled(true)}
              >
                <EventMapPicker
                  style={styles.map}
                  latitude={center.latitude}
                  longitude={center.longitude}
                  recenterToken={recenterToken}
                  onCoordinateChange={(next) => {
                    setCenter(next);
                    void applyReverseGeocode(next.latitude, next.longitude);
                  }}
                />
              </View>
            ) : (
              <ActivityIndicator />
            )}

            <View style={styles.locationSummary}>
              <View style={styles.locationIcon}>
                <AppIcon name="location" size={18} color={colors.accent} />
              </View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationTitle}>{selectedLocationLabel}</Text>
                {address ? <Text style={styles.locationAddress}>{address}</Text> : null}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <Text style={styles.sectionHint}>Cover shows on the event card. Gallery is optional.</Text>
          <View style={styles.card}>
            <Pressable
              onPress={() => void pickPoster()}
              onLongPress={() => newPosterUri && setNewPosterUri(null)}
              style={({ pressed }) => [
                styles.cover,
                !posterPreview && styles.coverEmpty,
                pressed && styles.coverPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={posterPreview ? 'Change cover photo' : 'Add cover photo'}
            >
              {posterPreview ? (
                <>
                  <Image source={{ uri: posterPreview }} style={styles.coverImage} resizeMode="cover" />
                  <View style={styles.coverOverlay}>
                    <Text style={styles.coverOverlayText}>
                      {newPosterUri ? 'Tap to change · hold to undo' : 'Tap to change cover'}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <AppIcon name="camera" size={28} color={colors.inkTertiary} />
                  <Text style={styles.coverEmptyLabel}>Add a cover photo</Text>
                  <Text style={styles.coverEmptyHint}>Shown at the top of your event</Text>
                </>
              )}
            </Pressable>
            <EventGallerySlots slots={gallerySlots} onChange={setGallerySlots} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hosting</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Allow messages</Text>
                <Text style={styles.toggleHint}>Attendees can message you about this event</Text>
              </View>
              <AppSwitch value={allowMessages} onValueChange={setAllowMessages} />
            </View>
          </View>
        </View>

        <Button label="Save changes" loading={updateMutation.isPending} onPress={onSave} style={styles.publish} />
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
