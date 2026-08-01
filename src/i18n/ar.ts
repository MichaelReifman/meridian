/**
 * The Arabic dictionary — Modern Standard Arabic, and the app's only right-to-left locale.
 *
 * No directional control characters appear in any string. Direction belongs to the
 * document and the layout; a stray RLM baked into a translation would survive into the
 * share text and the page title, where nothing is there to strip it. Latin-script values
 * that land inside these strings — capital names, country codes, "Meridian" — are
 * isolated by the components with `<bdi>`, so the strings stay clean text.
 *
 * Counts: `t()` has no plural machinery, and Arabic agreement changes at one, two,
 * three-to-ten and eleven-plus. Every `{count}` key therefore either puts the numeral
 * before a singular accusative noun (تمييز — "{count} تخمينًا"), which reads for any
 * value, or drops the noun after a colon so no agreement is required at all.
 */

import type { Dictionary } from '@/i18n/en';

export const AR: Dictionary = {
  /* --- application shell ------------------------------------------------- */
  'app.name': 'Meridian',
  'app.tagline':
    'استنتاج جغرافي يومي. كل تخمين خاطئ يرسم حلقة لا بد أن يقع الجواب عليها — قاطِع بينها حتى لا تبقى سوى دولة واحدة.',

  /* --- menu -------------------------------------------------------------- */
  'menu.mode.country': 'دولة',
  'menu.mode.capital': 'عاصمة',
  'menu.mode.flag': 'علم',
  'menu.blurb.country': 'اسم عليك تحديد موضعه على الخريطة.',
  'menu.blurb.capital': 'مدينة عليك نسبتها إلى دولتها.',
  'menu.blurb.flag': 'علم عليك تتبّعه إلى الدولة التي يرفرف فوقها.',
  'menu.daily': 'تحدي اليوم',
  'menu.review': 'مراجعة',
  'menu.practice': 'تدريب',
  'menu.solved': 'تم الحل',
  'menu.revealed': 'تم الكشف',
  'menu.streak': 'السلسلة',
  'menu.stats': 'الإحصاءات',
  'menu.howto': 'طريقة اللعب',
  'menu.settings': 'الإعدادات',
  'menu.countdown': 'تحديات جديدة بعد {time}',
  'menu.a11y.playDaily': 'العب تحدي اليوم في نمط {mode}',
  'menu.a11y.reviewDaily': 'راجع تحدي اليوم في نمط {mode}، وقد انتهى بالفعل',
  'menu.a11y.practice': 'ابدأ جولة تدريب في نمط {mode}',
  'menu.a11y.streak': 'السلسلة اليومية الحالية: {count} يومًا.',
  'menu.a11y.more': 'المزيد',
  'menu.a11y.practiceRegion': 'منطقة التدريب',

  /* --- regions ----------------------------------------------------------- */
  'region.all': 'كل المناطق',
  'region.africa': 'أفريقيا',
  'region.americas': 'الأمريكتان',
  'region.asia': 'آسيا',
  'region.europe': 'أوروبا',
  'region.oceania': 'أوقيانوسيا',

  /* --- play -------------------------------------------------------------- */
  'play.findCountry': 'اعثر على هذه الدولة',
  'play.findCapital': 'اعثر على هذه العاصمة',
  'play.findFlag': 'اعثر على هذا العلم',
  'play.guesses': 'التخمينات',
  'play.guessesCount': 'التخمينات حتى الآن: {count}',
  'play.km': 'كم',
  'play.mi': 'ميل',
  'play.back': 'العودة إلى القائمة',
  'play.resetView': 'إعادة ضبط عرض الخريطة',
  'play.zoomIn': 'تكبير',
  'play.zoomOut': 'تصغير',
  'play.giveUp': 'الاستسلام وكشف الجواب',
  'play.showResult': 'عرض النتيجة مرة أخرى',
  'play.skipMap': 'تخطّي الخريطة',
  'play.endOfMap': 'نهاية الخريطة',
  'play.mapLabel': 'خريطة العالم — اختر دولة',
  'play.search.label': 'خمّن دولة بكتابة اسمها',
  'play.search.placeholder': 'اكتب اسم دولة',
  'play.search.help':
    'اكتب جزءًا من اسم دولة، ثم حدّد اقتراحًا بسهمي الأعلى والأسفل، واضغط مفتاح الإدخال لتخمينه.',
  'play.search.suggestions': 'الدول المطابقة',
  'play.search.resultCount': 'الاقتراحات: {count}',
  'play.search.noResults': 'لا تطابق ذلك أي دولة.',
  'play.search.guessed': 'مُخمَّنة',
  'play.a11y.guessTrail': 'التخمينات حتى الآن، الأحدث أولًا',
  'play.a11y.alreadyGuessed': '{country}، سبق تخمينها',
  'play.a11y.bearing': '{distance} {unit}، الاتجاه {compass}',
  'play.title': 'Meridian — {kind}: {mode}',

  /* --- reveal ------------------------------------------------------------ */
  'reveal.solvedIn': 'حُلّ في {count} تخمينًا',
  'reveal.revealedAfter': 'كُشف الجواب بعد {count} تخمينًا',
  'reveal.revealed': 'تم الكشف',
  'reveal.capital': 'العاصمة',
  'reveal.region': 'المنطقة',
  'reveal.guesses': 'التخمينات',
  'reveal.code': 'الرمز',
  'reveal.share': 'مشاركة',
  'reveal.nextRound': 'الجولة التالية',
  'reveal.continue': 'متابعة',
  'reveal.yourGuesses': 'تخميناتك: ',
  'reveal.copied': 'نُسخ إلى الحافظة',
  'reveal.shareFailed': 'تعذّرت المشاركة',

  /* --- stats ------------------------------------------------------------- */
  'stats.title': 'سجلّك',
  'stats.daily': 'اليومي',
  'stats.practice': 'التدريب',
  'stats.currentStreak': 'السلسلة الحالية',
  'stats.maxStreak': 'أطول سلسلة',
  'stats.bestSolve': 'أفضل نتيجة',
  'stats.played': 'لُعبت',
  'stats.solved': 'حُلّت',
  'stats.avgGuesses': 'متوسط التخمينات',
  'stats.dist.title': 'التوزيع',
  'stats.dist.a11y': 'التحديات اليومية المحلولة، مجمَّعة بحسب عدد التخمينات التي احتاجها كلٌّ منها',
  'stats.dist.tenPlus': '{count}+',
  'stats.dist.empty': 'لم يُحلّ أي تحدٍّ يومي في هذا النمط بعد.',
  'stats.dist.inPlay':
    'هناك جولة مفتوحة عند {count} من التخمينات. تبيّن العلامة أين ستقع إن جاء التخمين التالي صائبًا.',
  'stats.clear': 'مسح جميع البيانات',
  'stats.clearConfirm': 'محو كل السلاسل والإحصاءات؟ لا يمكن التراجع عن ذلك.',
  'stats.clearYes': 'محو كل شيء',
  'stats.clearNo': 'الاحتفاظ ببياناتي',
  'stats.empty': 'لا شيء مسجَّل بعد. العب جولة وستظهر هنا.',

  /* --- how to play ------------------------------------------------------- */
  'howto.title': 'طريقة اللعب',
  'howto.intro':
    'يظهر لك دليل. انقر على الدولة التي ترى أنه يشير إليها. عدد التخمينات غير محدود، ونتيجتك هي عدد ما احتجت إليه منها، فالأقل أفضل. ويمكنك الاستسلام في أي وقت ليُكشف الجواب. المسافات بالكيلومترات.',
  'howto.modes': 'الأنماط الثلاثة',
  'howto.modeCountry': 'الدليل هو اسم الدولة.',
  'howto.modeCapital': 'الدليل عاصمة. اعثر على الدولة التي تنتمي إليها.',
  'howto.modeFlag': 'الدليل علم. اعثر على الدولة التي يرفرف فوقها.',
  'howto.modesNote': 'لا تختلط الأنماط داخل الجولة الواحدة، ولكل نمط سلسلته اليومية الخاصة.',
  'howto.signals': 'كل تخمين خاطئ يخبرك بأمرين',
  'howto.ringTitle': 'حلقة تتقاطع مع سواها',
  'howto.ringBody':
    'يعود إليك كل تخمين بمسافة، وهذه المسافة دقيقة تمامًا — أي أن الجواب يقع في مكان ما على حلقة تبعد هذا المقدار عن الدولة التي نقرت عليها. وترسم الخريطة تلك الحلقة حول الكرة الأرضية بأكملها. تخمين واحد يضيّق الاحتمالات تضييقًا هائلًا دون أن يكشف شيئًا.',
  'howto.ringBody2':
    'خمّن مرة أخرى في موضع آخر فتظهر حلقة ثانية. ولا تبقى ملوّنة إلا المواضع التي تحقق الحلقتين معًا، وهي عادة قائمة قصيرة. والتخمين الثالث يحسم الأمر غالبًا. أنت هنا تُثلّث الموقع، كما يُحدَّد موضع انطلاقًا من معلمين اثنين.',
  'howto.rampOff': 'بعيد عن الحلقة',
  'howto.rampOn': 'على كل الحلقات',
  'howto.rampNote':
    'النطاقات خشنة عن قصد، وتضيق كلما اقتربت تخميناتك. ولا يُلوَّن شيء قبل تخمينك الأول.',
  'howto.arrowTitle': 'سهم ومسافة',
  'howto.arrowBody':
    'يشير سهم بوصلة وقراءة حية بالكيلومترات من تخمينك الأخير نحو الجواب. وهما يحملان المعلومة نفسها التي يحملها اللون، بالكلمات والأرقام — فلا شيء في Meridian يُنقل باللون وحده.',
  'howto.dailyTitle': 'التحدي اليومي والتدريب',
  'howto.dailyBody':
    'التحدي اليومي لغز واحد لكل نمط في كل يوم، وهو نفسه لدى الجميع ويُولَّد من التاريخ وحده، فلا خادم هنا. إذا حللته نمت سلسلة ذلك النمط، وإذا فاتك يوم عادت إلى الصفر. ويتبدل اليوم عند منتصف الليل بتوقيتك المحلي.',
  'howto.practiceBody':
    'يوزّع التدريب ألغازًا عشوائية بلا حد. وله عدّاداته الخاصة على مدى العمر، ولا يمس أي سلسلة يومية.',
  'howto.scopeBody':
    'الجواب دائمًا واحدة من ١٩٥ دولة ذات سيادة. أما الأقاليم والمناطق المتنازع عليها فتُرسم يابسة خاملة: لا يمكن النقر عليها أبدًا، ولا تكون الجواب أبدًا.',
  'howto.keyboard': 'لوحة المفاتيح',
  'howto.keyTab': 'التنقل في الخريطة دولةً دولة.',
  'howto.keyEnter': 'تخمين الدولة المحددة.',
  'howto.keyEscape': 'العودة إلى القائمة.',
  'howto.keyHelp': 'فتح هذه الصفحة.',
  'howto.credits': 'الحدود من Natural Earth (ملكية عامة). الأعلام من flagcdn.com.',

  /* --- settings ---------------------------------------------------------- */
  'settings.title': 'الإعدادات',
  'settings.language': 'اللغة',
  'settings.languageNote':
    'تُترجَم أسماء الدول. أما أسماء العواصم فتظهر بالحروف اللاتينية في كل اللغات، لأن بيانات المصدر لا تترجمها.',
  'settings.a11y.chooseLanguage': 'اختيار {language}',
  'settings.distance': 'المسافات',
  'settings.distanceNote':
    'إعداد عرض فقط. تُقاس المسافات وتُشارَك بالكيلومترات دائمًا، حتى تبقى النتيجة المشتركة قابلة للمقارنة بين اللاعبين مهما كانت الوحدة التي يقرأ بها كل منهم.',
  'settings.a11y.chooseUnit': 'إظهار المسافات بوحدة {unit}',
  'units.km': 'الكيلومترات',
  'units.mi': 'الأميال',
  'settings.about': 'عن التطبيق',
  'settings.version': 'الإصدار',

  /* --- service worker ---------------------------------------------------- */
  'sw.updateReady': 'نسخة جديدة جاهزة.',
  'sw.reload': 'إعادة التحميل',
  'sw.updating': 'جارٍ التحديث…',
  'sw.dismiss': 'إخفاء إشعار التحديث',
  'sw.offlineReady': 'جاهز للعب دون اتصال.',

  /* --- errors ------------------------------------------------------------ */
  'error.title': 'استدراك',
  'error.heading': 'حدث خطأ ما',
  'error.retry': 'إعادة المحاولة',
  'error.reload': 'إعادة تحميل Meridian',

  /* --- common ------------------------------------------------------------ */
  'common.none': '—',
  'common.back': 'رجوع',
};
