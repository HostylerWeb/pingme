import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { api } from './api';
import {
  navigateFromNotification,
  parseNotificationData,
  shouldSuppressIncomingBanner,
  type NotificationNavigationPayload,
} from './notification-navigation';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const inForeground = AppState.currentState === 'active';
    const data = notification.request.content.data as { type?: string };
    const isWallReply = data?.type === 'wall.reply';

    return {
      shouldPlaySound: !inForeground,
      shouldSetBadge: false,
      shouldShowBanner: !inForeground,
      shouldShowList: true,
      priority: isWallReply
        ? Notifications.AndroidNotificationPriority.HIGH
        : Notifications.AndroidNotificationPriority.DEFAULT,
    };
  },
});

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('wall-replies', {
    name: 'Wall replies',
    description: 'When someone replies to your Wall post',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
  });
}

function clipField(value: string | undefined, maxLength: number) {
  if (!value) return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

async function getStableDeviceId() {
  try {
    if (Platform.OS === 'android') {
      return Application.getAndroidId() ?? undefined;
    }
    return (await Application.getIosIdForVendorAsync()) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function registerForPushNotifications(options?: { skipPermissionRequest?: boolean }) {
  if (!Device.isDevice) return null;

  try {
    await ensureAndroidChannels();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted' && !options?.skipPermissionRequest) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    const deviceId = await getStableDeviceId();
    const deviceModel = clipField(
      [Device.brand, Device.modelName].filter(Boolean).join(' ').trim() || undefined,
      120,
    );
    const osVersion = clipField(
      Device.osVersion ? `${Device.osName ?? Platform.OS} ${Device.osVersion}` : Device.osName ?? undefined,
      40,
    );

    await api.registerDevice({
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      pushToken: tokenData.data,
      deviceId,
      deviceModel,
      osVersion,
      userAgent: clipField(`${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`.trim(), 500),
      appVersion: clipField(Constants.expoConfig?.version, 40),
    });

    return tokenData.data;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'Push registration skipped:',
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }
}

export async function unregisterPushNotifications() {
  if (!Device.isDevice) return;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (tokenData?.data) {
      await api.unregisterDevice(tokenData.data);
    }
  } catch {
    // Best-effort on logout
  }
}

export async function getInitialNotificationPayload(): Promise<NotificationNavigationPayload | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return null;
  return parseNotificationData(
    response.notification.request.content.data as Record<string, unknown>,
  );
}

export function addNotificationResponseListener(
  onNavigate: (payload: NotificationNavigationPayload) => void,
) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const payload = parseNotificationData(
      response.notification.request.content.data as Record<string, unknown>,
    );
    if (payload) {
      onNavigate(payload);
    }
  });
}

export function addNotificationReceivedListener(
  onReceived: (payload: NotificationNavigationPayload) => void,
) {
  return Notifications.addNotificationReceivedListener((notification) => {
    const payload = parseNotificationData({
      ...(notification.request.content.data as Record<string, unknown>),
      title: notification.request.content.title,
      body: notification.request.content.body,
    });
    if (payload) {
      onReceived(payload);
    }
  });
}

export { navigateFromNotification, parseNotificationData, shouldSuppressIncomingBanner };
export type { NotificationNavigationPayload };
