import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { EventScheduleFields } from '../../src/components/event-datetime-field';
import { EventMapPicker } from '../../src/components/event-map';
import {
  createEmptyGallerySlots,
  EventGallerySlots,
  localUrisFromGallerySlots,
  type EventGallerySlot,
} from '../../src/components/event-gallery-slots';
import { api } from '../../src/lib/api';
import { uploadEventImageFromUri } from '../../src/lib/event-image-upload';
import { useScrollBottomPadding } from '../../src/hooks/use-tab-bar-insets';
import { useAuthStore } from '../../src/stores/auth-store';
import { showToast } from '../../src/stores/toast-store';
import {
  AppHeader,
  AppIcon,
  AppSwitch,
  Button,
  Input,
  Screen,
} from '../../src/components/ui';
import { radius, spacing, typography, useTheme, useThemedStyles } from '../../src/theme';

type MapCenter = { latitude: number; longitude: number };

function defaultStartsAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

function defaultEndsAt(start: Date) {
  const end = new Date(start);
  end.setHours(end.getHours() + 3);
  return end;
}

export default function CreateEventScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [address, setAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ placeName: string; address: string; latitude: number; longitude: number }>
  >([]);
  const [startsAt, setStartsAt] = useState(defaultStartsAt());
  const [endsAt, setEndsAt] = useState(() => defaultEndsAt(defaultStartsAt()));
  const [allowMessages, setAllowMessages] = useState(true);
  const [center, setCenter] = useState<MapCenter | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [countryCode, setCountryCode] = useState<string | undefined>();
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [gallerySlots, setGallerySlots] = useState<EventGallerySlot[]>(createEmptyGallerySlots());
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
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
    if (!user?.idVerified) {
      router.replace('/(setup)/kyc');
    }
  }, [user?.idVerified, router]);

  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      const next = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCenter(next);
      await applyReverseGeocode(next.latitude, next.longitude);
    })();
  }, [applyReverseGeocode]);

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
      setEndsAt(defaultEndsAt(next));
    }
  };

  const pickPoster = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPosterUri(result.assets[0].uri);
    }
  };

  const buildImageUploads = () => {
    const uploads: Array<{ uri: string; isCover: boolean; sortOrder: number }> = [];
    const galleryUris = localUrisFromGallerySlots(gallerySlots);
    if (posterUri) {
      uploads.push({ uri: posterUri, isCover: true, sortOrder: 0 });
    }
    galleryUris.forEach((uri, index) => {
      uploads.push({
        uri,
        isCover: !posterUri && index === 0,
        sortOrder: posterUri ? index + 1 : index,
      });
    });
    return uploads;
  };

  const onSubmit = async () => {
    if (!title.trim() || !description.trim() || !center) {
      showToast('Fill in title, description, and location', 'error');
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      showToast('Start time cannot be in the past', 'error');
      return;
    }
    if (endsAt <= startsAt) {
      showToast('End time must be after start time', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createEvent({
        title: title.trim(),
        description: description.trim(),
        latitude: center.latitude,
        longitude: center.longitude,
        placeName: placeName || undefined,
        address: address || undefined,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        allowMessages,
      });

      const imagesToUpload = buildImageUploads();
      if (imagesToUpload.length > 0) {
        try {
          const urls: Array<{ url: string; isCover?: boolean; sortOrder?: number }> = [];
          for (const image of imagesToUpload) {
            const url = await uploadEventImageFromUri(created.data.id, image.uri);
            urls.push({ url, isCover: image.isCover, sortOrder: image.sortOrder });
          }
          await api.addEventImages(created.data.id, urls);
        } catch {
          showToast('Event created, but photos failed to upload. You can add them from edit.', 'error');
          router.replace(`/events/${created.data.id}`);
          return;
        }
      }

      showToast('Event created!', 'success');
      router.replace(`/events/${created.data.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create event', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLocationLabel =
    placeName || address
      ? placeName || 'Selected location'
      : resolvingLocation
        ? 'Looking up address...'
        : 'Move the map or search to choose a location';

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Create event" showBrand={false} onBack={() => router.back()} />
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
              onLongPress={() => posterUri && setPosterUri(null)}
              style={({ pressed }) => [
                styles.cover,
                !posterUri && styles.coverEmpty,
                pressed && styles.coverPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={posterUri ? 'Change cover photo' : 'Add cover photo'}
            >
              {posterUri ? (
                <>
                  <Image source={{ uri: posterUri }} style={styles.coverImage} resizeMode="cover" />
                  <View style={styles.coverOverlay}>
                    <Text style={styles.coverOverlayText}>Tap to change · hold to remove</Text>
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

        <Button label="Publish event" loading={submitting} onPress={() => void onSubmit()} style={styles.publish} />
      </ScrollView>
    </Screen>
  );
}
