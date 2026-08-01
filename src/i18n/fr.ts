/**
 * The French dictionary.
 *
 * Vouvoiement throughout: the tutoiement French games sometimes use would clash with
 * the printed-atlas register the interface is written in.
 * Key order and comment groups mirror `en.ts` exactly so the two diff line for line.
 */

import type { Dictionary } from '@/i18n/en';

export const FR: Dictionary = {
  /* --- application shell ------------------------------------------------- */
  'app.name': 'Meridian',
  'app.tagline':
    "Une déduction géographique quotidienne. Chaque erreur trace un anneau sur lequel la réponse doit se trouver — recoupez-les jusqu'à ce qu'il ne reste qu'un pays.",

  /* --- menu -------------------------------------------------------------- */
  'menu.mode.country': 'Pays',
  'menu.mode.capital': 'Capitale',
  'menu.mode.flag': 'Drapeau',
  'menu.blurb.country': 'Un nom à situer sur la carte.',
  'menu.blurb.capital': 'Une ville à rattacher à son pays.',
  'menu.blurb.flag': "Un drapeau à retracer jusqu'au lieu où il flotte.",
  'menu.daily': 'Quotidien',
  'menu.review': 'Revoir',
  'menu.practice': 'Entraînement',
  'menu.solved': 'Résolu',
  'menu.revealed': 'Révélé',
  'menu.streak': 'Série',
  'menu.stats': 'Stats',
  'menu.howto': 'Comment jouer',
  'menu.settings': 'Réglages',
  'menu.countdown': 'Nouveaux défis dans {time}',
  'menu.a11y.playDaily': "Jouer le défi quotidien {mode} d'aujourd'hui",
  'menu.a11y.reviewDaily': "Revoir le défi quotidien {mode} d'aujourd'hui, déjà terminé",
  'menu.a11y.practice': "Commencer une manche d'entraînement {mode}",
  'menu.a11y.streak': 'Série quotidienne actuelle : {count} jours.',
  'menu.a11y.more': 'Plus',
  'menu.a11y.practiceRegion': "Région d'entraînement",

  /* --- regions ----------------------------------------------------------- */
  'region.all': 'Toutes les régions',
  'region.africa': 'Afrique',
  'region.americas': 'Amériques',
  'region.asia': 'Asie',
  'region.europe': 'Europe',
  'region.oceania': 'Océanie',

  /* --- play -------------------------------------------------------------- */
  'play.findCountry': 'Trouvez ce pays',
  'play.findCapital': 'Trouvez cette capitale',
  'play.findFlag': 'Trouvez ce drapeau',
  'play.guesses': 'Essais',
  'play.guessesCount': "{count} essais jusqu'ici",
  'play.km': 'km',
  'play.mi': 'mi',
  'play.back': 'Retour au menu',
  'play.resetView': 'Réinitialiser la vue de la carte',
  'play.zoomIn': 'Zoom avant',
  'play.zoomOut': 'Zoom arrière',
  'play.giveUp': 'Abandonner et révéler la réponse',
  'play.showResult': 'Revoir le résultat',
  'play.skipMap': 'Passer la carte',
  'play.endOfMap': 'Fin de la carte',
  'play.mapLabel': 'Carte du monde — choisissez un pays',
  'play.search.label': 'Deviner un pays en tapant son nom',
  'play.search.placeholder': 'Tapez un pays',
  'play.search.help':
    "Tapez une partie du nom d'un pays, puis marquez une suggestion avec les flèches haut et bas et essayez-la avec la touche Entrée.",
  'play.search.suggestions': 'Pays correspondants',
  'play.search.resultCount': 'Suggestions : {count}',
  'play.search.noResults': 'Aucun pays ne correspond.',
  'play.search.guessed': 'Essayé',
  'play.a11y.guessTrail': 'Essais effectués, du plus récent au plus ancien',
  'play.a11y.alreadyGuessed': '{country}, déjà essayé',
  'play.a11y.bearing': '{distance} kilomètres, cap {compass}',
  'play.title': 'Meridian — {mode} {kind}',

  /* --- reveal ------------------------------------------------------------ */
  'reveal.solvedIn': 'Résolu en {count} essais',
  'reveal.revealedAfter': 'Révélé après {count} essais',
  'reveal.revealed': 'Révélé',
  'reveal.capital': 'Capitale',
  'reveal.region': 'Région',
  'reveal.guesses': 'Essais',
  'reveal.code': 'Code',
  'reveal.share': 'Partager',
  'reveal.nextRound': 'Manche suivante',
  'reveal.continue': 'Continuer',
  'reveal.yourGuesses': 'Vos essais : ',
  'reveal.copied': 'Copié dans le presse-papiers',
  'reveal.shareFailed': 'Partage impossible',

  /* --- stats ------------------------------------------------------------- */
  'stats.title': 'Votre palmarès',
  'stats.daily': 'Quotidien',
  'stats.practice': 'Entraînement',
  'stats.currentStreak': 'Série actuelle',
  'stats.maxStreak': 'Meilleure série',
  'stats.bestSolve': 'Meilleur résultat',
  'stats.played': 'Jouées',
  'stats.solved': 'Résolues',
  'stats.avgGuesses': "Moyenne d'essais",
  'stats.dist.title': 'Répartition',
  'stats.dist.a11y': "Défis quotidiens résolus, regroupés selon le nombre d'essais qu'il a fallu",
  'stats.dist.tenPlus': '{count}+',
  'stats.dist.empty': "Aucun défi quotidien résolu dans ce mode pour l'instant.",
  'stats.dist.inPlay':
    'Une manche est en cours à {count} essais. Le repère indique où elle se placera si le prochain est le bon.',
  'stats.clear': 'Effacer toutes les données',
  'stats.clearConfirm':
    'Effacer toutes les séries et statistiques ? Cette action est irréversible.',
  'stats.clearYes': 'Tout effacer',
  'stats.clearNo': 'Conserver mes données',
  'stats.empty': "Rien d'enregistré pour l'instant. Jouez une manche et cela apparaîtra ici.",

  /* --- how to play ------------------------------------------------------- */
  'howto.title': 'Comment jouer',
  'howto.intro':
    "Un indice vous est présenté. Cliquez sur le pays qu'il désigne selon vous. Les essais sont illimités : votre score est leur nombre, donc moins il y en a, mieux c'est. Vous pouvez abandonner à tout moment et la réponse sera révélée. Les distances sont en kilomètres.",
  'howto.modes': 'Les trois modes',
  'howto.modeCountry': "L'indice est le nom du pays.",
  'howto.modeCapital': "L'indice est une capitale. Trouvez le pays auquel elle appartient.",
  'howto.modeFlag': "L'indice est un drapeau. Trouvez où il flotte.",
  'howto.modesNote':
    "Les modes ne sont jamais mélangés au sein d'une manche, et chacun tient sa propre série quotidienne.",
  'howto.signals': 'Chaque erreur vous apprend deux choses',
  'howto.ringTitle': 'Un anneau à recouper',
  'howto.ringBody':
    'Votre essai revient avec une distance, et cette distance est exacte : la réponse se trouve donc quelque part sur un anneau situé à cette distance du pays cliqué. La carte encre cet anneau, tout autour du monde. Un seul essai restreint énormément le champ sans rien dévoiler.',
  'howto.ringBody2':
    "Essayez ailleurs et un deuxième anneau apparaît. Seuls les lieux qui satisfont les deux restent encrés — en général une courte liste. Un troisième suffit d'ordinaire à trancher. Vous triangulez, comme on fixe une position à partir de deux repères.",
  'howto.rampOff': "Hors de l'anneau",
  'howto.rampOn': 'Sur tous les anneaux',
  'howto.rampNote':
    "Les bandes sont volontairement larges, et elles se resserrent à mesure que vos essais se rapprochent. Rien n'est teinté avant votre premier essai.",
  'howto.arrowTitle': 'Une flèche et une distance',
  'howto.arrowBody':
    "Une flèche de boussole et un relevé kilométrique en direct pointent de votre dernier essai vers la réponse. Ils portent la même information que la couleur, en mots et en chiffres : dans Meridian, rien n'est jamais transmis par la couleur seule.",
  'howto.dailyTitle': 'Quotidien et Entraînement',
  'howto.dailyBody':
    "Le défi quotidien propose une énigme par mode et par jour, identique pour tous et générée à partir de la seule date : il n'y a pas de serveur. Résolvez-la et la série de ce mode s'allonge ; manquez un jour et elle repart de zéro. Le jour change à votre propre minuit local.",
  'howto.practiceBody':
    "L'entraînement distribue des énigmes aléatoires à volonté. Il tient ses propres compteurs cumulés et ne touche jamais à une série quotidienne.",
  'howto.scopeBody':
    "La réponse est toujours l'un des 195 États souverains. Les territoires et les zones disputées sont dessinés comme des terres inertes : jamais cliquables, jamais la réponse.",
  'howto.keyboard': 'Clavier',
  'howto.keyTab': 'Parcourez la carte, pays par pays.',
  'howto.keyEnter': 'Proposez le pays sélectionné.',
  'howto.keyEscape': 'Revenez au menu.',
  'howto.keyHelp': 'Ouvrez cette page.',
  'howto.credits':
    'Frontières issues de Natural Earth (domaine public). Drapeaux de flagcdn.com.',

  /* --- settings ---------------------------------------------------------- */
  'settings.title': 'Réglages',
  'settings.language': 'Langue',
  'settings.languageNote':
    'Les noms de pays sont traduits. Les noms des capitales sont affichés en alphabet latin dans toutes les langues, car les données source ne les traduisent pas.',
  'settings.a11y.chooseLanguage': 'Choisir {language}',
  'settings.distance': 'Distances',
  'settings.distanceNote':
    "Un réglage d'affichage seulement. Les distances sont toujours calculées et partagées en kilomètres, afin qu'un résultat partagé reste comparable entre joueurs, quelle que soit l'unité que chacun lit.",
  'settings.a11y.chooseUnit': 'Afficher les distances en {unit}',
  'units.km': 'Kilomètres',
  'units.mi': 'Milles',
  'settings.about': 'À propos',
  'settings.version': 'Version',

  /* --- service worker ---------------------------------------------------- */
  'sw.updateReady': 'Une nouvelle version est prête.',
  'sw.reload': 'Recharger',
  'sw.updating': 'Mise à jour…',
  'sw.dismiss': "Ignorer l'avis de mise à jour",
  'sw.offlineReady': 'Prêt à jouer hors ligne.',

  /* --- errors ------------------------------------------------------------ */
  'error.title': 'Errata',
  'error.heading': "Une erreur s'est produite",
  'error.retry': 'Réessayer',
  'error.reload': 'Recharger Meridian',

  /* --- common ------------------------------------------------------------ */
  'common.none': '—',
  'common.back': 'Retour',
};
