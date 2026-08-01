/**
 * The supported locales and everything that varies with them.
 *
 * Six languages, chosen because `world-countries` carries a complete common-name
 * translation for all 195 countries in each — a partial table would silently fall back
 * to English for a handful of countries and read as a bug rather than a limitation.
 * Persian, Urdu, Japanese, Chinese and Russian are equally complete upstream and could
 * be added here with only a dictionary to write.
 *
 * Arabic is the right-to-left case, and it is carried deliberately rather than as a
 * token: the whole interface mirrors for it, which is the only way to know the layout
 * is actually direction-agnostic instead of merely translated.
 */

export type LocaleCode = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ar';

export type Direction = 'ltr' | 'rtl';

export interface LocaleMeta {
  readonly code: LocaleCode;
  /** The language's own name for itself — never the English exonym. */
  readonly label: string;
  readonly english: string;
  readonly dir: Direction;
  /** BCP 47 tag, for Intl formatting of numbers and dates. */
  readonly tag: string;
}

export const LOCALES: readonly LocaleMeta[] = [
  { code: 'en', label: 'English', english: 'English', dir: 'ltr', tag: 'en' },
  { code: 'es', label: 'Español', english: 'Spanish', dir: 'ltr', tag: 'es' },
  { code: 'fr', label: 'Français', english: 'French', dir: 'ltr', tag: 'fr' },
  { code: 'de', label: 'Deutsch', english: 'German', dir: 'ltr', tag: 'de' },
  { code: 'pt', label: 'Português', english: 'Portuguese', dir: 'ltr', tag: 'pt' },
  { code: 'ar', label: 'العربية', english: 'Arabic', dir: 'rtl', tag: 'ar' },
] as const;

export const DEFAULT_LOCALE: LocaleCode = 'en';

const BY_CODE = new Map(LOCALES.map((l) => [l.code, l] as const));

export function localeMeta(code: LocaleCode): LocaleMeta {
  return BY_CODE.get(code) ?? BY_CODE.get(DEFAULT_LOCALE)!;
}

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && BY_CODE.has(value as LocaleCode);
}

/**
 * The best supported match for the browser's stated preferences.
 *
 * Matches on the primary subtag only, so `pt-BR`, `ar-EG` and `es-419` all resolve.
 * Falls back to English rather than guessing, because a wrong guess about direction is
 * far more disorienting than a familiar default.
 */
export function detectLocale(preferred: readonly string[] = navigator.languages ?? []): LocaleCode {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isLocaleCode(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
