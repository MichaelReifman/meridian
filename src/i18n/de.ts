/**
 * The German dictionary.
 *
 * Typed against `Dictionary`, so any drift from the English key set is a compile error.
 *
 * German compounds run long and this interface is mostly buttons and stat tiles, so the
 * shorter idiomatic term wins over the literal one wherever a label has to fit on one
 * line — "Serie" rather than "Erfolgssträhne", "Ø Versuche" rather than
 * "Durchschnittliche Versuche". Count keys take a single form because `t()` has no
 * plural machinery; where a phrasing could put the number in front of a plural noun it
 * is turned around ("Versuche bisher: {count}") so that a count of one still reads.
 */

import type { Dictionary } from '@/i18n/en';

export const DE: Dictionary = {
  /* --- application shell ------------------------------------------------- */
  'app.name': 'Meridian',
  'app.tagline':
    'Eine tägliche geografische Deduktion. Jeder falsche Versuch zeichnet einen Ring, auf dem die Lösung liegen muss — überschneide sie, bis nur ein Land übrig bleibt.',

  /* --- menu -------------------------------------------------------------- */
  'menu.mode.country': 'Land',
  'menu.mode.capital': 'Hauptstadt',
  'menu.mode.flag': 'Flagge',
  'menu.blurb.country': 'Ein Name, der auf der Karte zu verorten ist.',
  'menu.blurb.capital': 'Eine Stadt, die ihrem Land zuzuordnen ist.',
  'menu.blurb.flag': 'Eine Flagge, deren Herkunftsland zu finden ist.',
  'menu.daily': 'Tagesrätsel',
  'menu.review': 'Ansehen',
  'menu.practice': 'Übung',
  'menu.solved': 'Gelöst',
  'menu.revealed': 'Aufgelöst',
  'menu.streak': 'Serie',
  'menu.stats': 'Statistik',
  'menu.howto': 'Spielregeln',
  'menu.settings': 'Einstellungen',
  'menu.countdown': 'Neue Tagesrätsel in {time}',
  'menu.a11y.playDaily': 'Heutiges Tagesrätsel im Modus {mode} spielen',
  'menu.a11y.reviewDaily': 'Heutiges Tagesrätsel im Modus {mode} ansehen, bereits abgeschlossen',
  'menu.a11y.practice': 'Übungsrunde im Modus {mode} starten',
  'menu.a11y.streak': 'Aktuelle Tagesserie: {count} Tage.',
  'menu.a11y.more': 'Mehr',

  /* --- play -------------------------------------------------------------- */
  'play.findCountry': 'Dieses Land finden',
  'play.findCapital': 'Diese Hauptstadt finden',
  'play.findFlag': 'Diese Flagge finden',
  'play.guesses': 'Versuche',
  'play.guessesCount': 'Versuche bisher: {count}',
  'play.km': 'km',
  'play.back': 'Zurück zum Menü',
  'play.resetView': 'Kartenansicht zurücksetzen',
  'play.zoomIn': 'Hineinzoomen',
  'play.zoomOut': 'Herauszoomen',
  'play.giveUp': 'Aufgeben und Lösung zeigen',
  'play.showResult': 'Ergebnis erneut anzeigen',
  'play.skipMap': 'Karte überspringen',
  'play.endOfMap': 'Ende der Karte',
  'play.mapLabel': 'Weltkarte — Land auswählen',
  'play.a11y.guessTrail': 'Bisherige Versuche, neueste zuerst',
  'play.a11y.alreadyGuessed': '{country}, bereits geraten',
  'play.a11y.bearing': '{distance} Kilometer, Peilung {compass}',
  'play.title': 'Meridian — {kind}: {mode}',

  /* --- reveal ------------------------------------------------------------ */
  'reveal.solvedIn': 'Gelöst in {count} Versuchen',
  'reveal.revealedAfter': 'Aufgelöst nach {count} Versuchen',
  'reveal.revealed': 'Aufgelöst',
  'reveal.capital': 'Hauptstadt',
  'reveal.region': 'Region',
  'reveal.guesses': 'Versuche',
  'reveal.code': 'Code',
  'reveal.share': 'Teilen',
  'reveal.nextRound': 'Nächste Runde',
  'reveal.continue': 'Weiter',
  'reveal.yourGuesses': 'Deine Versuche: ',
  'reveal.copied': 'In die Zwischenablage kopiert',
  'reveal.shareFailed': 'Teilen nicht möglich',

  /* --- stats ------------------------------------------------------------- */
  'stats.title': 'Deine Bilanz',
  'stats.daily': 'Täglich',
  'stats.practice': 'Übung',
  'stats.currentStreak': 'Aktuelle Serie',
  'stats.maxStreak': 'Längste Serie',
  'stats.bestSolve': 'Bestleistung',
  'stats.played': 'Gespielt',
  'stats.solved': 'Gelöst',
  'stats.avgGuesses': 'Ø Versuche',
  'stats.clear': 'Alle Daten löschen',
  'stats.clearConfirm': 'Alle Serien und Statistiken löschen? Das lässt sich nicht rückgängig machen.',
  'stats.clearYes': 'Alles löschen',
  'stats.clearNo': 'Daten behalten',
  'stats.empty': 'Noch nichts erfasst. Spiele eine Runde, dann erscheint sie hier.',

  /* --- how to play ------------------------------------------------------- */
  'howto.title': 'Spielregeln',
  'howto.intro':
    'Du bekommst einen Hinweis. Klicke auf das Land, auf das er deiner Meinung nach zeigt. Die Zahl der Versuche ist unbegrenzt — dein Ergebnis ist, wie viele du gebraucht hast, weniger ist also besser. Du kannst jederzeit aufgeben, dann wird die Lösung gezeigt. Entfernungen sind in Kilometern angegeben.',
  'howto.modes': 'Die drei Modi',
  'howto.modeCountry': 'Der Hinweis ist der Name des Landes.',
  'howto.modeCapital': 'Der Hinweis ist eine Hauptstadt. Finde das Land, zu dem sie gehört.',
  'howto.modeFlag': 'Der Hinweis ist eine Flagge. Finde das Land, über dem sie weht.',
  'howto.modesNote':
    'Modi werden innerhalb einer Runde nie gemischt, und jeder führt seine eigene Tagesserie.',
  'howto.signals': 'Jeder falsche Versuch verrät dir zwei Dinge',
  'howto.ringTitle': 'Ein Ring zum Abgleichen',
  'howto.ringBody':
    'Zu jedem Versuch bekommst du eine Entfernung zurück, und diese Entfernung ist exakt — die Lösung liegt also irgendwo auf einem Ring in genau diesem Abstand um das angeklickte Land. Die Karte zeichnet diesen Ring rund um die Welt ein. Ein einziger Versuch grenzt die Möglichkeiten enorm ein und verrät dabei nichts.',
  'howto.ringBody2':
    'Rate an anderer Stelle erneut, und ein zweiter Ring erscheint. Eingefärbt bleiben nur die Orte, die beide erfüllen — meist eine Handvoll. Ein dritter Versuch legt die Lösung in der Regel fest. Du triangulierst, so wie man einen Standort über zwei Landmarken bestimmt.',
  'howto.rampOff': 'Abseits des Rings',
  'howto.rampOn': 'Auf allen Ringen',
  'howto.rampNote':
    'Die Bänder sind bewusst grob und werden schmaler, je näher deine Versuche kommen. Vor dem ersten Versuch ist nichts eingefärbt.',
  'howto.arrowTitle': 'Ein Pfeil und eine Entfernung',
  'howto.arrowBody':
    'Ein Kompasspfeil und eine mitlaufende Kilometeranzeige weisen von deinem letzten Versuch zur Lösung. Sie tragen dieselbe Information wie die Farbe, in Worten und Zahlen — nichts in Meridian wird jemals allein über die Farbe vermittelt.',
  'howto.dailyTitle': 'Tagesrätsel und Übung',
  'howto.dailyBody':
    'Das Tagesrätsel ist eine Aufgabe pro Modus und Tag, für alle identisch und allein aus dem Datum erzeugt — es gibt keinen Server. Löst du es, wächst die Serie dieses Modus; lässt du einen Tag aus, beginnt sie von vorn. Der Tageswechsel richtet sich nach deiner lokalen Mitternacht.',
  'howto.practiceBody':
    'Die Übung teilt beliebig viele zufällige Aufgaben aus. Sie führt eigene Gesamtzähler und rührt keine Tagesserie an.',
  'howto.scopeBody':
    'Die Lösung ist immer einer der 195 souveränen Staaten. Territorien und umstrittene Gebiete sind als stummes Land gezeichnet: nie anklickbar, nie die Lösung.',
  'howto.keyboard': 'Tastatur',
  'howto.keyTab': 'Die Karte Land für Land durchgehen.',
  'howto.keyEnter': 'Das fokussierte Land raten.',
  'howto.keyEscape': 'Zurück zum Menü.',
  'howto.keyHelp': 'Diese Seite öffnen.',
  'howto.credits': 'Grenzen von Natural Earth (gemeinfrei). Flaggen von flagcdn.com.',

  /* --- settings ---------------------------------------------------------- */
  'settings.title': 'Einstellungen',
  'settings.language': 'Sprache',
  'settings.languageNote':
    'Ländernamen werden übersetzt. Hauptstadtnamen erscheinen in jeder Sprache in lateinischer Schrift, da die Quelldaten sie nicht übersetzen.',
  'settings.a11y.chooseLanguage': '{language} auswählen',
  'settings.about': 'Über',
  'settings.version': 'Version',

  /* --- service worker ---------------------------------------------------- */
  'sw.updateReady': 'Eine neue Version steht bereit.',
  'sw.reload': 'Neu laden',
  'sw.updating': 'Wird aktualisiert…',
  'sw.dismiss': 'Update-Hinweis ausblenden',
  'sw.offlineReady': 'Offline spielbereit.',

  /* --- errors ------------------------------------------------------------ */
  'error.title': 'Errata',
  'error.heading': 'Etwas ist schiefgelaufen',
  'error.retry': 'Erneut versuchen',
  'error.reload': 'Meridian neu laden',

  /* --- common ------------------------------------------------------------ */
  'common.none': '—',
  'common.back': 'Zurück',
};
