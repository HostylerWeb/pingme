import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAppConfig } from '../src/hooks/use-app-config';
import { LEGAL_DOC_TITLES, LegalDoc, resolveLegalUrl } from '../src/lib/legal-url';
import { AppHeader, Screen } from '../src/components/ui';
import { spacing, typography, useThemedStyles } from '../src/theme';

function parseDoc(value: string | string[] | undefined): LegalDoc {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'terms' ? 'terms' : 'privacy';
}

export default function LegalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ doc?: string }>();
  const doc = parseDoc(params.doc);
  const { data: appConfig } = useAppConfig();
  const url = resolveLegalUrl(doc, appConfig ?? undefined);
  const title = LEGAL_DOC_TITLES[doc];

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
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" />
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
