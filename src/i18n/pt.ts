/**
 * The European Portuguese dictionary.
 *
 * pt-PT specifically — "partilhar", "definições", "ecrã", "registo", "quilómetros",
 * and the formal third person that pt-PT software uses rather than Brazilian "você".
 * Key order and comment groups mirror `en.ts` exactly so the two diff line for line.
 */

import type { Dictionary } from '@/i18n/en';

export const PT: Dictionary = {
  /* --- application shell ------------------------------------------------- */
  'app.name': 'Meridian',
  'app.tagline':
    'Uma dedução geográfica diária. Cada tentativa errada traça um anel sobre o qual a resposta tem de estar — cruze-os até restar apenas um país.',

  /* --- menu -------------------------------------------------------------- */
  'menu.mode.country': 'País',
  'menu.mode.capital': 'Capital',
  'menu.mode.flag': 'Bandeira',
  'menu.blurb.country': 'Um nome para situar no mapa.',
  'menu.blurb.capital': 'Uma cidade para atribuir ao seu país.',
  'menu.blurb.flag': 'Uma bandeira para seguir até onde é hasteada.',
  'menu.daily': 'Diário',
  'menu.review': 'Rever',
  'menu.practice': 'Treino',
  'menu.solved': 'Resolvido',
  'menu.revealed': 'Revelado',
  'menu.streak': 'Sequência',
  'menu.stats': 'Estatísticas',
  'menu.howto': 'Como jogar',
  'menu.settings': 'Definições',
  'menu.countdown': 'Novos desafios em {time}',
  'menu.a11y.playDaily': 'Jogar o desafio diário de {mode} de hoje',
  'menu.a11y.reviewDaily': 'Rever o desafio diário de {mode} de hoje, já concluído',
  'menu.a11y.practice': 'Iniciar uma ronda de treino de {mode}',
  'menu.a11y.streak': 'Sequência diária atual: {count} dias.',
  'menu.a11y.more': 'Mais',
  'menu.a11y.practiceRegion': 'Região de treino',

  /* --- regions ----------------------------------------------------------- */
  'region.all': 'Todas as regiões',
  'region.africa': 'África',
  'region.americas': 'Américas',
  'region.asia': 'Ásia',
  'region.europe': 'Europa',
  'region.oceania': 'Oceânia',

  /* --- play -------------------------------------------------------------- */
  'play.findCountry': 'Encontre este país',
  'play.findCapital': 'Encontre esta capital',
  'play.findFlag': 'Encontre esta bandeira',
  'play.guesses': 'Tentativas',
  'play.guessesCount': '{count} tentativas até agora',
  'play.km': 'km',
  'play.mi': 'mi',
  'play.back': 'Voltar ao menu',
  'play.resetView': 'Repor a vista do mapa',
  'play.zoomIn': 'Aproximar',
  'play.zoomOut': 'Afastar',
  'play.giveUp': 'Desistir e revelar a resposta',
  'play.showResult': 'Ver novamente o resultado',
  'play.skipMap': 'Saltar o mapa',
  'play.endOfMap': 'Fim do mapa',
  'play.mapLabel': 'Mapa do mundo — escolha um país',
  'play.search.label': 'Adivinhar um país escrevendo o seu nome',
  'play.search.placeholder': 'Escreva um país',
  'play.search.help':
    'Escreva parte do nome de um país e marque uma sugestão com as setas para cima e para baixo; prima a tecla Enter para a tentar.',
  'play.search.suggestions': 'Países correspondentes',
  'play.search.resultCount': 'Sugestões: {count}',
  'play.search.noResults': 'Nenhum país corresponde a isso.',
  'play.search.guessed': 'Tentado',
  'play.a11y.guessTrail': 'Tentativas efetuadas, da mais recente para a mais antiga',
  'play.a11y.alreadyGuessed': '{country}, já tentado',
  'play.a11y.bearing': '{distance} quilómetros, rumo {compass}',
  'play.title': 'Meridian — {mode} {kind}',

  /* --- reveal ------------------------------------------------------------ */
  'reveal.solvedIn': 'Resolvido em {count} tentativas',
  'reveal.revealedAfter': 'Revelado após {count} tentativas',
  'reveal.revealed': 'Revelado',
  'reveal.capital': 'Capital',
  'reveal.region': 'Região',
  'reveal.guesses': 'Tentativas',
  'reveal.code': 'Código',
  'reveal.share': 'Partilhar',
  'reveal.nextRound': 'Ronda seguinte',
  'reveal.continue': 'Continuar',
  'reveal.yourGuesses': 'As suas tentativas: ',
  'reveal.copied': 'Copiado para a área de transferência',
  'reveal.shareFailed': 'Não foi possível partilhar',

  /* --- stats ------------------------------------------------------------- */
  'stats.title': 'O seu registo',
  'stats.daily': 'Diário',
  'stats.practice': 'Treino',
  'stats.currentStreak': 'Sequência atual',
  'stats.maxStreak': 'Sequência máxima',
  'stats.bestSolve': 'Melhor resultado',
  'stats.played': 'Jogadas',
  'stats.solved': 'Resolvidas',
  'stats.avgGuesses': 'Média de tentativas',
  'stats.dist.title': 'Distribuição',
  'stats.dist.a11y': 'Desafios diários resolvidos, agrupados pelas tentativas que cada um exigiu',
  'stats.dist.tenPlus': '{count}+',
  'stats.dist.empty': 'Ainda não resolveu nenhum desafio diário neste modo.',
  'stats.dist.inPlay':
    'Há uma ronda em curso com {count} tentativas. A marca indica onde ficará se a próxima acertar.',
  'stats.clear': 'Apagar todos os dados',
  'stats.clearConfirm':
    'Apagar todas as sequências e estatísticas? Esta operação é irreversível.',
  'stats.clearYes': 'Apagar tudo',
  'stats.clearNo': 'Manter os meus dados',
  'stats.empty': 'Ainda não há nada registado. Jogue uma ronda e aparecerá aqui.',

  /* --- how to play ------------------------------------------------------- */
  'howto.title': 'Como jogar',
  'howto.intro':
    'É-lhe mostrada uma pista. Clique no país que julga que ela indica. As tentativas são ilimitadas: a sua pontuação é o número delas, por isso quantas menos, melhor. Pode desistir a qualquer momento e a resposta será revelada. As distâncias são em quilómetros.',
  'howto.modes': 'Os três modos',
  'howto.modeCountry': 'A pista é o nome do país.',
  'howto.modeCapital': 'A pista é uma capital. Encontre o país a que pertence.',
  'howto.modeFlag': 'A pista é uma bandeira. Encontre onde é hasteada.',
  'howto.modesNote':
    'Os modos nunca se misturam dentro de uma ronda, e cada um mantém a sua própria sequência diária.',
  'howto.signals': 'Cada tentativa errada diz-lhe duas coisas',
  'howto.ringTitle': 'Um anel para cruzar com os outros',
  'howto.ringBody':
    'A sua tentativa devolve uma distância, e essa distância é exata: a resposta está algures num anel a essa distância do país em que clicou. O mapa desenha esse anel a tinta, à volta de todo o mundo. Uma só tentativa restringe enormemente o campo e continua a não revelar nada.',
  'howto.ringBody2':
    'Tente noutro sítio e surge um segundo anel. Só os lugares que satisfazem ambos permanecem a tinta — normalmente uma lista curta. Um terceiro costuma fixá-la. Está a triangular, tal como fixaria uma posição a partir de dois pontos de referência.',
  'howto.rampOff': 'Fora do anel',
  'howto.rampOn': 'Em todos os anéis',
  'howto.rampNote':
    'As faixas são deliberadamente largas e estreitam-se à medida que as suas tentativas se aproximam. Nada é tingido antes da primeira tentativa.',
  'howto.arrowTitle': 'Uma seta e uma distância',
  'howto.arrowBody':
    'Uma seta de bússola e uma leitura de quilómetros em tempo real apontam da sua última tentativa para a resposta. Transmitem a mesma informação que a cor, em palavras e números: no Meridian nada é transmitido apenas pela cor.',
  'howto.dailyTitle': 'Diário e Treino',
  'howto.dailyBody':
    'O desafio diário é um enigma por modo e por dia, igual para toda a gente e gerado apenas a partir da data: não há servidor. Resolva-o e a sequência desse modo cresce; falhe um dia e reinicia. O dia muda à sua própria meia-noite local.',
  'howto.practiceBody':
    'O treino distribui enigmas aleatórios sem limite. Mantém os seus próprios contadores acumulados e nunca afeta uma sequência diária.',
  'howto.scopeBody':
    'A resposta é sempre um dos 195 Estados soberanos. Os territórios e as zonas disputadas são desenhados como terra inerte: nunca clicáveis, nunca a resposta.',
  'howto.keyboard': 'Teclado',
  'howto.keyTab': 'Percorra o mapa, país a país.',
  'howto.keyEnter': 'Adivinhe o país selecionado.',
  'howto.keyEscape': 'Volte ao menu.',
  'howto.keyHelp': 'Abra esta página.',
  'howto.credits':
    'Fronteiras da Natural Earth (domínio público). Bandeiras de flagcdn.com.',

  /* --- settings ---------------------------------------------------------- */
  'settings.title': 'Definições',
  'settings.language': 'Idioma',
  'settings.languageNote':
    'Os nomes dos países são traduzidos. Os nomes das capitais são apresentados em alfabeto latino em todos os idiomas, porque os dados de origem não os traduzem.',
  'settings.a11y.chooseLanguage': 'Escolher {language}',
  'settings.distance': 'Distâncias',
  'settings.distanceNote':
    'É apenas uma definição de apresentação. As distâncias são sempre calculadas e partilhadas em quilómetros, para que um resultado partilhado continue comparável entre jogadores, seja qual for a unidade que cada um lê.',
  'settings.a11y.chooseUnit': 'Mostrar as distâncias em {unit}',
  'units.km': 'Quilómetros',
  'units.mi': 'Milhas',
  'settings.about': 'Acerca de',
  'settings.version': 'Versão',

  /* --- service worker ---------------------------------------------------- */
  'sw.updateReady': 'Está pronta uma nova versão.',
  'sw.reload': 'Recarregar',
  'sw.updating': 'A atualizar…',
  'sw.dismiss': 'Dispensar o aviso de atualização',
  'sw.offlineReady': 'Pronto para jogar offline.',

  /* --- errors ------------------------------------------------------------ */
  'error.title': 'Errata',
  'error.heading': 'Algo correu mal',
  'error.retry': 'Tentar novamente',
  'error.reload': 'Recarregar o Meridian',

  /* --- common ------------------------------------------------------------ */
  'common.none': '—',
  'common.back': 'Voltar',
};
