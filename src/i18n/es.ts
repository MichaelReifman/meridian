/**
 * The Spanish dictionary.
 *
 * Second person singular ("tú") throughout: that is the register Spanish software of
 * this kind uses, and "usted" would read as bureaucratic next to an atlas.
 * Key order and comment groups mirror `en.ts` exactly so the two diff line for line.
 */

import type { Dictionary } from '@/i18n/en';

export const ES: Dictionary = {
  /* --- application shell ------------------------------------------------- */
  'app.name': 'Meridian',
  'app.tagline':
    'Una deducción geográfica diaria. Cada intento fallido traza un anillo sobre el que debe estar la respuesta: crúzalos hasta que solo quede un país.',

  /* --- menu -------------------------------------------------------------- */
  'menu.mode.country': 'País',
  'menu.mode.capital': 'Capital',
  'menu.mode.flag': 'Bandera',
  'menu.blurb.country': 'Un nombre que situar en el mapa.',
  'menu.blurb.capital': 'Una ciudad que atribuir a su país.',
  'menu.blurb.flag': 'Una bandera que rastrear hasta donde ondea.',
  'menu.daily': 'Diario',
  'menu.review': 'Repasar',
  'menu.practice': 'Práctica',
  'menu.solved': 'Resuelto',
  'menu.revealed': 'Revelado',
  'menu.streak': 'Racha',
  'menu.stats': 'Estadísticas',
  'menu.howto': 'Cómo jugar',
  'menu.settings': 'Ajustes',
  'menu.countdown': 'Nuevos retos en {time}',
  'menu.a11y.playDaily': 'Jugar el reto diario de {mode} de hoy',
  'menu.a11y.reviewDaily': 'Repasar el reto diario de {mode} de hoy, ya terminado',
  'menu.a11y.practice': 'Empezar una ronda de práctica de {mode}',
  'menu.a11y.streak': 'Racha diaria actual: {count} días.',
  'menu.a11y.more': 'Más',

  /* --- play -------------------------------------------------------------- */
  'play.findCountry': 'Encuentra este país',
  'play.findCapital': 'Encuentra esta capital',
  'play.findFlag': 'Encuentra esta bandera',
  'play.guesses': 'Intentos',
  'play.guessesCount': '{count} intentos hasta ahora',
  'play.km': 'km',
  'play.back': 'Volver al menú',
  'play.resetView': 'Restablecer la vista del mapa',
  'play.zoomIn': 'Acercar',
  'play.zoomOut': 'Alejar',
  'play.giveUp': 'Rendirse y revelar la respuesta',
  'play.showResult': 'Ver el resultado de nuevo',
  'play.skipMap': 'Saltar el mapa',
  'play.endOfMap': 'Fin del mapa',
  'play.mapLabel': 'Mapa del mundo: elige un país',
  'play.a11y.guessTrail': 'Intentos realizados, del más reciente al más antiguo',
  'play.a11y.alreadyGuessed': '{country}, ya intentado',
  'play.a11y.bearing': '{distance} kilómetros, rumbo {compass}',
  'play.title': 'Meridian — {mode} {kind}',

  /* --- reveal ------------------------------------------------------------ */
  'reveal.solvedIn': 'Resuelto en {count} intentos',
  'reveal.revealedAfter': 'Revelado tras {count} intentos',
  'reveal.revealed': 'Revelado',
  'reveal.capital': 'Capital',
  'reveal.region': 'Región',
  'reveal.guesses': 'Intentos',
  'reveal.code': 'Código',
  'reveal.share': 'Compartir',
  'reveal.nextRound': 'Siguiente ronda',
  'reveal.continue': 'Continuar',
  'reveal.yourGuesses': 'Tus intentos: ',
  'reveal.copied': 'Copiado al portapapeles',
  'reveal.shareFailed': 'No se pudo compartir',

  /* --- stats ------------------------------------------------------------- */
  'stats.title': 'Tu registro',
  'stats.daily': 'Diario',
  'stats.practice': 'Práctica',
  'stats.currentStreak': 'Racha actual',
  'stats.maxStreak': 'Racha máxima',
  'stats.bestSolve': 'Mejor resultado',
  'stats.played': 'Jugadas',
  'stats.solved': 'Resueltas',
  'stats.avgGuesses': 'Media de intentos',
  'stats.clear': 'Borrar todos los datos',
  'stats.clearConfirm': '¿Borrar todas las rachas y estadísticas? Esto no se puede deshacer.',
  'stats.clearYes': 'Borrarlo todo',
  'stats.clearNo': 'Conservar mis datos',
  'stats.empty': 'Aún no hay nada registrado. Juega una ronda y aparecerá aquí.',

  /* --- how to play ------------------------------------------------------- */
  'howto.title': 'Cómo jugar',
  'howto.intro':
    'Se te muestra una pista. Haz clic en el país al que crees que apunta. Los intentos son ilimitados: tu puntuación es cuántos te hicieron falta, así que cuantos menos, mejor. Puedes rendirte en cualquier momento y se revelará la respuesta. Las distancias están en kilómetros.',
  'howto.modes': 'Los tres modos',
  'howto.modeCountry': 'La pista es el nombre del país.',
  'howto.modeCapital': 'La pista es una capital. Encuentra el país al que pertenece.',
  'howto.modeFlag': 'La pista es una bandera. Encuentra dónde ondea.',
  'howto.modesNote':
    'Los modos nunca se mezclan dentro de una ronda, y cada uno mantiene su propia racha diaria.',
  'howto.signals': 'Cada intento fallido te dice dos cosas',
  'howto.ringTitle': 'Un anillo que puedes cruzar con otros',
  'howto.ringBody':
    'Tu intento vuelve con una distancia, y esa distancia es exacta: la respuesta está en algún punto de un anillo a esa distancia del país en el que hiciste clic. El mapa entinta ese anillo dando la vuelta al mundo. Un solo intento reduce enormemente el campo y aun así no delata nada.',
  'howto.ringBody2':
    'Vuelve a intentarlo en otro lugar y aparece un segundo anillo. Solo los lugares que cumplen ambos siguen entintados: normalmente, una lista corta. Un tercero suele fijarlo. Estás triangulando, igual que fijarías una posición a partir de dos referencias.',
  'howto.rampOff': 'Fuera del anillo',
  'howto.rampOn': 'En todos los anillos',
  'howto.rampNote':
    'Las bandas son deliberadamente amplias, y se estrechan a medida que tus intentos se acercan. Nada está teñido antes de tu primer intento.',
  'howto.arrowTitle': 'Una flecha y una distancia',
  'howto.arrowBody':
    'Una flecha de brújula y una lectura de kilómetros en vivo apuntan desde tu último intento hacia la respuesta. Llevan la misma información que el color, en palabras y números: en Meridian nada se transmite solo mediante el color.',
  'howto.dailyTitle': 'Diario y Práctica',
  'howto.dailyBody':
    'El reto diario es un puzle por modo y día, idéntico para todo el mundo y generado únicamente a partir de la fecha: no hay servidor. Resuélvelo y la racha de ese modo crece; falla un día y se reinicia. El día cambia a tu propia medianoche local.',
  'howto.practiceBody':
    'La práctica reparte puzles aleatorios sin límite. Mantiene sus propios contadores históricos y nunca afecta a una racha diaria.',
  'howto.scopeBody':
    'La respuesta es siempre uno de los 195 estados soberanos. Los territorios y las zonas en disputa se dibujan como tierra inerte: nunca se pueden pulsar y nunca son la respuesta.',
  'howto.keyboard': 'Teclado',
  'howto.keyTab': 'Recorre el mapa, país por país.',
  'howto.keyEnter': 'Adivina el país seleccionado.',
  'howto.keyEscape': 'Vuelve al menú.',
  'howto.keyHelp': 'Abre esta página.',
  'howto.credits':
    'Fronteras de Natural Earth (dominio público). Banderas de flagcdn.com.',

  /* --- settings ---------------------------------------------------------- */
  'settings.title': 'Ajustes',
  'settings.language': 'Idioma',
  'settings.languageNote':
    'Los nombres de los países están traducidos. Los nombres de las capitales se muestran en alfabeto latino en todos los idiomas, porque los datos de origen no los traducen.',
  'settings.a11y.chooseLanguage': 'Elegir {language}',
  'settings.about': 'Acerca de',
  'settings.version': 'Versión',

  /* --- service worker ---------------------------------------------------- */
  'sw.updateReady': 'Hay una nueva versión lista.',
  'sw.reload': 'Recargar',
  'sw.updating': 'Actualizando…',
  'sw.dismiss': 'Descartar el aviso de actualización',
  'sw.offlineReady': 'Listo para jugar sin conexión.',

  /* --- errors ------------------------------------------------------------ */
  'error.title': 'Fe de erratas',
  'error.heading': 'Algo ha salido mal',
  'error.retry': 'Reintentar',
  'error.reload': 'Recargar Meridian',

  /* --- common ------------------------------------------------------------ */
  'common.none': '—',
  'common.back': 'Volver',
};
