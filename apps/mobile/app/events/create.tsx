import MapView, { Marker, Region } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { MAX_EVENT_IMAGES } from '@pingme/shared';
import { api } from '../../src/lib/api';
import { uploadEventImageFromUri } from '../../src/lib/event-image-upload';
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

function defaultStartsAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
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
  const [endsAt, setEndsAt] = useState(() => {
    const end = defaultStartsAt();
    end.setHours(end.getHours() + 3);
    return end;
  });
  const [allowMessages, setAllowMessages] = useState(true);
  const [region, setRegion] = useState<Region | null>(null);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);

  const styles = useThemedStyles(({ colors }) => ({
    content: { padding: spacing.container, gap: spacing.lg, paddingBottom: spacing.section },
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
    thumb: { width: 72, height: 72, borderRadius: radius.md },
    dateHint: { ...typography.caption, color: colors.inkSecondary },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
  }));

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
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    })();
  }, []);

  const onSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const result = await api.geocodeSearch(searchQuery.trim());
      setSearchResults(result.data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Search failed', 'error');
    } finally {
      setSearching(false);
    }
  };

  const selectPlace = (place: (typeof searchResults)[0]) => {
    setPlaceName(place.placeName);
    setAddress(place.address);
    setRegion({
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_EVENT_IMAGES - imageUris.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUris((prev) =>
        [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_EVENT_IMAGES),
      );
    }
  };

  const onSubmit = async () => {
    if (!title.trim() || !description.trim() || !region) {
      showToast('Fill in title, description, and location', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createEvent({
        title: title.trim(),
        description: description.trim(),
        latitude: region.latitude,
        longitude: region.longitude,
        placeName: placeName || undefined,
        address: address || undefined,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        allowMessages,
      });

      if (imageUris.length > 0) {
        const urls: Array<{ url: string; isCover?: boolean; sortOrder?: number }> = [];
        for (let i = 0; i < imageUris.length; i++) {
          const url = await uploadEventImageFromUri(created.data.id, imageUris[i]);
          urls.push({ url, isCover: i === 0, sortOrder: i });
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

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title="Create event" showBrand={false} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Input label="Title" value={title} onChangeText={setTitle} maxLength={120} />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <SectionLabel>When</SectionLabel>
        <Text style={styles.dateHint}>
          Starts {startsAt.toLocaleString()} · Ends {endsAt.toLocaleString()}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label="+1 day"
            variant="secondary"
            size="sm"
            onPress={() => {
              const next = new Date(startsAt);
              next.setDate(next.getDate() + 1);
              setStartsAt(next);
              const end = new Date(next);
              end.setHours(end.getHours() + 3);
              setEndsAt(end);
            }}
          />
          <Button
            label="+1 hour"
            variant="secondary"
            size="sm"
            onPress={() => {
              const end = new Date(endsAt);
              end.setHours(end.getHours() + 1);
              setEndsAt(end);
            }}
          />
        </View>

        <SectionLabel>Location</SectionLabel>
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

        {region ? (
          <MapView
            style={styles.map}
            region={region}
            onRegionChangeComplete={async (next) => {
              setRegion(next);
              try {
                const result = await api.geocodeReverse(next.latitude, next.longitude);
                if (result.data) {
                  setPlaceName(result.data.placeName);
                  setAddress(result.data.address);
                }
              } catch {
                // ignore reverse geocode failures while panning
              }
            }}
          >
            <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} draggable />
          </MapView>
        ) : (
          <ActivityIndicator />
        )}

        <SectionLabel>{`Photos (up to ${MAX_EVENT_IMAGES})`}</SectionLabel>
        <View style={styles.imagesRow}>
          {imageUris.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.thumb} />
          ))}
          {imageUris.length < MAX_EVENT_IMAGES ? (
            <Button label="Add photos" variant="secondary" size="sm" onPress={() => void pickImages()} />
          ) : null}
        </View>

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
