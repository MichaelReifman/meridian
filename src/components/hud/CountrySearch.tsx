/**
 * Guess a country by typing its name.
 *
 * The map is the game; this is the way in for everyone the map fails. It has 195 tab
 * stops, and the only way past them is a "skip the map" link — so a keyboard player who
 * wants Luxembourg has no route to it that is not a hundred presses long. On a phone the
 * problem is physical rather than sequential: at world zoom Luxembourg is smaller than a
 * fingertip. One text field answers both.
 *
 * Rendered in Capital and Flag modes only, and PlayScreen is where that is enforced —
 * see the note there. In Country mode the clue *is* the answer's name, and a field that
 * accepts it turns the round into a copying exercise.
 *
 * Set as a ruled instrument field rather than a search pill: a sheet, the entry on a
 * hairline, and the suggestions below as ruled rows. The active row is marked with a
 * rule in its margin — the same mark the language list uses — because a filled band is
 * a screen idiom and this design does not have one.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';

import { COUNTRIES } from '@/data/countries.generated';
import { useTranslator } from '@/i18n';
import { searchCountries } from '@/lib/search';

/**
 * Enough to hold the answer for any reasonable query, few enough to read without
 * scrolling on a phone. A longer list is not more helpful — past about seven rows the
 * player is scanning rather than recognising, and typing one more letter is faster.
 */
const LIMIT = 7;

