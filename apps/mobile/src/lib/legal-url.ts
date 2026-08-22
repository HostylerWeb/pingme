import { getApiUrl } from './api-url';

export type LegalDoc = 'privacy' | 'terms';

export function defaultLegalUrl(doc: LegalDoc): string {
  const file = doc === 'privacy' ? 'privacy.html' : 'terms.html';
  const explicit =
    doc === 'privacy'
      ? process.env.EXPO_PUBLIC_PRIVACY_URL
      : process.env.EXPO_PUBLIC_TERMS_URL;
  if (explicit) return explicit;
  return `${getApiUrl().replace(/\/$/, '')}/legal/${file}`;
}

export function resolveLegalUrl(
  doc: LegalDoc,
  appConfig?: { privacyPolicyUrl?: string; termsOfServiceUrl?: string } | null,
): string {
  if (doc === 'privacy' && appConfig?.privacyPolicyUrl) {
    return appConfig.privacyPolicyUrl;
  }
  if (doc === 'terms' && appConfig?.termsOfServiceUrl) {
    return appConfig.termsOfServiceUrl;
  }
  return defaultLegalUrl(doc);
}

export const LEGAL_DOC_TITLES: Record<LegalDoc, string> = {
  privacy: 'Privacy policy',
  terms: 'Terms of service',
};
