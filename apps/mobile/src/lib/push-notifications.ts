import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
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
    const deviceModel = [Device.brand, Device.modelName].filter(Boolean).join(' ').trim() || undefined;
    const osVersion = Device.osVersion ? `${Device.osName ?? Platform.OS} ${Device.osVersion}` : Device.osName ?? undefined;

    await api.registerDevice({
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      pushToken: tokenData.data,
      deviceId,
      deviceModel,
      osVersion,
      userAgent: `${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`.trim(),
      appVersion: Constants.expoConfig?.version,
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

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

export function addNotificationResponseListener(
  onNavigate: (payload: {
    type: string;
    postId?: string;
    matchId?: string;
    chatId?: string;
  }) => void,
) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      postId?: string;
      matchId?: string;
      chatId?: string;
      type?: string;
    };
    if (data?.type === 'wall.reply' && data.postId) {
      onNavigate({ type: data.type, postId: data.postId });
      return;
    }
    if (data?.type === 'chat.message' && data.chatId) {
      onNavigate({ type: data.type, chatId: data.chatId });
      return;
    }
    if (
      (data?.type === 'icebreaker.match' || data?.type === 'match.request') &&
      data.matchId
    ) {
      onNavigate({ type: data.type, matchId: data.matchId });
    }
  });
}
