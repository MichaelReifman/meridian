/**
 * Translation lookup, locale-aware formatting, and the bidi helper.
 *
 * Hand-rolled rather than i18next: the app has one namespace, no pluralisation beyond
 * a handful of counts, and no runtime loading — a typed record and a substitution
 * function do the whole job in a page of code, with the key set checked at compile time
 * and nothing shipped that is not used.
 */

import { useCallback, useMemo } from 'react';

import { EN, type Dictionary, type TranslationKey } from '@/i18n/en';
import { AR } from '@/i18n/ar';
import { DE } from '@/i18n/de';
import { ES } from '@/i18n/es';
import { FR } from '@/i18n/fr';
import { PT } from '@/i18n/pt';
import { COUNTRY_NAMES } from '@/data/countryNames.generated';
import { localeMeta, type LocaleCode } from '@/i18n/locales';
import { useLocaleStore } from '@/store/localeStore';
import type { Country } from '@/types/game';

const DICTIONARIES: Readonly<Record<LocaleCode, Dictionary>> = {
  en: EN,
  es: ES,
  fr: FR,
  de: DE,
  pt: PT,
  ar: AR,
};

export type Vars = Readonly<Record<string, string | number>>;

/**
 * Substitute `{name}` placeholders.
 *
 * An unmatched placeholder is left in place rather than blanked: a visible `{count}` in
 * the UI is a bug report, whereas a silently empty string is a mystery.
 */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

export function translate(locale: LocaleCode, key: TranslationKey, vars?: Vars): string {
  const dict = DICTIONARIES[locale] ?? EN;
  // Falls through to English for a key a dictionary somehow lacks. The types make that
  // unreachable today, but a runtime gap should degrade to readable, not to blank.
  return interpolate(dict[key] ?? EN[key], vars);
}

export interface Translator {
  (key: TranslationKey, vars?: Vars): string;
  readonly locale: LocaleCode;
  readonly dir: 'ltr' | 'rtl';
  readonly tag: string;
  /** Locale-aware number formatting, for distances and counts. */
  readonly num: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** The country's name in the current language, falling back to its English name. */
  readonly country: (country: Country) => string;
}

export function useTranslator(): Translator {
  const locale = useLocaleStore((s) => s.locale);
  const meta = localeMeta(locale);

  const numberFormat = useMemo(
    () => new Intl.NumberFormat(meta.tag),
    [meta.tag],
  );

  const t = useCallback(
    (key: TranslationKey, vars?: Vars) => translate(locale, key, vars),
    [locale],
  );

  return useMemo(() => {
    const fn = t as Translator & ((key: TranslationKey, vars?: Vars) => string);
    return Object.assign(fn, {
      locale,
      dir: meta.dir,
      tag: meta.tag,
      num: (value: number, options?: Intl.NumberFormatOptions) =>
        options ? new Intl.NumberFormat(meta.tag, options).format(value) : numberFormat.format(value),
      country: (country: Country) => COUNTRY_NAMES[locale]?.[country.id] ?? country.name,
    });
  }, [t, locale, meta.dir, meta.tag, numberFormat]);
}

/**
 * Country name for a locale, outside React.
 *
 * Used by the share text, which is built from a round rather than rendered.
 */
export function countryName(locale: LocaleCode, country: Country): string {
  return COUNTRY_NAMES[locale]?.[country.id] ?? country.name;
}

/**
 * True when a string should be isolated from the surrounding bidi context.
 *
 * Capital city names are never translated by the data source, so in Arabic they arrive
 * as Latin script inside a right-to-left run. Without isolation the bidi algorithm
 * reorders any adjacent punctuation and digits around them — "Doha · Western Asia"
 * becomes "Western Asia · Doha" and a trailing full stop jumps to the front. Wrapping
 * them in a `<bdi>` costs nothing and makes the mixed run render as written.
 */
export function needsBidiIsolation(text: string, dir: 'ltr' | 'rtl'): boolean {
  if (dir !== 'rtl') return false;
  // Any Latin letter in a right-to-left run is enough to need isolating.
  return /[A-Za-z]/.test(text);
}
