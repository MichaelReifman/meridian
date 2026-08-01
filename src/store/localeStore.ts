/**
 * The chosen language, and the two document attributes that follow from it.
 *
 * `dir` and `lang` are set on <html> rather than on a React root, because they have to
 * be right before the first paint and because the browser's own behaviour keys off
 * them: text selection, caret movement, native scrollbar placement and — the one that
 * matters most here — the bidi algorithm that decides how a Latin-script capital city
 * name is laid out inside an Arabic sentence.
 *
 * The choice is persisted to localStorage rather than IndexedDB. It has to be readable
 * synchronously at startup, since a right-to-left interface that flips a frame after
 * mount is worse than one that was never localised.
 */

import { create } from 'zustand';

import {
  DEFAULT_LOCALE,
  detectLocale,
  isLocaleCode,
  localeMeta,
  type LocaleCode,
} from '@/i18n/locales';

const STORAGE_KEY = 'meridian.locale';

/** Read the stored choice, falling back to the browser's preference, then English. */
function initialLocale(): LocaleCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocaleCode(stored)) return stored;
  } catch {
    // Private browsing and blocked-storage modes throw on access, not on write.
  }
  try {
    return detectLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Push the locale onto the document so the browser's own text handling agrees with it. */
export function applyLocaleToDocument(code: LocaleCode): void {
  if (typeof document === 'undefined') return;
  const meta = localeMeta(code);
  const root = document.documentElement;
  root.lang = meta.tag;
  root.dir = meta.dir;
}

export interface LocaleState {
  readonly locale: LocaleCode;
  setLocale(code: LocaleCode): void;
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: initialLocale(),
  setLocale(code) {
    if (!isLocaleCode(code)) return;
    applyLocaleToDocument(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // A failed write costs the preference on next launch, never the current session.
    }
    set({ locale: code });
  },
}));

// Applied once at module load, before React mounts, so the first paint is already
// oriented correctly and nothing has to flip.
applyLocaleToDocument(useLocaleStore.getState().locale);
