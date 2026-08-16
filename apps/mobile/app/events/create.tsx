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
import { MAX_EVENT_GALLERY_IMAGES } from '@pingme/shared';
import { EventScheduleFields } from '../../src/components/event-datetime-field';
import { EventMapPicker } from '../../src/components/event-map';
import { api } from '../../src/lib/api';
import { uploadEventImageFromUri } from '../../src/lib/event-image-upload';
import { useScrollBottomPadding } from '../../src/hooks/use-tab-bar-insets';
import { useAuthStore } from '../../src/stores/auth-store';
import { showToast } from '../../src/stores/toast-store';
import {
  AppHeader,
  AppSwitch,
  Button,
  Input,
  Screen,
  SectionLabel,
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
  const [galleryUris, setGalleryUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
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
    dateHint: { ...typography.caption, color: colors.inkSecondary },
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

  const pickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_EVENT_GALLERY_IMAGES - galleryUris.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      setGalleryUris((prev) =>
        [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_EVENT_GALLERY_IMAGES),
      );
    }
  };

  const buildImageUploads = () => {
    const uploads: Array<{ uri: string; isCover: boolean; sortOrder: number }> = [];
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
        const urls: Array<{ url: string; isCover?: boolean; sortOrder?: number }> = [];
        for (const image of imagesToUpload) {
          const url = await uploadEventImageFromUri(created.data.id, image.uri);
          urls.push({ url, isCover: image.isCover, sortOrder: image.sortOrder });
        }
        await api.addEventImages(created.data.id, urls);
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
          <Text style={styles.dateHint}>Searching places in your current country</Text>
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
              <Pressable key={`${place.latitude}-${place.longitude}`} style={styles.result} onPress={() => selectPlace(place)}>
                <Text style={styles.resultText}>{place.placeName}</Text>
                <Text style={styles.dateHint}>{place.address}</Text>
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
            <Text style={styles.dateHint}>
              {center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}
            </Text>
          ) : null}
        </View>

        <SectionLabel>Poster image</SectionLabel>
        <Text style={styles.dateHint}>Main image shown on the event card and at the top of the page.</Text>
        <View style={styles.imageSlot}>
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={styles.posterThumb} resizeMode="cover" />
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label={posterUri ? 'Change poster' : 'Add poster'}
              variant="secondary"
              size="sm"
              onPress={() => void pickPoster()}
            />
            {posterUri ? (
              <Button label="Remove" variant="secondary" size="sm" onPress={() => setPosterUri(null)} />
            ) : null}
          </View>
        </View>

        <SectionLabel>{`Gallery (optional, up to ${MAX_EVENT_GALLERY_IMAGES})`}</SectionLabel>
        <View style={styles.imagesRow}>
          {galleryUris.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.thumb} />
          ))}
          {galleryUris.length < MAX_EVENT_GALLERY_IMAGES ? (
            <Button label="Add gallery photos" variant="secondary" size="sm" onPress={() => void pickGallery()} />
          ) : null}
        </View>
        {galleryUris.length > 0 ? (
          <Button label="Clear gallery" variant="secondary" size="sm" onPress={() => setGalleryUris([])} />
        ) : null}

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.bodySemiBold, color: colors.ink }}>Allow messages</Text>
            <Text style={styles.dateHint}>Let attendees message you about this event</Text>
          </View>
          <AppSwitch value={allowMessages} onValueChange={setAllowMessages} />
        </View>

        <Button label="Publish event" loading={submitting} onPress={() => void onSubmit()} />
      </ScrollView>
    </Screen>
  );
}