export function CountrySearch({
  guessedIds,
  onGuess,
}: {
  guessedIds: ReadonlySet<string>;
  onGuess(countryId: string): void;
}): JSX.Element {
  const t = useTranslator();

  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const helpId = `${uid}-help`;
  const optionId = (countryId: string): string => `${uid}-opt-${countryId}`;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const listRef = useRef<HTMLUListElement>(null);

  /* `t.country` and `t` are stable for the life of a locale, so this only recomputes
     when the player types — 195 names folded per keystroke, which is nothing. */
  const suggestions = useMemo(
    () => searchCountries(query, COUNTRIES, t.country, LIMIT),
    [query, t],
  );

  const hasQuery = query.trim().length > 0;
  const showList = open && hasQuery && suggestions.length > 0;
  const showEmpty = open && hasQuery && suggestions.length === 0;

  /* Clamped rather than reset by an effect: the list can shrink under a stored index on
     any keystroke, and re-rendering twice to fix that would flash a stale highlight. */
  const activeIndex = showList ? Math.min(active, suggestions.length - 1) : -1;
  const activeCountry = activeIndex >= 0 ? suggestions[activeIndex].country : null;

  // Keep the marked row inside the scroll port when the arrow keys walk past its edge.
  useEffect(() => {
    const list = listRef.current;
    if (!list || activeIndex < 0) return;
    const row = list.children.item(activeIndex);
    if (row instanceof HTMLElement) row.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const choose = useCallback(
    (countryId: string) => {
      /* Spent countries stay in the list and do nothing when chosen. The store already
         rejects a duplicate, so this changes no outcome — but dropping them from the
         list instead would answer "why is Peru missing?" with silence, and the player
         would go on typing it. */
      if (guessedIds.has(countryId)) return;
      onGuess(countryId);
      // Focus stays in the field: the next guess is almost always the next thing typed.
      setQuery('');
      setActive(0);
      setOpen(false);
    },
    [guessedIds, onGuess],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // A modifier means the player is talking to the browser, not to the list.
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!hasQuery) return;
        event.preventDefault();
        if (!showList) {
          setOpen(true);
          return;
        }
        // Wraps: the list is short enough that walking off the end and round again is
        // quicker than reversing.
        const count = suggestions.length;
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        setActive((((activeIndex + delta) % count) + count) % count);
        return;
      }
      case 'Enter': {
        if (!activeCountry) return;
        event.preventDefault();
        choose(activeCountry.id);
        return;
      }
      case 'Escape': {
        /* Closes the list, then clears the field — two steps, because a player who has
           mistyped wants the second and a player reading the map wants the first. The
           window-level Escape that backs out to the menu ignores text entry, so neither
           step can leave the round by accident. */
        if (showList || showEmpty) {
          event.preventDefault();
          setOpen(false);
        } else if (query.length > 0) {
          event.preventDefault();
          setQuery('');
        }
        return;
      }
      default:
        return;
    }
  };

  return (
    /* `pointer-events-auto` because the band this sits in disables them, so that the
       clue and the corner furniture never steal a drag from the map underneath. */
    <div className="pointer-events-auto relative w-full max-w-[30rem]">
      <div className="sheet flex items-center gap-2 px-3 py-2">
        <label htmlFor={inputId} className="sr-only">
          {t('play.search.label')}
        </label>
        {/* Decorative: the field is named by its label and described by the help text. */}
        <Search aria-hidden="true" size={14} strokeWidth={1.75} className="shrink-0 text-graphite" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={t('play.search.placeholder')}
          aria-describedby={helpId}
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={activeCountry ? optionId(activeCountry.id) : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          /* The rule under the entry is the field; it darkens to ink on focus. The
             offset ring the rest of the app uses would sit inside the sheet's own
             border here, so it is pulled flush. */
          className="min-w-0 flex-1 border-b border-rule bg-transparent pb-1 text-start text-sm text-ink placeholder:text-graphite focus:border-ink focus-visible:ring-offset-0"
        />
      </div>

      <span id={helpId} className="sr-only">
        {t('play.search.help')}
      </span>

      {/* What changed, for a reader who cannot see the list grow. The marked row is
          announced by `aria-activedescendant`; this only carries the count. */}
      <span aria-live="polite" className="sr-only">
        {open && hasQuery
          ? suggestions.length > 0
            ? t('play.search.resultCount', { count: t.num(suggestions.length) })
            : t('play.search.noResults')
          : ''}
      </span>

      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={t('play.search.suggestions')}
          /* Absolute, so the list can never change the height of the top band. That row
             was rebuilt so nothing in it can overlap at any width in any language, and a
             dropdown that pushed it around would undo exactly that.

             Tall enough that all seven rows fit without a scrollbar, because a scrollbar
             here is a trap: dragging it would blur the field and close the list out from
             under the drag. `overscroll-contain` covers the viewport short enough to
             force scrolling anyway, where a flick past the last row must not carry on
             into panning the map behind it. */
          className="sheet absolute inset-x-0 top-full z-10 mt-1.5 max-h-[min(17rem,50vh)] overflow-y-auto overscroll-contain"
        >
          {suggestions.map(({ country }, index) => {
            const name = t.country(country);
            const spent = guessedIds.has(country.id);
            return (
              <li
                key={country.id}
                id={optionId(country.id)}
                role="option"
                aria-selected={index === activeIndex}
                aria-disabled={spent || undefined}
                /* The visible row says the name and prints a tag beside it; a reader
                   gets the same two facts as one phrase, in the dictionary's word order. */
                aria-label={spent ? t('play.a11y.alreadyGuessed', { country: name }) : undefined}
                // Keeps focus in the field, so the blur handler cannot close the list
                // out from under the click that is selecting from it.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(country.id)}
                className={`flex items-baseline gap-2 border-b border-rule-soft border-s-2 px-3 py-2 text-start last:border-b-0 ${
                  index === activeIndex ? 'border-s-oxblood' : 'border-s-transparent'
                } ${spent ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${spent ? 'text-graphite' : 'text-ink'}`}
                >
                  {/* Isolated: a country the current dictionary does not carry falls back
                      to its Latin-script English name, which would otherwise reorder
                      against the tag beside it in Arabic. */}
                  <bdi>{name}</bdi>
                </span>
                {spent && (
                  /* Letterspacing severs Arabic's joining forms and `uppercase` has
                     nothing to act on there, so the engraving drops in RTL. */
                  <span
                    aria-hidden="true"
                    className="label shrink-0 rtl:normal-case rtl:tracking-normal"
                  >
                    {t('play.search.guessed')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showEmpty && (
        <div className="sheet absolute inset-x-0 top-full z-10 mt-1.5 px-3 py-2">
          <p className="text-sm text-graphite">{t('play.search.noResults')}</p>
        </div>
      )}
    </div>
  );
}
