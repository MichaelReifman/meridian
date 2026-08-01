/**
 * The English dictionary, and the canonical key set.
 *
 * Every other language is typed against `keyof typeof EN`, so a missing or misspelled
 * key is a compile error rather than a string that renders as its own name at runtime.
 * Add keys here first; the other dictionaries will not compile until they follow.
 *
 * Conventions:
 *   · Keys are dotted and grouped by surface, so the file reads in the order a player
 *     encounters the app.
 *   · `{placeholder}` interpolations are substituted by `t()`. Keep them named — a
 *     positional `{0}` is impossible to translate confidently without seeing the call.
 *   · Anything a screen reader says has its own key. Never build an accessible name by
 *     concatenating fragments, because word order is exactly what changes per language.
 */

export const EN = {
  /* --- application shell ------------------------------------------------- */
  'app.name': 'Meridian',
  'app.tagline':
    'A daily geography deduction. Every wrong guess draws a ring the answer must lie on — cross them until one country is left.',

  /* --- menu -------------------------------------------------------------- */
  'menu.mode.country': 'Country',
  'menu.mode.capital': 'Capital',
  'menu.mode.flag': 'Flag',
  'menu.blurb.country': 'A name to place on the map.',
  'menu.blurb.capital': 'A city to attribute to its country.',
  'menu.blurb.flag': 'A flag to trace to where it flies.',
  'menu.daily': 'Daily',
  'menu.review': 'Review',
  'menu.practice': 'Practice',
  'menu.solved': 'Solved',
  'menu.revealed': 'Revealed',
  'menu.streak': 'Streak',
  'menu.stats': 'Stats',
  'menu.howto': 'How to play',
  'menu.settings': 'Settings',
  'menu.countdown': 'New dailies in {time}',
  'menu.a11y.playDaily': "Play today's {mode} daily challenge",
  'menu.a11y.reviewDaily': "Review today's {mode} daily challenge, already finished",
  'menu.a11y.practice': 'Start a {mode} practice round',
  'menu.a11y.streak': 'Current daily streak: {count} days.',
  'menu.a11y.more': 'More',
  'menu.a11y.practiceRegion': 'Practice region',

  /* --- regions ----------------------------------------------------------- */
  'region.all': 'All regions',
  'region.africa': 'Africa',
  'region.americas': 'Americas',
  'region.asia': 'Asia',
  'region.europe': 'Europe',
  'region.oceania': 'Oceania',

  /* --- play -------------------------------------------------------------- */
  'play.findCountry': 'Find this country',
  'play.findCapital': 'Find this capital',
  'play.findFlag': 'Find this flag',
  'play.guesses': 'Guesses',
  'play.guessesCount': '{count} guesses so far',
  'play.km': 'km',
  'play.mi': 'mi',
  'play.back': 'Back to menu',
  'play.resetView': 'Reset map view',
  'play.zoomIn': 'Zoom in',
  'play.zoomOut': 'Zoom out',
  'play.giveUp': 'Give up and reveal the answer',
  'play.showResult': 'Show the result again',
  'play.skipMap': 'Skip the map',
  'play.endOfMap': 'End of map',
  'play.mapLabel': 'World map — choose a country',
  'play.search.label': 'Guess a country by typing its name',
  'play.search.placeholder': 'Type a country',
  'play.search.help':
    'Type part of a country name, then use the up and down arrow keys to mark a suggestion and Enter to guess it.',
  'play.search.suggestions': 'Matching countries',
  'play.search.resultCount': '{count} suggestions',
  'play.search.noResults': 'No country matches that.',
  'play.search.guessed': 'Guessed',
  'play.a11y.guessTrail': 'Guesses so far, newest first',
  'play.a11y.alreadyGuessed': '{country}, already guessed',
  'play.a11y.bearing': '{distance} {unit}, bearing {compass}',
  'play.title': 'Meridian — {mode} {kind}',

  /* --- reveal ------------------------------------------------------------ */
  'reveal.solvedIn': 'Solved in {count} guesses',
  'reveal.revealedAfter': 'Revealed after {count} guesses',
  'reveal.revealed': 'Revealed',
  'reveal.capital': 'Capital',
  'reveal.region': 'Region',
  'reveal.guesses': 'Guesses',
  'reveal.code': 'Code',
  'reveal.share': 'Share',
  'reveal.nextRound': 'Next round',
  'reveal.continue': 'Continue',
  'reveal.yourGuesses': 'Your guesses: ',
  'reveal.copied': 'Copied to clipboard',
  'reveal.shareFailed': 'Could not share',

  /* --- stats ------------------------------------------------------------- */
  'stats.title': 'Your record',
  'stats.daily': 'Daily',
  'stats.practice': 'Practice',
  'stats.currentStreak': 'Current streak',
  'stats.maxStreak': 'Max streak',
  'stats.bestSolve': 'Best solve',
  'stats.played': 'Played',
  'stats.solved': 'Solved',
  'stats.avgGuesses': 'Avg guesses',
  'stats.dist.title': 'Distribution',
  'stats.dist.a11y': 'Solved dailies, grouped by how many guesses each one took',
  'stats.dist.tenPlus': '{count}+',
  'stats.dist.empty': 'No daily solved in this mode yet.',
  'stats.dist.inPlay':
    'A round is open at {count} guesses. The mark shows where it lands if the next one is right.',
  'stats.clear': 'Clear all data',
  'stats.clearConfirm': 'Erase every streak and statistic? This cannot be undone.',
  'stats.clearYes': 'Erase everything',
  'stats.clearNo': 'Keep my data',
  'stats.empty': 'Nothing recorded yet. Play a round and it will appear here.',

  /* --- how to play ------------------------------------------------------- */
  'howto.title': 'How to play',
  'howto.intro':
    'You are shown a clue. Click the country you think it points to. Guesses are unlimited — your score is how many it took, so fewer is better. You can give up at any time and the answer will be revealed. Distances are in kilometres.',
  'howto.modes': 'The three modes',
  'howto.modeCountry': "The clue is the country's name.",
  'howto.modeCapital': 'The clue is a capital city. Find the country it belongs to.',
  'howto.modeFlag': 'The clue is a flag. Find where it flies.',
  'howto.modesNote': 'Modes are never mixed inside a round, and each keeps its own daily streak.',
  'howto.signals': 'Every wrong guess tells you two things',
  'howto.ringTitle': 'A ring you can cross-reference',
  'howto.ringBody':
    'Your guess comes back with a distance, and that distance is exact — so the answer lies somewhere on a ring that far from the country you clicked. The map inks that ring in, right around the world. One guess narrows things enormously and still gives nothing away.',
  'howto.ringBody2':
    'Guess again somewhere else and a second ring appears. Only the places that satisfy both stay inked — usually a shortlist. A third normally pins it. You are triangulating, the way you would fix a position from two landmarks.',
  'howto.rampOff': 'Off the ring',
  'howto.rampOn': 'On every ring',
  'howto.rampNote':
    'The bands are deliberately coarse, and they get narrower as your guesses get closer. Nothing is tinted before your first guess.',
  'howto.arrowTitle': 'An arrow and a distance',
  'howto.arrowBody':
    'A compass arrow and a live kilometre readout point from your last guess toward the answer. It carries the same information as the colour, in words and numbers — nothing in Meridian is ever conveyed by colour alone.',
  'howto.dailyTitle': 'Daily and Practice',
  'howto.dailyBody':
    'The Daily Challenge is one puzzle per mode per day, identical for everyone and generated from the date alone — there is no server. Solve it and the streak for that mode grows; miss a day and it resets. The day rolls over at your own local midnight.',
  'howto.practiceBody':
    'Practice deals unlimited random puzzles. It keeps its own lifetime counters and never touches a daily streak.',
  'howto.scopeBody':
    'The answer is always one of the 195 sovereign states. Territories and disputed areas are drawn as inert land: never clickable, never the answer.',
  'howto.keyboard': 'Keyboard',
  'howto.keyTab': 'Step through the map, country by country.',
  'howto.keyEnter': 'Guess the focused country.',
  'howto.keyEscape': 'Back out to the menu.',
  'howto.keyHelp': 'Open this page.',
  'howto.credits': 'Boundaries from Natural Earth (public domain). Flags from flagcdn.com.',

  /* --- settings ---------------------------------------------------------- */
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.languageNote':
    'Country names are translated. Capital city names are shown in Latin script in every language, because the source data does not translate them.',
  'settings.a11y.chooseLanguage': 'Choose {language}',
  'settings.distance': 'Distance',
  'settings.distanceNote':
    'A display setting only. Distances are always measured and shared in kilometres, so a shared result stays comparable between players whichever unit each of them reads.',
  'settings.a11y.chooseUnit': 'Show distances in {unit}',
  'units.km': 'Kilometres',
  'units.mi': 'Miles',
  'settings.about': 'About',
  'settings.version': 'Version',

  /* --- service worker ---------------------------------------------------- */
  'sw.updateReady': 'A new version is ready.',
  'sw.reload': 'Reload',
  'sw.updating': 'Updating…',
  'sw.dismiss': 'Dismiss update notice',
  'sw.offlineReady': 'Ready to play offline.',

  /* --- errors ------------------------------------------------------------ */
  'error.title': 'Errata',
  'error.heading': 'Something went wrong',
  'error.retry': 'Try again',
  'error.reload': 'Reload Meridian',

  /* --- common ------------------------------------------------------------ */
  'common.none': '—',
  'common.back': 'Back',
} as const;

/** The canonical key set. Every dictionary must supply exactly these. */
export type TranslationKey = keyof typeof EN;

/** A complete dictionary for one language. */
export type Dictionary = Readonly<Record<TranslationKey, string>>;
