import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

const expo = appJson.expo as ExpoConfig;

const OTA_URL = process.env.EXPO_OTA_URL ?? 'https://pingme.hostyler.cloud/ota';
const OTA_APP_ID = process.env.EXPO_OTA_APP_ID ?? '';
const OTA_CHANNEL = process.env.EXPO_OTA_CHANNEL ?? 'staging';
const OTA_BRANCH = process.env.EXPO_OTA_BRANCH ?? 'staging';
const otaEnabled = Boolean(OTA_APP_ID);

const plugins: NonNullable<ExpoConfig['plugins']> = [...(expo.plugins ?? [])];
if (otaEnabled) {
  plugins.push([
    'expo-updates',
    {
      codeSigningCertificate: './certs/certificate.pem',
    },
  ]);
}

const STAGING_API_URL = 'https://pingme.hostyler.cloud/v1';
const STAGING_WS_URL = 'wss://pingme.hostyler.cloud/ws';
const STAGING_INVITE_URL = 'https://pingme.hostyler.cloud';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...expo,
  extra: {
    ...(expo.extra ?? {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? STAGING_API_URL,
    wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? STAGING_WS_URL,
    inviteUrl: process.env.EXPO_PUBLIC_INVITE_URL ?? STAGING_INVITE_URL,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  ...(otaEnabled
    ? {
        updates: {
          url: `${OTA_URL}/manifest`,
          checkAutomatically: 'ON_LOAD',
          requestHeaders: {
            'expo-channel-name': OTA_CHANNEL,
            'expo-app-id': OTA_APP_ID,
            'xprem-branch': OTA_BRANCH,
          },
        },
      }
    : {}),
  android: {
    ...expo.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
  plugins,
});
