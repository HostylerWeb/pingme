import { PHONE_COUNTRIES, type PhoneCountry } from './phone-countries';

const countriesByDialLength = [...PHONE_COUNTRIES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length,
);

function getDeviceRegion(): string | undefined {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const parts = locale.split(/[-_]/);
    if (parts.length >= 2) return parts[parts.length - 1].toUpperCase();
  } catch {
    // ignore
  }
  return undefined;
}

export function countryFlagEmoji(iso2: string): string {
  const code = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function getDefaultPhoneCountry(): PhoneCountry {
  const region = getDeviceRegion();
  const match = PHONE_COUNTRIES.find((c) => c.iso2 === region);
  return match ?? PHONE_COUNTRIES.find((c) => c.iso2 === 'US') ?? PHONE_COUNTRIES[0];
}

export function findPhoneCountryByIso(iso2: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.iso2 === iso2.toUpperCase());
}

export function parseE164(
  full: string,
): { country: PhoneCountry; national: string } | null {
  const trimmed = full.trim();
  if (!trimmed.startsWith('+')) return null;
  const digits = trimmed.slice(1).replace(/\D/g, '');
  if (!digits) return null;

  for (const country of countriesByDialLength) {
    const codeDigits = country.dialCode.slice(1);
    if (digits.startsWith(codeDigits)) {
      return { country, national: digits.slice(codeDigits.length) };
    }
  }
  return null;
}

export function buildE164(country: PhoneCountry, national: string): string {
  const digits = national.replace(/\D/g, '');
  if (!digits) return '';
  return `${country.dialCode}${digits}`;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone.trim());
}
