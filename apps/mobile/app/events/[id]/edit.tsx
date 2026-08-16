import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { MAX_EVENT_GALLERY_IMAGES, MAX_EVENT_IMAGES } from '@pingme/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EventScheduleFields } from '../../../src/components/event-datetime-field';
import { EventMapPicker } from '../../../src/components/event-map';
import { api } from '../../../src/lib/api';
import { uploadEventImageFromUri } from '../../../src/lib/event-image-upload';
import { useScrollBottomPadding } from '../../../src/hooks/use-tab-bar-insets';
import { showToast } from '../../../src/stores/toast-store';
import {
  AppHeader,
  AppSwitch,
  Button,
  Input,
  LoadingView,
  Screen,
  SectionLabel,
} from '../../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../../src/theme';

type MapCenter = { latitude: number; longitude: number };

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const { data, isLoading } = useQuery({
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
  const [newGalleryUris, setNewGalleryUris] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const scrollBottomPadding = useScrollBottomPadding();

  const styles = useThemedStyles(({ colors }) => ({
    content: { padding: spacing.container, gap: spacing.lg },
    map: { height: 220, borderRadius: radius.xl, overflow: 'hidden' },
    searchResults: { gap: spacing.sm },
    result: {
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resultText: { ...typography.bodyMd, color: colors.ink },
    imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    posterThumb: { width: '100%', height: 160, borderRadius: radius.xl },
    thumb: { width: 72, height: 72, borderRadius: radius.md },
    imageSlot: { gap: spacing.sm },
    hint: { ...typography.caption, color: colors.inkSecondary },
    locationCard: {
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.xs,
    },
    locationTitle: { ...typography.bodySemiBold, color: colors.ink },
    locationAddress: { ...typography.bodyMd, color: colors.inkSecondary, lineHeight: 22 },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
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
  const existingGallery = existingImages.filter((img) => img.id !== existingCover?.id);
  const posterPreview = newPosterUri ?? existingCover?.url ?? null;
  const totalImageCount =
    existingImages.length + (newPosterUri ? 1 : 0) + newGalleryUris.length;
  const gallerySlotsLeft = Math.max(
    0,
    MAX_EVENT_IMAGES - existingImages.length - (newPosterUri ? 1 : 0),
  );

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

  const pickGallery = async () => {
    const remaining = Math.min(MAX_EVENT_GALLERY_IMAGES, gallerySlotsLeft);
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining - newGalleryUris.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      setNewGalleryUris((prev) =>
        [...prev, ...result.assets.map((a) => a.uri)].slice(0, remaining),
      );
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

      const uploads: Array<{ uri: string; isCover: boolean; sortOrder: number }> = [];
      const baseSort = existingImages.length;

      if (newPosterUri) {
        uploads.push({ uri: newPosterUri, isCover: true, sortOrder: 0 });
      }

      newGalleryUris.forEach((uri, index) => {
        uploads.push({
          uri,
          isCover: !newPosterUri && !existingCover && index === 0,
          sortOrder: baseSort + (newPosterUri ? index + 1 : index),
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
        <Input label="Title" value={title} onChangeText={setTitle} maxLength={120} />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <SectionLabel>When</SectionLabel>
        <EventScheduleFields
          startsAt={startsAt}
          endsAt={endsAt}
          onStartsAtChange={onStartsAtChange}
          onEndsAtChange={setEndsAt}
        />

        <SectionLabel>Location</SectionLabel>
        {countryCode ? (
          <Text style={styles.hint}>Searching places in your current country</Text>
        ) : null}
        <Input
          label="Search place"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => void onSearch()}
          returnKeyType="search"
        />
        <Button label="Search" variant="secondary" loading={searching} onPress={() => void onSearch()} />
        {searchResults.length > 0 ? (
          <View style={styles.searchResults}>
            {searchResults.map((place) => (
              <Pressable
                key={`${place.latitude}-${place.longitude}`}
                style={styles.result}
                onPress={() => selectPlace(place)}
              >
                <Text style={styles.resultText}>{place.placeName}</Text>
                <Text style={styles.hint}>{place.address}</Text>
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

        <View style={styles.locationCard}>
          <Text style={styles.locationTitle}>{selectedLocationLabel}</Text>
          {address ? <Text style={styles.locationAddress}>{address}</Text> : null}
          {center ? (
            <Text style={styles.hint}>
              {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
            </Text>
          ) : null}
        </View>

        <SectionLabel>Poster image</SectionLabel>
        <Text style={styles.hint}>Main image shown on the event card and at the top of the page.</Text>
        <View style={styles.imageSlot}>
          {posterPreview ? (
            <Image source={{ uri: posterPreview }} style={styles.posterThumb} resizeMode="cover" />
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label={posterPreview ? 'Change poster' : 'Add poster'}
              variant="secondary"
              size="sm"
              onPress={() => void pickPoster()}
            />
            {newPosterUri ? (
              <Button
                label="Undo poster"
                variant="secondary"
                size="sm"
                onPress={() => setNewPosterUri(null)}
              />
            ) : null}
          </View>
        </View>

        <SectionLabel>{`Gallery (optional, up to ${MAX_EVENT_GALLERY_IMAGES})`}</SectionLabel>
        <View style={styles.imagesRow}>
          {existingGallery.map((img) => (
            <Image key={img.id} source={{ uri: img.url }} style={styles.thumb} />
          ))}
          {newGalleryUris.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.thumb} />
          ))}
          {gallerySlotsLeft > newGalleryUris.length ? (
            <Button label="Add gallery photos" variant="secondary" size="sm" onPress={() => void pickGallery()} />
          ) : null}
        </View>
        {newGalleryUris.length > 0 ? (
          <Button label="Clear new gallery photos" variant="secondary" size="sm" onPress={() => setNewGalleryUris([])} />
        ) : null}

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodySemiBold, color: colors.ink }}>Allow messages</Text>
            <Text style={styles.hint}>Let attendees message you about this event</Text>
          </View>
          <AppSwitch value={allowMessages} onValueChange={setAllowMessages} />
        </View>

        <Button label="Save changes" loading={updateMutation.isPending} onPress={onSave} />
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
