import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAppConfig } from '../src/hooks/use-app-config';
import { LEGAL_DOC_TITLES, LegalDoc, resolveLegalUrl } from '../src/lib/legal-url';
import { AppHeader, Screen } from '../src/components/ui';
import { spacing, typography, useTheme, useThemedStyles } from '../src/theme';

function parseDoc(value: string | string[] | undefined): LegalDoc {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'terms' ? 'terms' : 'privacy';
}

const LEGAL_DARK_CSS = `
  html, body {
    color: #F5F4F0 !important;
    background: #121110 !important;
  }
  h1, h2, h3, p, li, strong, em {
    color: #F5F4F0 !important;
  }
  .note {
    background: #262522 !important;
    color: #C4C2BC !important;
    border: 1px solid #3A3935 !important;
  }
  a {
    color: #E05A42 !important;
  }
`;

function buildLegalInjectScript(isDark: boolean) {
  if (!isDark) return undefined;
  return `(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(LEGAL_DARK_CSS)};document.head.appendChild(s);})();true;`;
}

export default function LegalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ doc?: string }>();
  const doc = parseDoc(params.doc);
  const { data: appConfig } = useAppConfig();
  const url = resolveLegalUrl(doc, appConfig ?? undefined);
  const title = LEGAL_DOC_TITLES[doc];
  const { colors, isDark } = useTheme();
  const injectScript = useMemo(() => buildLegalInjectScript(isDark), [isDark]);

  const styles = useThemedStyles(({ colors }) => ({
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    webview: { flex: 1, backgroundColor: colors.background },
    error: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
      textAlign: 'center',
      padding: spacing.container,
    },
  }));

  return (
    <Screen padded={false} edges={[]}>
      <AppHeader title={title} showBrand={false} onBack={() => router.back()} />
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        startInLoadingState
        forceDarkOn={Platform.OS === 'android' ? isDark : undefined}
        injectedJavaScriptBeforeContentLoaded={injectScript}
        injectedJavaScript={injectScript}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}
        renderError={() => (
          <View style={styles.loader}>
            <Text style={styles.error}>Could not load this page. Check your connection and try again.</Text>
          </View>
        )}
      />
    </Screen>
  );
}
