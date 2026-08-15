import type { NativeLanguage } from '../types';

/** Ключи UI-строк (общий словарь ru / en / zh). */
export type UiMessageKey =
  | 'nav.home'
  | 'nav.explore'
  | 'nav.library'
  | 'nav.flashcards'
  | 'nav.settings'
  | 'brand.hub'
  | 'action.addFanfic'
  | 'action.back'
  | 'action.close'
  | 'action.save'
  | 'action.saving'
  | 'action.read'
  | 'action.continue'
  | 'action.search'
  | 'action.showText'
  | 'action.hideText'
  | 'action.toggleTranslation'
  | 'action.theme'
  | 'action.active'
  | 'action.next'
  | 'action.skip'
  | 'action.done'
  | 'action.start'
  | 'action.retry'
  | 'action.openExplore'
  | 'action.copyLink'
  | 'action.copied'
  | 'action.cancel'
  | 'action.create'
  | 'action.on'
  | 'action.off'
  | 'settings.title'
  | 'settings.direction'
  | 'settings.directionHint'
  | 'settings.learn'
  | 'settings.native'
  | 'settings.russianTranslation'
  | 'settings.translationHidden'
  | 'settings.translationShown'
  | 'settings.theme'
  | 'settings.themeDark'
  | 'settings.themeLight'
  | 'auth.guest'
  | 'auth.loginForSync'
  | 'auth.account'
  | 'sync.synced'
  | 'sync.syncing'
  | 'sync.error'
  | 'sync.ready'
  | 'sync.offline'
  | 'offline.title'
  | 'offline.hint'
  | 'offline.dismiss'
  | 'addBook.title'
  | 'addBook.subtitle'
  | 'lang.learn'
  | 'lang.native'
  | 'lang.all'
  | 'lang.zh'
  | 'lang.ru'
  | 'lang.en'
  | 'library.searchPlaceholder'
  | 'library.searchAria'
  | 'library.searching'
  | 'library.allBooks'
  | 'library.addCategory'
  | 'library.emptyCollectionsHint'
  | 'library.nothingFound'
  | 'library.nothingFoundHint'
  | 'library.resetFilters'
  | 'library.editOwner'
  | 'library.deleteOwner'
  | 'library.paragraphs'
  | 'library.fromCatalog'
  | 'empty.libraryTitle'
  | 'empty.libraryDesc'
  | 'empty.libraryAction'
  | 'empty.collectionsTitle'
  | 'empty.collectionsDesc'
  | 'empty.collectionsAction'
  | 'empty.genericTitle'
  | 'empty.genericDesc'
  | 'empty.genericAction'
  | 'reader.noBook'
  | 'reader.notesTitle'
  | 'reader.notesBody'
  | 'reader.pageLight'
  | 'reader.pageDark'
  | 'reader.pageSepia'
  | 'reader.showHints'
  | 'reader.hideHints'
  | 'reader.showPinyin'
  | 'reader.hidePinyin'
  | 'reader.settings'
  | 'reader.fontSmaller'
  | 'reader.fontLarger'
  | 'reader.autoScrollOn'
  | 'reader.autoScrollOff'
  | 'reader.toggleRu'
  | 'reader.ttsPlay'
  | 'reader.ttsStop'
  | 'reader.audio'
  | 'reader.stop'
  | 'reader.download'
  | 'reader.delete'
  | 'reader.openTranslation'
  | 'reader.downloadFail'
  | 'reader.downloadEmpty'
  | 'reader.downloadError'
  | 'alert.noAccess'
  | 'alert.deleteAuthorOnly'
  | 'alert.deleteFanfic'
  | 'alert.deleteFanficBody'
  | 'alert.error'
  | 'alert.deleteFail'
  | 'alert.category'
  | 'alert.publish'
  | 'alert.publishLoginRequired'
  | 'alert.published'
  | 'alert.linkCopied'
  | 'alert.linkTitle'
  | 'alert.linkAfterPublish'
  | 'alert.cannotDeleteSystem'
  | 'alert.deleteCategory'
  | 'alert.deleteCategoryBody'
  | 'alert.editCollectionOwnerOnly'
  | 'alert.editCollectionOnly'
  | 'alert.deleteFanficNamed'
  | 'word.cardTitle'
  | 'word.close'
  | 'word.translating'
  | 'word.searchTrans'
  | 'word.transFail'
  | 'word.addCard'
  | 'word.alreadyInCard'
  | 'word.waitTranslate'
  | 'word.retry'
  | 'word.grammar'
  | 'word.translateLabel'
  | 'word.dictRu'
  | 'word.serviceUnavailable'
  | 'tour.welcomeTitle'
  | 'tour.welcomeBody'
  | 'tour.libraryTitle'
  | 'tour.libraryBody'
  | 'tour.clickWordTitle'
  | 'tour.clickWordBody'
  | 'tour.addBookTitle'
  | 'tour.addBookBody'
  | 'tour.languageTitle'
  | 'tour.languageBody'
  | 'catalog.searchPlaceholder'
  | 'catalog.searchAria'
  | 'catalog.allTags'
  | 'catalog.opening'
  | 'catalog.adding'
  | 'catalog.addToLibrary'
  | 'catalog.addAndRead'
  | 'catalog.openInReader'
  | 'catalog.readOnly'
  | 'catalog.title'
  | 'catalog.subtitle'
  | 'catalog.searching'
  | 'catalog.myLibrary'
  | 'catalog.publicCollections'
  | 'catalog.readyTexts'
  | 'catalog.loadingCollections'
  | 'catalog.loadCollectionsFail'
  | 'catalog.noPublicCollections'
  | 'catalog.noPublicCollectionsQuery'
  | 'catalog.noStories'
  | 'catalog.inLibrary'
  | 'catalog.genre'
  | 'catalog.bookCardAria'
  | 'catalog.youAreAuthor'
  | 'catalog.badgePublic'
  | 'catalog.badgeOwner'
  | 'catalog.textsCount'
  | 'catalog.textsCountOne'
  | 'catalog.allLevels'
  | 'catalog.levelBeginner'
  | 'catalog.levelIntermediate'
  | 'catalog.levelAdvanced'
  | 'catalog.allGenres'
  | 'catalog.cat.fantasy'
  | 'catalog.cat.romance'
  | 'catalog.cat.adventure'
  | 'catalog.cat.slice-of-life'
  | 'catalog.cat.school'
  | 'catalog.cat.original'
  | 'catalog.cat.harry-potter'
  | 'catalog.tag.hsk2'
  | 'catalog.tag.hsk3'
  | 'catalog.tag.cefr-a2'
  | 'catalog.tag.cefr-b1'
  | 'catalog.tag.school'
  | 'catalog.tag.daily'
  | 'catalog.tag.cafe'
  | 'catalog.tag.dialogue'
  | 'catalog.tag.romance'
  | 'catalog.tag.travel'
  | 'catalog.tag.narrative'
  | 'catalog.lang.zh'
  | 'catalog.lang.ru'
  | 'catalog.lang.en'
  | 'catalog.hskLevel'
  | 'catalog.cefrLevel'
  | 'public.notFound'
  | 'public.loadFail'
  | 'public.title'
  | 'public.loading'
  | 'public.goHome'
  | 'public.editHint'
  | 'public.texts'
  | 'public.emptyBooks'
  | 'progress.easy'
  | 'progress.medium'
  | 'progress.hard'
  | 'progress.activityHint'
  | 'progress.title'
  | 'progress.continueReading'
  | 'progress.readingLine'
  | 'progress.streak'
  | 'progress.streakDays'
  | 'progress.wordsLearned'
  | 'progress.today'
  | 'progress.wordsReadToday'
  | 'progress.cardsReviewedToday'
  | 'progress.minutesInApp'
  | 'progress.activity'
  | 'progress.activityDay'
  | 'progress.less'
  | 'progress.more'
  | 'progress.reading'
  | 'progress.readingWords'
  | 'progress.enCoverage'
  | 'progress.hskLevels'
  | 'progress.coverageStats'
  | 'progress.uniqueShort'
  | 'progress.inFlashcards'
  | 'progress.coverage'
  | 'progress.coverageHint'
  | 'stories.pageTitle'
  | 'stories.tab.new'
  | 'stories.tab.reading'
  | 'stories.tab.completed'
  | 'stories.chaptersCount'
  | 'stories.statusLabel'
  | 'stories.status.complete'
  | 'stories.status.incomplete'
  | 'reader.autoScrollLabel'
  | 'reader.clickWordHintNative'
  | 'reader.readProgressLine'
  | 'reader.autoScrollBadge'
  | 'reader.practiceModeHint'
  | 'reader.peekTranslation'
  | 'reader.grammarCount'
  | 'mini.nowPlaying'
  | 'mini.paused'
  | 'mini.seek'
  | 'mini.seekOwnTracks'
  | 'mini.loadingShort'
  | 'mini.volume'
  | 'mini.title'
  | 'mini.localHint'
  | 'mini.empty'
  | 'mini.localDevice'
  | 'mini.delete'
  | 'mini.upload'
  | 'mini.uploadTimeout'
  | 'settings.addBookHint'
  | 'library.loading'
  | 'library.newCategory'
  | 'library.newCategoryPlaceholder'
  | 'library.editBook'
  | 'library.originalTitle'
  | 'library.translatedTitle'
  | 'library.optionalPlaceholder'
  | 'library.categoryLabel'
  | 'library.languageHint'
  | 'library.linkAfterSave'
  | 'alert.editFanficOnly'
  | 'library.noCollection'
  | 'library.publicShort'
  | 'home.tagline'
  | 'home.importTitle'
  | 'folder.retroTitle'
  | 'folder.all'
  | 'folder.emptyTitle'
  | 'folder.emptyHint'
  | 'folder.dropActive'
  | 'folder.dropIdle'
  | 'folder.dropHint'
  | 'folder.needFile'
  | 'folder.readFail'
  | 'action.open'
  | 'action.edit'
  | 'action.delete'
  | 'flashcards.brand'
  | 'flashcards.title.hub'
  | 'flashcards.title.session'
  | 'flashcards.title.done'
  | 'flashcards.back'
  | 'flashcards.backToDeck'
  | 'flashcards.dueTotal'
  | 'flashcards.stat.new'
  | 'flashcards.stat.learning'
  | 'flashcards.stat.learned'
  | 'flashcards.langLabel'
  | 'flashcards.langAll'
  | 'flashcards.sourceLabel'
  | 'flashcards.allBooks'
  | 'flashcards.startSession'
  | 'flashcards.nothingToReview'
  | 'flashcards.emptyHint.en'
  | 'flashcards.emptyHint.zh'
  | 'flashcards.emptyHint.other'
  | 'flashcards.sessionHint'
  | 'flashcards.sessionDone'
  | 'flashcards.reviewedSummary'
  | 'flashcards.anotherSession'
  | 'flashcards.progress'
  | 'flashcards.progressWithAnswers'
  | 'flashcards.fromFanfic'
  | 'flashcards.noContextYet'
  | 'flashcards.noTranslation'
  | 'flashcards.tapToReveal'
  | 'flashcards.showAnswer'
  | 'flashcards.grade.again'
  | 'flashcards.grade.hard'
  | 'flashcards.grade.good'
  | 'flashcards.grade.easy'
  | 'flashcards.grade.againHint'
  | 'flashcards.grade.hardHint'
  | 'flashcards.grade.goodHint'
  | 'flashcards.grade.easyHint'
  | 'flashcards.delete'
  | 'flashcards.deleteConfirm'
  | 'flashcards.deleteConfirmBody'
  | 'flashcards.browse'
  | 'flashcards.browseTitle'
  | 'flashcards.searchPlaceholder'
  | 'flashcards.exportCsv'
  | 'flashcards.exportAnki'
  | 'flashcards.shareDeck'
  | 'flashcards.shareImport'
  | 'flashcards.shareNotFound'
  | 'flashcards.shareFail'
  | 'flashcards.shareCopied'
  | 'flashcards.shareImported'
  | 'flashcards.shareImportedBody'
  | 'flashcards.shareMeta'
  | 'flashcards.shareLoginRequired'
  | 'flashcards.modeLabel'
  | 'flashcards.mode.recognition'
  | 'flashcards.mode.recall'
  | 'flashcards.mode.cloze'
  | 'flashcards.mode.listen'
  | 'flashcards.emptyBrowse'
  | 'flashcards.speakCard'
  | 'flashcards.addGrammar'
  | 'flashcards.grammarAdded'
  | 'progress.dailyGoal'
  | 'progress.wordsGoal'
  | 'progress.cardsGoal'
  | 'progress.goalMet'
  | 'progress.dueCards'
  | 'progress.continueWithDue'
  | 'word.removeFromDeck'
  | 'word.knownRemoved'
  | 'flashcards.queueLabel'
  | 'flashcards.queue.default'
  | 'flashcards.queue.weak'
  | 'flashcards.queue.mixed'
  | 'flashcards.keyboardHint'
  | 'flashcards.demoDeck'
  | 'flashcards.demoDeckDone'
  | 'flashcards.importAnki'
  | 'flashcards.importAnkiDone'
  | 'progress.dueBannerTitle'
  | 'progress.dueBannerHint'
  | 'progress.dueBannerCta'
  | 'progress.weekTitle'
  | 'progress.weekStats'
  | 'catalog.publicDecks'
  | 'catalog.noPublicDecks'
  | 'catalog.deckCardsCount'
  | 'addBook.screenSubtitle.en'
  | 'addBook.screenSubtitle.zh'
  | 'addBook.screenSubtitle.ru'
  | 'addBook.sourceLang'
  | 'addBook.fanficTitle'
  | 'addBook.titlePlaceholder'
  | 'addBook.fanficText'
  | 'addBook.uploadTxt'
  | 'addBook.placeholder.en'
  | 'addBook.placeholder.zh'
  | 'addBook.placeholder.ru'
  | 'addBook.translateFromTo'
  | 'addBook.hskLevel'
  | 'addBook.collection'
  | 'addBook.createCollection'
  | 'addBook.analyzeEn'
  | 'addBook.saveLangText'
  | 'addBook.analyzeText'
  | 'addBook.saveAndRead'
  | 'addBook.enPreviewTitle'
  | 'addBook.enPreviewMeta'
  | 'addBook.parallelLabel'
  | 'addBook.parallelEmpty'
  | 'addBook.parallelError'
  | 'addBook.moreItems'
  | 'addBook.grammarTitle'
  | 'addBook.defaultTitle'
  | 'addBook.newCollection'
  | 'addBook.collectionNamePlaceholder'
  | 'addBook.color'
  | 'addBook.create'
  | 'addBook.a11y.back'
  | 'addBook.a11y.theme'
  | 'addBook.a11y.translate'
  | 'addBook.a11y.analyze'
  | 'addBook.alert.attention'
  | 'addBook.alert.error'
  | 'addBook.alert.translateError'
  | 'addBook.alert.analyzeError'
  | 'addBook.alert.saveError'
  | 'addBook.alert.enterCollection'
  | 'addBook.alert.pasteForTranslate'
  | 'addBook.alert.notLikely'
  | 'addBook.alert.enterTitle'
  | 'addBook.alert.enterText'
  | 'addBook.alert.parallelTitle'
  | 'addBook.alert.parallelBody'
  | 'addBook.alert.translateUnavailableTitle'
  | 'addBook.alert.translateUnavailableSave'
  | 'addBook.alert.translateUnavailableRetry'
  | 'addBook.alert.unsupportedPair'
  | 'addBook.loading.translatePrep'
  | 'addBook.loading.analyzeEn'
  | 'addBook.loading.analyzeHsk'
  | 'addBook.loading.prepareContent'
  | 'addBook.loading.translateParallel'
  | 'addBook.unknownError'
  | 'reader.peekHint'
  | 'reader.showParagraphTranslation'
  | 'reader.hideParagraphTranslation'
  | 'reader.peekedSuffix'
  | 'reader.hiddenSuffix'
  | 'reader.ttsWord'
  | 'reader.ttsParagraph'
  | 'reader.grammarBadge'
  | 'reader.grammarToggle'
  | 'reader.targetHskNotebook'
  | 'reader.sourceParallel'
  | 'reader.showNativeTranslation'
  | 'reader.parsing'
  | 'reader.translatingParagraphs'
  | 'reader.translateTextFail'
  | 'word.addToDict'
  | 'word.markKnown'
  | 'word.inDict'
  | 'word.markedKnown'
  | 'auth.enterEmail'
  | 'auth.enterPassword'
  | 'auth.passwordTooShort'
  | 'auth.redirectingGoogle'
  | 'auth.signOutTimeout'
  | 'auth.syncTimeout'
  | 'auth.signIn'
  | 'auth.signUp'
  | 'auth.signInSubtitle'
  | 'auth.signUpSubtitle'
  | 'auth.passwordPlaceholder'
  | 'auth.noAccount'
  | 'auth.hasAccount'
  | 'auth.continueGuest'
  | 'auth.syncDevicesHint'
  | 'auth.signOut'
  | 'auth.syncNow'
  | 'auth.submitSignIn'
  | 'auth.submitSignUp'
  | 'auth.googleSignIn'
  | 'auth.syncError'

type Dictionary = Record<UiMessageKey, string>;

const ru: Dictionary = {
  'nav.home': 'Главная',
  'nav.explore': 'Каталог',
  'nav.library': 'Библиотека',
  'nav.flashcards': 'Карточки',
  'nav.settings': 'Настройки',
  'brand.hub': 'мультиязычный хаб',
  'action.addFanfic': 'Добавить фанфик',
  'action.back': 'Назад',
  'action.close': 'Закрыть',
  'action.save': 'Сохранить',
  'action.saving': 'Сохраняем…',
  'action.read': 'Читать',
  'action.continue': 'Продолжить',
  'action.search': 'Поиск',
  'action.showText': 'Показать текст',
  'action.hideText': 'Скрыть текст',
  'action.toggleTranslation': 'Скрыть / показать перевод',
  'action.theme': 'Переключить тему',
  'action.active': 'активно',
  'action.next': 'Далее',
  'action.skip': 'Пропустить',
  'action.done': 'Готово',
  'action.start': 'Начать',
  'action.retry': 'Повторить',
  'action.openExplore': 'Открыть Explore',
  'action.copyLink': 'Копировать ссылку',
  'action.copied': 'Скопировано ✓',
  'settings.title': 'Настройки',
  'settings.direction': 'Направление изучения',
  'settings.directionHint':
    'Learn — язык текста. Native — язык интерфейса и перевода в модалках.',
  'settings.learn': 'Изучаю',
  'settings.native': 'Родной',
  'settings.russianTranslation': 'Параллельный перевод',
  'settings.translationHidden': 'Скрыт (режим практики)',
  'settings.translationShown': 'Показан рядом с текстом',
  'settings.theme': 'Тема оформления',
  'settings.themeDark': 'Тёмная (Dark Neon)',
  'settings.themeLight': 'Светлая (Soft Light)',
  'auth.guest': 'Гостевой режим',
  'auth.loginForSync': 'Войти для синхронизации',
  'auth.account': 'Аккаунт',
  'sync.synced': 'Синхронизировано',
  'sync.syncing': 'Синхронизация…',
  'sync.error': 'Ошибка синхр.',
  'sync.ready': 'Готово к синхр.',
  'sync.offline': 'Офлайн',
  'offline.title': 'Вы в оффлайн-режиме. Доступны сохранённые тексты',
  'offline.hint':
    'Прогресс чтения сохранится локально и отправится в облако при появлении сети.',
  'offline.dismiss': 'OK',
  'addBook.title': 'Добавить фанфик',
  'addBook.subtitle': 'импорт и анализ',
  'lang.learn': 'Изучаю',
  'lang.native': 'Родной',
  'lang.all': 'Все языки',
  'lang.zh': '中文',
  'lang.ru': 'RU',
  'lang.en': 'EN',
  'library.searchPlaceholder': 'Поиск по названию или тексту…',
  'library.searchAria': 'Поиск в библиотеке',
  'library.searching': 'Ищем…',
  'library.allBooks': 'Все книги',
  'library.addCategory': '+ Категория',
  'library.emptyCollectionsHint': 'Сгруппируйте фанфики по темам.',
  'library.nothingFound': 'Ничего не найдено',
  'library.nothingFoundHint':
    'Попробуйте другой фильтр, язык или сбросьте поиск.',
  'library.resetFilters': 'Сбросить фильтры',
  'library.editOwner': 'Редактировать (только автор)',
  'library.deleteOwner': 'Удалить (только автор)',
  'library.paragraphs': '{n} абз.',
  'library.fromCatalog': 'каталог',
  'empty.libraryTitle': 'Здесь пока пусто',
  'empty.libraryDesc':
    'Добавьте первый фанфик — читайте оригинал, собирайте слова и учите язык в своём ритме.',
  'empty.libraryAction': 'Добавить первый фанфик',
  'empty.collectionsTitle': 'Здесь пока пусто',
  'empty.collectionsDesc':
    'Создайте первую подборку, чтобы группировать фанфики по темам, авторам или уровню.',
  'empty.collectionsAction': 'Создать первую подборку',
  'empty.genericTitle': 'Здесь пока пусто',
  'empty.genericDesc': 'Самое время начать — добавьте что-нибудь своё.',
  'empty.genericAction': 'Начать',
  'reader.noBook': 'Нет открытого фанфика',
  'reader.notesTitle': 'Notes',
  'reader.notesBody':
    'Кликните по слову — откроется карточка с переводом на родной язык.',
  'reader.pageLight': 'Светлый',
  'reader.pageDark': 'Тёмный',
  'reader.pageSepia': 'Сепия',
  'reader.showHints': 'Показать подсказки',
  'reader.hideHints': 'Скрыть подсказки',
  'reader.showPinyin': 'Показать пиньинь',
  'reader.hidePinyin': 'Скрыть пиньинь',
  'reader.settings': 'Настройки читалки',
  'reader.fontSmaller': 'Уменьшить шрифт',
  'reader.fontLarger': 'Увеличить шрифт',
  'reader.autoScrollOn': 'Остановить автопрокрутку',
  'reader.autoScrollOff': 'Медленная прокрутка текста вниз',
  'reader.toggleRu': 'Показать / скрыть перевод',
  'reader.ttsPlay': 'Озвучить текст',
  'reader.ttsStop': 'Остановить озвучку',
  'reader.audio': 'Audio',
  'reader.stop': 'Стоп',
  'reader.download': 'Скачать перевод (.txt)',
  'reader.delete': 'Удалить фанфик',
  'reader.openTranslation': 'Открыть перевод',
  'reader.downloadFail': 'Не удалось сформировать файл',
  'reader.downloadEmpty': 'Нет открытого фанфика для скачивания',
  'reader.downloadError': 'Ошибка скачивания файла',
  'alert.noAccess': 'Нет доступа',
  'alert.deleteAuthorOnly': 'Удалять фанфик может только автор.',
  'alert.deleteFanfic': 'Удалить фанфик?',
  'alert.deleteFanficBody':
    'Это действие нельзя отменить.',
  'alert.error': 'Ошибка',
  'alert.deleteFail': 'Не удалось удалить фанфик',
  'word.cardTitle': 'Карточка слова',
  'word.close': 'Закрыть',
  'word.translating': 'Переводим…',
  'word.searchTrans': 'Ищем перевод…',
  'word.transFail': 'Не удалось получить перевод. Попробуйте ещё раз.',
  'word.addCard': '+ В карточки',
  'word.alreadyInCard': 'Уже в карточках',
  'word.waitTranslate': 'Ждём перевод…',
  'word.retry': 'Повторить перевод',
  'word.grammar': 'Грамматика / Конструкция',
  'word.translateLabel': 'Перевод',
  'word.dictRu': 'BKRS · русский',
  'word.serviceUnavailable':
    'Сервис перевода недоступен. Попробуйте ещё раз.',
  'tour.welcomeTitle': 'Добро пожаловать в languageeee',
  'tour.welcomeBody':
    'Учите языки через фанфики: читайте оригинал, смотрите перевод и собирайте слова в колоду.',
  'tour.libraryTitle': 'Библиотека и подборки',
  'tour.libraryBody':
    'В Библиотеке лежат ваши тексты. Группируйте их по подборкам — по автору, теме или уровню.',
  'tour.clickWordTitle': 'Клик по слову',
  'tour.clickWordBody':
    'Нажмите на слово в тексте — откроется карточка с переводом. Можно добавить в флэшкарточки.',
  'tour.addBookTitle': 'Свои тексты',
  'tour.addBookBody':
    'Кнопка «Добавить фанфик» загружает новый текст. Разбор и перевод появятся после обработки.',
  'tour.languageTitle': 'Языки',
  'tour.languageBody':
    'В шапке или в Настройках выбирайте изучаемый и родной язык (中文 / RU / EN) — интерфейс и переводы подстроятся.',
  'catalog.searchPlaceholder':
    'Поиск по названию, тексту, тегу, автору…',
  'catalog.searchAria': 'Поиск в каталоге',
  'catalog.allTags': 'Все теги',
  'catalog.opening': 'Открываем…',
  'catalog.adding': 'Добавляем…',
  'catalog.addToLibrary': 'Добавить в Мою библиотеку',
  'catalog.addAndRead': 'Добавить и читать',
  'catalog.openInReader': 'Открыть в ридере',
  'catalog.readOnly': 'только чтение',
  'catalog.title': 'Explore · Публичная библиотека',
  'catalog.subtitle':
    'Готовые тексты с разбором слов — добавьте в свою библиотеку и читайте с независимым прогрессом.',
  'catalog.searching': 'Ищем…',
  'catalog.myLibrary': '→ Моя библиотека',
  'catalog.publicCollections': 'Публичные подборки',
  'catalog.readyTexts': 'Готовые тексты',
  'catalog.loadingCollections': 'Загрузка подборок…',
  'catalog.loadCollectionsFail': 'Не удалось загрузить публичные подборки',
  'catalog.noPublicCollections': 'Пока нет опубликованных подборок',
  'catalog.noPublicCollectionsQuery': ' по этому запросу',
  'catalog.noStories': 'Пока нет публичных текстов по выбранным фильтрам.',
  'catalog.inLibrary': 'В библиотеке',
  'catalog.genre': 'Жанр',
  'catalog.bookCardAria': 'Карточка книги',
  'catalog.youAreAuthor': 'вы автор (правка — в Моей библиотеке)',
  'catalog.badgePublic': 'Публичная',
  'catalog.badgeOwner': 'Авторская',
  'catalog.textsCount': '{n} текстов',
  'catalog.textsCountOne': '{n} текст',
  'catalog.allLevels': 'Все уровни',
  'catalog.levelBeginner': 'Начальный / HSK 1–2',
  'catalog.levelIntermediate': 'Средний / HSK 3–4',
  'catalog.levelAdvanced': 'Продвинутый / HSK 5–6',
  'catalog.allGenres': 'Все жанры',
  'catalog.cat.fantasy': 'Фэнтези',
  'catalog.cat.romance': 'Романтика',
  'catalog.cat.adventure': 'Приключения',
  'catalog.cat.slice-of-life': 'Повседневность',
  'catalog.cat.school': 'Школа',
  'catalog.cat.original': 'Оригинал',
  'catalog.cat.harry-potter': 'Гарри Поттер',
  'catalog.tag.hsk2': 'HSK 2',
  'catalog.tag.hsk3': 'HSK 3',
  'catalog.tag.cefr-a2': 'CEFR A2',
  'catalog.tag.cefr-b1': 'CEFR B1',
  'catalog.tag.school': 'Школа',
  'catalog.tag.daily': 'Повседневность',
  'catalog.tag.cafe': 'Кафе',
  'catalog.tag.dialogue': 'Диалог',
  'catalog.tag.romance': 'Романтика',
  'catalog.tag.travel': 'Путешествия',
  'catalog.tag.narrative': 'Нарратив',
  'catalog.lang.zh': 'Китайский',
  'catalog.lang.ru': 'Русский',
  'catalog.lang.en': 'Английский',
  'catalog.hskLevel': 'HSK {n}',
  'catalog.cefrLevel': 'CEFR · lvl {n}',
  'public.notFound': 'Подборка не найдена или приватная',
  'public.loadFail': 'Не удалось загрузить текст',
  'public.title': 'Публичная подборка',
  'public.loading': 'Загрузка…',
  'public.goHome': 'На главную',
  'public.editHint': 'Редактировать и удалять может только автор подборки.',
  'public.texts': 'Тексты',
  'public.emptyBooks': 'В подборке пока нет текстов.',
  'progress.easy': 'Базовые',
  'progress.medium': 'Средние',
  'progress.hard': 'Сложные',
  'progress.activityHint': 'Активность: ярче = больше слов за день',
  'stories.pageTitle': 'Ваши любимые истории',
  'stories.tab.new': 'Новинки',
  'stories.tab.reading': 'Читаю',
  'stories.tab.completed': 'Прочитано',
  'stories.chaptersCount': '{n} главы',
  'stories.statusLabel': 'Статус:',
  'stories.status.complete': 'Завершено',
  'stories.status.incomplete': 'Не завершено',
  'action.cancel': 'Отмена',
  'action.create': 'Создать',
  'action.on': 'ON',
  'action.off': 'OFF',
  'alert.category': 'Категория',
  'alert.publish': 'Публикация',
  'alert.publishLoginRequired': 'Войдите в аккаунт, чтобы сделать подборку публичной и получить ссылку.',
  'alert.published': 'Опубликовано',
  'alert.linkCopied': 'Ссылка скопирована:\n{url}',
  'alert.linkTitle': 'Ссылка',
  'alert.linkAfterPublish':
    'Сначала сохраните подборку как публичную — ссылка появится после публикации.',
  'alert.cannotDeleteSystem': 'Системную категорию удалить нельзя.',
  'alert.deleteCategory': 'Удалить категорию?',
  'alert.deleteCategoryBody': '«{title}» будет удалена. Книги останутся в библиотеке без категории.',
  'alert.editCollectionOwnerOnly': 'Изменять подборку может только автор-владелец.',
  'alert.editCollectionOnly': 'Редактировать подборку может только автор.',
    'alert.editFanficOnly': 'Редактировать фанфик может только автор.',
'alert.deleteFanficNamed': 'Удалить «{title}»? Это действие нельзя отменить.',
  'progress.title': 'Прогресс',
  'progress.continueReading': 'Продолжить чтение',
  'progress.readingLine': '{pct}% · абз. {current}/{total}',
  'progress.streak': 'Streak',
  'progress.streakDays': 'дн.',
  'progress.wordsLearned': 'Выучено слов',
  'progress.today': 'Сегодня',
  'progress.wordsReadToday': 'Слов прочитано',
  'progress.cardsReviewedToday': 'Карточек повторено',
  'progress.minutesInApp': 'Минут в приложении',
  'progress.activity': 'Активность',
  'progress.activityDay': '{date}: {n} слов',
  'progress.less': 'Меньше',
  'progress.more': 'Больше',
  'progress.reading': 'Чтение',
  'progress.readingWords': '{pct}% · {n} слов',
  'progress.enCoverage': 'EN coverage',
  'progress.hskLevels': 'HSK Levels',
  'progress.coverageStats': '{label} · {unique} уник. · в карточках {known}%',
  'progress.uniqueShort': '{n} уник.',
  'progress.inFlashcards': 'в карточках {n}%',
  'progress.coverage': 'Покрытие',
  'progress.coverageHint': 'Откройте книгу — здесь появится HSK / EN-аналитика текста.',
  'reader.autoScrollLabel': 'Автопрокрутка',
  'reader.clickWordHintNative': 'Нажмите на слово — откроется карточка с переводом на родной язык.',
  'reader.readProgressLine': 'Прочитано {pct}% · абз. {current}/{total}',
  'reader.autoScrollBadge': ' · автоскролл',
  'reader.practiceModeHint': 'Перевод скрыт · практика чтения · клик по абзацу = подсмотреть',
  'reader.peekTranslation': 'подсмотреть перевод',
  'reader.grammarCount': 'Грамматика / Конструкции · {n}',
  'mini.nowPlaying': 'Сейчас играет',
  'mini.paused': 'Пауза',
  'mini.seek': 'Перемотка',
  'mini.seekOwnTracks': 'Перемотка доступна для своих треков',
  'mini.loadingShort': 'загрузка…',
  'mini.volume': 'Громкость',
  'mini.title': 'Моя музыка',
  'mini.localHint':
    'Файлы хранятся локально на этом устройстве (до {n} МБ). Без Firebase Storage.',
  'mini.empty': 'Пока пусто — загрузите аудиофайл.',
  'mini.localDevice': '{title} · локально на этом устройстве',
  'mini.delete': 'Удалить',
  'mini.upload': '+ Загрузить файл (до {n} МБ)',
  'mini.uploadTimeout':
    'Загрузка заняла слишком много времени. Файл мог сохраниться локально — обновите список или выберите файл поменьше.',
  'settings.addBookHint': 'HSK · MyMemory · cloud',
  'library.newCategory': 'Новая категория',
  'library.newCategoryPlaceholder': 'Например: Избранное',
  'library.editBook': 'Редактировать книгу',
  'library.originalTitle': 'Оригинальное название',
  'library.translatedTitle': 'Перевод названия',
  'library.optionalPlaceholder': 'необязательно',
  'library.categoryLabel': 'Категория',
  'library.languageHint': 'Язык: {lang} (меняется при добавлении нового текста)',
  'library.linkAfterSave': 'Ссылка появится после сохранения.',
  'library.noCollection': 'Без подборки',
  'library.publicShort': ' · публ.',
  'home.tagline': 'Y2K WebCore · учите языки через фанфики',
  'home.importTitle': 'Импорт',
  'folder.retroTitle': 'Ретро-библиотека · Finder folders',
  'folder.all': 'Все',
  'folder.emptyTitle': 'Здесь пока пусто',
  'folder.emptyHint': 'Создайте первую подборку в «Моя библиотека»',
  'folder.dropActive': 'Отпустите файл',
  'folder.dropIdle': 'Drop zone',
  'folder.dropHint': 'Перетащите .txt / .md / .pdf',
  'folder.needFile': 'Нужен .txt, .md или .pdf',
  'folder.readFail': 'Не удалось прочитать файл',
  'action.open': 'Открыть',
  'action.edit': 'Редактировать',
  'action.delete': 'Удалить',
  'library.loading': 'Загрузка…',
  'flashcards.brand': '🌸 SRS · интервалы',
  'flashcards.title.hub': 'Карточки',
  'flashcards.title.session': 'Сессия',
  'flashcards.title.done': 'Готово',
  'flashcards.back': 'Назад',
  'flashcards.backToDeck': 'К колоде',
  'flashcards.dueTotal': 'К повторению: {due} · Всего: {total}',
  'flashcards.stat.new': 'Новые',
  'flashcards.stat.learning': 'На грани',
  'flashcards.stat.learned': 'Выученные',
  'flashcards.langLabel': 'Язык',
  'flashcards.langAll': 'Все',
  'flashcards.sourceLabel': 'Книга / фанфик',
  'flashcards.allBooks': 'Все книги',
  'flashcards.startSession': 'Начать сессию · {n} карточек',
  'flashcards.nothingToReview': 'Нечего повторять',
  'flashcards.emptyHint.en':
    'Добавьте английские слова из ридера (клик → «В карточки»).',
  'flashcards.emptyHint.zh': 'Добавьте слова из ридера — колода пока пуста.',
  'flashcards.emptyHint.other': 'Добавьте слова из ридера или смените фильтр.',
  'flashcards.sessionHint':
    'Сначала карточки «на грани», затем новые. После ответа интервал обновляется (SM-2).',
  'flashcards.sessionDone': 'Сессия завершена',
  'flashcards.reviewedSummary':
    'Повторено: {done}\nСнова {again} · Трудно {hard} · Хорошо {good} · Легко {easy}',
  'flashcards.anotherSession': 'Ещё сессия',
  'flashcards.progress': '{i} / {total}',
  'flashcards.progressWithAnswers': ' · ответов {n}',
  'flashcards.fromFanfic': 'из фанфика',
  'flashcards.noContextYet': 'Цитата появится у новых карточек из ридера',
  'flashcards.noTranslation': 'Перевод не указан',
  'flashcards.tapToReveal': 'Нажмите, чтобы увидеть ответ',
  'flashcards.showAnswer': 'Показать ответ',
  'flashcards.grade.again': 'Снова',
  'flashcards.grade.hard': 'Трудно',
  'flashcards.grade.good': 'Хорошо',
  'flashcards.grade.easy': 'Легко',
  'flashcards.grade.againHint': '1д',
  'flashcards.grade.hardHint': 'сложнее',
  'flashcards.grade.goodHint': 'ок',
  'flashcards.grade.easyHint': 'легко',
  'flashcards.delete': 'Удалить карточку',
  'flashcards.deleteConfirm': 'Удалить карточку?',
  'flashcards.deleteConfirmBody':
    '«{word}» больше не будет попадаться в повторениях.',
  'flashcards.browse': 'Колода',
  'flashcards.browseTitle': 'Все карточки',
  'flashcards.searchPlaceholder': 'Поиск по слову или переводу…',
  'flashcards.exportCsv': 'Экспорт CSV',
  'flashcards.exportAnki': 'Экспорт Anki (TSV)',
  'flashcards.shareDeck': 'Поделиться колодой',
  'flashcards.shareImport': 'Добавить в свою колоду',
  'flashcards.shareNotFound': 'Колода не найдена или недоступна.',
  'flashcards.shareFail': 'Не удалось поделиться колодой.',
  'flashcards.shareCopied': 'Ссылка скопирована',
  'flashcards.shareImported': 'Колода импортирована',
  'flashcards.shareImportedBody': 'Добавлено: {added}. Пропущено: {skipped}.',
  'flashcards.shareMeta': '{n} карточек · {lang}',
  'flashcards.shareLoginRequired': 'Войдите в аккаунт, чтобы делиться колодой.',
  'flashcards.modeLabel': 'Режим',
  'flashcards.mode.recognition': 'Узнать',
  'flashcards.mode.recall': 'Вспомнить',
  'flashcards.mode.cloze': 'Cloze',
  'flashcards.mode.listen': 'Слушать',
  'flashcards.emptyBrowse': 'В колоде пока нет карточек по фильтру.',
  'flashcards.speakCard': 'Озвучить',
  'flashcards.addGrammar': '+ В карточки',
  'flashcards.grammarAdded': 'Грамматика в колоде',
  'progress.dailyGoal': 'Цель дня',
  'progress.wordsGoal': 'Слова {n}/{goal}',
  'progress.cardsGoal': 'Карточки {n}/{goal}',
  'progress.goalMet': 'Цель дня выполнена!',
  'progress.dueCards': 'К повторению: {n}',
  'progress.continueWithDue': 'Продолжить · due {n}',
  'word.removeFromDeck': 'Убрать из колоды',
  'word.knownRemoved': 'Знаю — убрано из SRS',
  'flashcards.queueLabel': "Очередь",
  'flashcards.queue.default': "Обычная",
  'flashcards.queue.weak': "Слабые",
  'flashcards.queue.mixed': "Микс",
  'flashcards.keyboardHint': "Space — ответ · 1–4 — оценка",
  'flashcards.demoDeck': "Демо-колода",
  'flashcards.demoDeckDone': "Добавлено демо-карточек: {n}",
  'flashcards.importAnki': "Импорт Anki",
  'flashcards.importAnkiDone': "Импортировано: {added}. Пропущено: {skipped}.",
  'progress.dueBannerTitle': "К повторению: {n}",
  'progress.dueBannerHint': "Короткая сессия укрепит стрик",
  'progress.dueBannerCta': "К карточкам",
  'progress.weekTitle': "Эта неделя",
  'progress.weekStats': "{words} слов · {cards} карточек · {min} мин",
  'catalog.publicDecks': "Публичные колоды",
  'catalog.noPublicDecks': "Пока нет публичных колод",
  'catalog.deckCardsCount': "{n} карточек",
  'addBook.screenSubtitle.en':
    'Язык: English. Вставьте английский или переведите с родного — слова станут кликабельными, параллельный текст сохранится в книгу.',
  'addBook.screenSubtitle.zh':
    'Язык: 中文. Вставьте китайский или переведите с родного — HSK 3.0 подсветит сложные слова и пиньинь.',
  'addBook.screenSubtitle.ru':
    'Язык: русский. Вставьте русский текст для изучения — параллельный перевод на родной можно получить кнопкой ниже.',
  'addBook.sourceLang': 'Язык исходного текста',
  'addBook.fanficTitle': 'Название фанфика',
  'addBook.titlePlaceholder': 'Например: Гарри Поттер и Тайная комната',
  'addBook.fanficText': 'Текст фанфика',
  'addBook.uploadTxt': 'Загрузить .txt',
  'addBook.placeholder.en':
    'Вставьте текст на родном языке (для перевода) или на английском…',
  'addBook.placeholder.zh':
    'Вставьте текст на родном языке или на китайском…',
  'addBook.placeholder.ru':
    'Вставьте текст на русском (изучаемый) или на родном для перевода…',
  'addBook.translateFromTo': 'Перевести с {from} → {to}',
  'addBook.hskLevel': 'Целевой уровень HSK',
  'addBook.collection': 'Подборка',
  'addBook.createCollection': '+ Создать новую подборку',
  'addBook.analyzeEn': 'Разобрать английский текст',
  'addBook.saveLangText': 'Сохранить текст ({lang})',
  'addBook.analyzeText': 'Проанализировать текст',
  'addBook.saveAndRead': 'Сохранить и начать чтение',
  'addBook.enPreviewTitle': 'Разбор English · {n} слов',
  'addBook.enPreviewMeta':
    'Токенов: {n}. Пиньинь не используется. language: en.',
  'addBook.parallelLabel': 'Параллельный текст ({lang})',
  'addBook.parallelEmpty':
    'Параллельный текст пока пуст — при сохранении попробуем перевести ещё раз.',
  'addBook.parallelError': 'Перевод: {error}',
  'addBook.moreItems': '…и ещё {n}',
  'addBook.grammarTitle': 'Грамматика / Конструкции · {n}',
  'addBook.defaultTitle': 'Новый фанфик',
  'addBook.newCollection': 'Новая подборка',
  'addBook.collectionNamePlaceholder': 'Название подборки',
  'addBook.color': 'Цвет',
  'addBook.create': 'Создать',
  'addBook.a11y.back': 'Назад',
  'addBook.a11y.theme': 'Переключить тему',
  'addBook.a11y.translate': 'Перевести с родного языка',
  'addBook.a11y.analyze': 'Проанализировать текст',
  'addBook.alert.attention': 'Внимание',
  'addBook.alert.error': 'Ошибка',
  'addBook.alert.translateError': 'Ошибка перевода',
  'addBook.alert.analyzeError': 'Ошибка анализа',
  'addBook.alert.saveError': 'Ошибка сохранения',
  'addBook.alert.enterCollection': 'Введите название подборки.',
  'addBook.alert.pasteForTranslate':
    'Вставьте текст на {lang} для перевода.',
  'addBook.alert.notLikely':
    'Текст не похож на {lang}. Вставьте оригинал на родном языке или смените язык контента.',
  'addBook.alert.enterTitle': 'Введите название фанфика.',
  'addBook.alert.enterText': 'Вставьте текст фанфика.',
  'addBook.alert.parallelTitle': 'Параллельный перевод',
  'addBook.alert.parallelBody':
    'API перевода не ответил вовремя. Разбор слов готов — можно сохранить без перевода или попробовать снова.',
  'addBook.alert.translateUnavailableTitle': 'Перевод недоступен',
  'addBook.alert.translateUnavailableSave':
    'Сохраняем текст без параллельного перевода. Попробуйте перевести позже.',
  'addBook.alert.translateUnavailableRetry':
    'Не удалось получить параллельный перевод. Книга сохранится без него.',
  'addBook.alert.unsupportedPair':
    'Пара перевода {from} → {to} пока не поддерживается.',
  'addBook.loading.translatePrep': 'Переводим: подготовка…',
  'addBook.loading.analyzeEn': 'Разбираем английские слова…',
  'addBook.loading.analyzeHsk': 'Анализируем текст по словарю HSK…',
  'addBook.loading.prepareContent': 'Готовим текст…',
  'addBook.loading.translateParallel': 'Переводим параллельный текст…',
  'addBook.unknownError': 'Неизвестная ошибка',
  'reader.peekHint': 'Нажмите, чтобы подсмотреть',
  'reader.showParagraphTranslation': 'Показать перевод абзаца',
  'reader.hideParagraphTranslation': 'Скрыть перевод абзаца',
  'reader.peekedSuffix': ' · подсмотр',
  'reader.hiddenSuffix': ' · скрыт',
  'reader.ttsWord': 'Озвучить {word}',
  'reader.ttsParagraph': 'Озвучить абзац',
  'reader.grammarBadge': 'Грамматика',
  'reader.grammarToggle': 'Грамматика ({n})',
  'reader.targetHskNotebook': 'Целевой HSK {n} · notebook mode',
  'reader.sourceParallel': 'Источник: оригинальный параллельный текст',
  'reader.showNativeTranslation': 'Показать / скрыть перевод',
  'reader.parsing': 'Разбираем текст и грамматику…',
  'reader.translatingParagraphs': 'Переводим абзацы…',
  'reader.translateTextFail': 'Не удалось перевести текст',
  'word.addToDict': 'Добавить в словарик',
  'word.markKnown': 'Уже знаю',
  'word.inDict': 'В словарике',
  'word.markedKnown': 'Отмечено как известное',
  'auth.enterEmail': 'Введите Email.',
  'auth.enterPassword': 'Введите пароль.',
  'auth.passwordTooShort': 'Пароль должен быть не короче 6 символов.',
  'auth.redirectingGoogle': 'Перенаправление на Google…',
  'auth.signOutTimeout': 'Выход занял слишком много времени',
  'auth.syncTimeout': 'Синхронизация заняла слишком много времени',
  'auth.signIn': 'Вход',
  'auth.signUp': 'Регистрация',
  'auth.signInSubtitle': 'Войдите в существующий аккаунт.',
  'auth.signUpSubtitle': 'Создайте новый аккаунт для синхронизации.',
  'auth.passwordPlaceholder': 'Пароль (минимум 6 символов)',
  'auth.noAccount': 'Ещё нет аккаунта? Перейти к регистрации',
  'auth.hasAccount': 'Уже есть аккаунт? Перейти ко входу',
  'auth.continueGuest': 'Продолжить без входа',
  'auth.syncDevicesHint':
    'Ваши фанфики и карточки синхронизируются между устройствами.',
  'auth.signOut': 'Выйти',
  'auth.syncNow': 'Синхронизировать сейчас',
  'auth.submitSignIn': 'Войти',
  'auth.submitSignUp': 'Зарегистрироваться',
  'auth.googleSignIn': '🔵 Войти через Google',
  'auth.syncError': 'Ошибка синхронизации',
};

const en: Dictionary = {
  'nav.home': 'Home',
  'nav.explore': 'Explore',
  'nav.library': 'Library',
  'nav.flashcards': 'Cards',
  'nav.settings': 'Settings',
  'brand.hub': 'multilingual hub',
  'action.addFanfic': 'Add Fanfic',
  'action.back': 'Back',
  'action.close': 'Close',
  'action.save': 'Save',
  'action.saving': 'Saving…',
  'action.read': 'Read',
  'action.continue': 'Continue',
  'action.search': 'Search',
  'action.showText': 'Show text',
  'action.hideText': 'Hide text',
  'action.toggleTranslation': 'Show / hide translation',
  'action.theme': 'Toggle theme',
  'action.active': 'active',
  'action.next': 'Next',
  'action.skip': 'Skip',
  'action.done': 'Done',
  'action.start': 'Start',
  'action.retry': 'Retry',
  'action.openExplore': 'Open Explore',
  'action.copyLink': 'Copy link',
  'action.copied': 'Copied ✓',
  'settings.title': 'Settings',
  'settings.direction': 'Learning direction',
  'settings.directionHint':
    'Learn — text language. Native — UI language and glosses in modals.',
  'settings.learn': 'Learn',
  'settings.native': 'Native',
  'settings.russianTranslation': 'Parallel translation',
  'settings.translationHidden': 'Hidden (practice mode)',
  'settings.translationShown': 'Shown next to the text',
  'settings.theme': 'Theme',
  'settings.themeDark': 'Dark (Dark Neon)',
  'settings.themeLight': 'Light (Soft Light)',
  'auth.guest': 'Guest mode',
  'auth.loginForSync': 'Sign in to sync',
  'auth.account': 'Account',
  'sync.synced': 'Synced',
  'sync.syncing': 'Syncing…',
  'sync.error': 'Sync error',
  'sync.ready': 'Ready to sync',
  'sync.offline': 'Offline',
  'offline.title': 'You are offline. Saved texts are available',
  'offline.hint':
    'Reading progress is saved locally and will upload when you are back online.',
  'offline.dismiss': 'OK',
  'addBook.title': 'Add Fanfic',
  'addBook.subtitle': 'import and analyze',
  'lang.learn': 'Learn',
  'lang.native': 'Native',
  'lang.all': 'All languages',
  'lang.zh': '中文',
  'lang.ru': 'RU',
  'lang.en': 'EN',
  'library.searchPlaceholder': 'Search by title or text…',
  'library.searchAria': 'Search library',
  'library.searching': 'Searching…',
  'library.allBooks': 'All books',
  'library.addCategory': '+ Category',
  'library.emptyCollectionsHint': 'Group fanfics by topic.',
  'library.nothingFound': 'Nothing found',
  'library.nothingFoundHint':
    'Try another filter, language, or clear the search.',
  'library.resetFilters': 'Reset filters',
  'library.editOwner': 'Edit (owner only)',
  'library.deleteOwner': 'Delete (owner only)',
  'library.paragraphs': '{n} paras',
  'library.fromCatalog': 'catalog',
  'empty.libraryTitle': 'Nothing here yet',
  'empty.libraryDesc':
    'Add your first fanfic — read the original, collect words, and learn at your pace.',
  'empty.libraryAction': 'Add first fanfic',
  'empty.collectionsTitle': 'Nothing here yet',
  'empty.collectionsDesc':
    'Create a collection to group fanfics by topic, author, or level.',
  'empty.collectionsAction': 'Create first collection',
  'empty.genericTitle': 'Nothing here yet',
  'empty.genericDesc': 'A good time to start — add something of your own.',
  'empty.genericAction': 'Start',
  'reader.noBook': 'No fanfic open',
  'reader.notesTitle': 'Notes',
  'reader.notesBody':
    'Click a word — a card opens with a translation into your native language.',
  'reader.pageLight': 'Light',
  'reader.pageDark': 'Dark',
  'reader.pageSepia': 'Sepia',
  'reader.showHints': 'Show hints',
  'reader.hideHints': 'Hide hints',
  'reader.showPinyin': 'Show pinyin',
  'reader.hidePinyin': 'Hide pinyin',
  'reader.settings': 'Reader settings',
  'reader.fontSmaller': 'Decrease font',
  'reader.fontLarger': 'Increase font',
  'reader.autoScrollOn': 'Stop auto-scroll',
  'reader.autoScrollOff': 'Slow scroll down',
  'reader.toggleRu': 'Show / hide translation',
  'reader.ttsPlay': 'Read aloud',
  'reader.ttsStop': 'Stop speech',
  'reader.audio': 'Audio',
  'reader.stop': 'Stop',
  'reader.download': 'Download translation (.txt)',
  'reader.delete': 'Delete fanfic',
  'reader.openTranslation': 'Open translation',
  'reader.downloadFail': 'Could not build the file',
  'reader.downloadEmpty': 'No fanfic open to download',
  'reader.downloadError': 'Download failed',
  'alert.noAccess': 'No access',
  'alert.deleteAuthorOnly': 'Only the author can delete a fanfic.',
  'alert.deleteFanfic': 'Delete fanfic?',
  'alert.deleteFanficBody': 'This cannot be undone.',
  'alert.error': 'Error',
  'alert.deleteFail': 'Could not delete the fanfic',
  'word.cardTitle': 'Word card',
  'word.close': 'Close',
  'word.translating': 'Translating…',
  'word.searchTrans': 'Looking up translation…',
  'word.transFail': 'Could not get a translation. Please try again.',
  'word.addCard': '+ Add to cards',
  'word.alreadyInCard': 'Already in cards',
  'word.waitTranslate': 'Waiting for translation…',
  'word.retry': 'Retry translation',
  'word.grammar': 'Grammar / Structure',
  'word.translateLabel': 'Translation',
  'word.dictRu': 'BKRS · Russian',
  'word.serviceUnavailable':
    'Translation service unavailable. Please try again.',
  'tour.welcomeTitle': 'Welcome to languageeee',
  'tour.welcomeBody':
    'Learn languages through fanfic: read the original, check translations, and collect words into a deck.',
  'tour.libraryTitle': 'Library and collections',
  'tour.libraryBody':
    'Your texts live in Library. Group them by author, topic, or level.',
  'tour.clickWordTitle': 'Click a word',
  'tour.clickWordBody':
    'Tap a word in the text — a translation card opens. You can add it to flashcards.',
  'tour.addBookTitle': 'Your own texts',
  'tour.addBookBody':
    '“Add Fanfic” uploads a new text. Parsing and translation appear after processing.',
  'tour.languageTitle': 'Languages',
  'tour.languageBody':
    'In the header or Settings pick learning and native languages (中文 / RU / EN) — UI and glosses follow.',
  'catalog.searchPlaceholder': 'Search by title, text, tag, author…',
  'catalog.searchAria': 'Search catalog',
  'catalog.allTags': 'All tags',
  'catalog.opening': 'Opening…',
  'catalog.adding': 'Adding…',
  'catalog.addToLibrary': 'Add to My Library',
  'catalog.addAndRead': 'Add and read',
  'catalog.openInReader': 'Open in reader',
  'catalog.readOnly': 'read only',
  'catalog.title': 'Explore · Public library',
  'catalog.subtitle':
    'Ready-made texts with word breakdown — add to your library and read with independent progress.',
  'catalog.searching': 'Searching…',
  'catalog.myLibrary': '→ My Library',
  'catalog.publicCollections': 'Public collections',
  'catalog.readyTexts': 'Ready texts',
  'catalog.loadingCollections': 'Loading collections…',
  'catalog.loadCollectionsFail': 'Could not load public collections',
  'catalog.noPublicCollections': 'No published collections yet',
  'catalog.noPublicCollectionsQuery': ' for this query',
  'catalog.noStories': 'No public texts match the selected filters.',
  'catalog.inLibrary': 'In library',
  'catalog.genre': 'Genre',
  'catalog.bookCardAria': 'Book card',
  'catalog.youAreAuthor': 'you are the author (edit in My Library)',
  'catalog.badgePublic': 'Public',
  'catalog.badgeOwner': 'Yours',
  'catalog.textsCount': '{n} texts',
  'catalog.textsCountOne': '{n} text',
  'catalog.allLevels': 'All levels',
  'catalog.levelBeginner': 'Beginner / HSK 1–2',
  'catalog.levelIntermediate': 'Intermediate / HSK 3–4',
  'catalog.levelAdvanced': 'Advanced / HSK 5–6',
  'catalog.allGenres': 'All genres',
  'catalog.cat.fantasy': 'Fantasy',
  'catalog.cat.romance': 'Romance',
  'catalog.cat.adventure': 'Adventure',
  'catalog.cat.slice-of-life': 'Slice of life',
  'catalog.cat.school': 'School',
  'catalog.cat.original': 'Original',
  'catalog.cat.harry-potter': 'Harry Potter',
  'catalog.tag.hsk2': 'HSK 2',
  'catalog.tag.hsk3': 'HSK 3',
  'catalog.tag.cefr-a2': 'CEFR A2',
  'catalog.tag.cefr-b1': 'CEFR B1',
  'catalog.tag.school': 'School',
  'catalog.tag.daily': 'Daily life',
  'catalog.tag.cafe': 'Café',
  'catalog.tag.dialogue': 'Dialogue',
  'catalog.tag.romance': 'Romance',
  'catalog.tag.travel': 'Travel',
  'catalog.tag.narrative': 'Narrative',
  'catalog.lang.zh': 'Chinese',
  'catalog.lang.ru': 'Russian',
  'catalog.lang.en': 'English',
  'catalog.hskLevel': 'HSK {n}',
  'catalog.cefrLevel': 'CEFR · lvl {n}',
  'public.notFound': 'Collection not found or private',
  'public.loadFail': 'Could not load the text',
  'public.title': 'Public collection',
  'public.loading': 'Loading…',
  'public.goHome': 'Go home',
  'public.editHint': 'Only the collection author can edit or delete it.',
  'public.texts': 'Texts',
  'public.emptyBooks': 'This collection has no texts yet.',
  'progress.easy': 'Basic',
  'progress.medium': 'Medium',
  'progress.hard': 'Hard',
  'progress.activityHint': 'Activity: brighter = more words that day',
  'stories.pageTitle': 'Your favorite novels',
  'stories.tab.new': 'New',
  'stories.tab.reading': 'Reading',
  'stories.tab.completed': 'Completed',
  'stories.chaptersCount': '{n} chapters',
  'stories.statusLabel': 'Status:',
  'stories.status.complete': 'Complete',
  'stories.status.incomplete': 'Incomplete',
  'action.cancel': 'Cancel',
  'action.create': 'Create',
  'action.on': 'ON',
  'action.off': 'OFF',
  'alert.category': 'Category',
  'alert.publish': 'Publishing',
  'alert.publishLoginRequired': 'Sign in to make the collection public and get a link.',
  'alert.published': 'Published',
  'alert.linkCopied': 'Link copied:\n{url}',
  'alert.linkTitle': 'Link',
  'alert.linkAfterPublish': 'Save the collection as public first — the link appears after publishing.',
  'alert.cannotDeleteSystem': 'System categories cannot be deleted.',
  'alert.deleteCategory': 'Delete category?',
  'alert.deleteCategoryBody': '"{title}" will be deleted. Books stay in the library without a category.',
  'alert.editCollectionOwnerOnly': 'Only the owner can change this collection.',
  'alert.editCollectionOnly': 'Only the author can edit this collection.',
    'alert.editFanficOnly': 'Only the author can edit a fanfic.',
'alert.deleteFanficNamed': 'Delete "{title}"? This cannot be undone.',
  'progress.title': 'Progress',
  'progress.continueReading': 'Continue reading',
  'progress.readingLine': '{pct}% · para. {current}/{total}',
  'progress.streak': 'Streak',
  'progress.streakDays': 'days',
  'progress.wordsLearned': 'Words Learned',
  'progress.today': 'Today',
  'progress.wordsReadToday': 'Words read',
  'progress.cardsReviewedToday': 'Cards reviewed',
  'progress.minutesInApp': 'Minutes in app',
  'progress.activity': 'Activity',
  'progress.activityDay': '{date}: {n} words',
  'progress.less': 'Less',
  'progress.more': 'More',
  'progress.reading': 'Reading',
  'progress.readingWords': '{pct}% · {n} words',
  'progress.enCoverage': 'EN coverage',
  'progress.hskLevels': 'HSK Levels',
  'progress.coverageStats': '{label} · {unique} unique · in cards {known}%',
  'progress.uniqueShort': '{n} unique',
  'progress.inFlashcards': 'in cards {n}%',
  'progress.coverage': 'Coverage',
  'progress.coverageHint': 'Open a book — HSK / EN text analytics will appear here.',
  'reader.autoScrollLabel': 'Auto-scroll',
  'reader.clickWordHintNative':
    'Click a word — a card opens with a translation into your native language.',
  'reader.readProgressLine': 'Read {pct}% · para. {current}/{total}',
  'reader.autoScrollBadge': ' · auto-scroll',
  'reader.practiceModeHint': 'Translation hidden · reading practice · tap a paragraph to peek',
  'reader.peekTranslation': 'peek translation',
  'reader.grammarCount': 'Grammar / Structures · {n}',
  'mini.nowPlaying': 'Now playing',
  'mini.paused': 'Paused',
  'mini.seek': 'Seek',
  'mini.seekOwnTracks': 'Seek is available for your own tracks',
  'mini.loadingShort': 'loading…',
  'mini.volume': 'Volume',
  'mini.title': 'My music',
  'mini.localHint': 'Files stay on this device (up to {n} MB). No Firebase Storage.',
  'mini.empty': 'Empty — upload an audio file.',
  'mini.localDevice': '{title} · local on this device',
  'mini.delete': 'Delete',
  'mini.upload': '+ Upload file (up to {n} MB)',
  'mini.uploadTimeout':
    'Upload took too long. The file may already be saved locally — refresh the list or pick a smaller file.',
  'settings.addBookHint': 'HSK · MyMemory · cloud',
  'library.newCategory': 'New category',
  'library.newCategoryPlaceholder': 'e.g. Favorites',
  'library.editBook': 'Edit book',
  'library.originalTitle': 'Original title',
  'library.translatedTitle': 'Translated title',
  'library.optionalPlaceholder': 'optional',
  'library.categoryLabel': 'Category',
  'library.languageHint': 'Language: {lang} (changes when you add a new text)',
  'library.linkAfterSave': 'The link will appear after saving.',
  'library.noCollection': 'Uncategorized',
  'library.publicShort': ' · pub.',
  'home.tagline': 'Y2K WebCore · learn languages through fanfic',
  'home.importTitle': 'Import',
  'folder.retroTitle': 'Retro library · Finder folders',
  'folder.all': 'All',
  'folder.emptyTitle': 'Nothing here yet',
  'folder.emptyHint': 'Create your first collection in My Library',
  'folder.dropActive': 'Drop the file',
  'folder.dropIdle': 'Drop zone',
  'folder.dropHint': 'Drop .txt / .md / .pdf',
  'folder.needFile': 'Need a .txt, .md, or .pdf file',
  'folder.readFail': 'Could not read the file',
  'action.open': 'Open',
  'action.edit': 'Edit',
  'action.delete': 'Delete',
  'library.loading': 'Loading…',
  'flashcards.brand': '🌸 SRS · spaced',
  'flashcards.title.hub': 'Cards',
  'flashcards.title.session': 'Session',
  'flashcards.title.done': 'Done',
  'flashcards.back': 'Back',
  'flashcards.backToDeck': 'To deck',
  'flashcards.dueTotal': 'Due: {due} · Total: {total}',
  'flashcards.stat.new': 'New',
  'flashcards.stat.learning': 'Learning',
  'flashcards.stat.learned': 'Learned',
  'flashcards.langLabel': 'Language',
  'flashcards.langAll': 'All',
  'flashcards.sourceLabel': 'Book / fanfic',
  'flashcards.allBooks': 'All books',
  'flashcards.startSession': 'Start session · {n} cards',
  'flashcards.nothingToReview': 'Nothing to review',
  'flashcards.emptyHint.en':
    'Add English words from the reader (tap → “Add to cards”).',
  'flashcards.emptyHint.zh':
    'Add words from the reader — the deck is empty for now.',
  'flashcards.emptyHint.other':
    'Add words from the reader or change the filter.',
  'flashcards.sessionHint':
    'Learning cards first, then new ones. After each answer the interval updates (SM-2).',
  'flashcards.sessionDone': 'Session complete',
  'flashcards.reviewedSummary':
    'Reviewed: {done}\nAgain {again} · Hard {hard} · Good {good} · Easy {easy}',
  'flashcards.anotherSession': 'Another session',
  'flashcards.progress': '{i} / {total}',
  'flashcards.progressWithAnswers': ' · answers {n}',
  'flashcards.fromFanfic': 'from fanfic',
  'flashcards.noContextYet': 'Quotes appear on new cards from the reader',
  'flashcards.noTranslation': 'No translation yet',
  'flashcards.tapToReveal': 'Tap to reveal the answer',
  'flashcards.showAnswer': 'Show answer',
  'flashcards.grade.again': 'Again',
  'flashcards.grade.hard': 'Hard',
  'flashcards.grade.good': 'Good',
  'flashcards.grade.easy': 'Easy',
  'flashcards.grade.againHint': '1d',
  'flashcards.grade.hardHint': 'harder',
  'flashcards.grade.goodHint': 'ok',
  'flashcards.grade.easyHint': 'easy',
  'flashcards.delete': 'Delete card',
  'flashcards.deleteConfirm': 'Delete this card?',
  'flashcards.deleteConfirmBody':
    '“{word}” will no longer appear in reviews.',
  'flashcards.browse': 'Deck',
  'flashcards.browseTitle': 'All cards',
  'flashcards.searchPlaceholder': 'Search word or translation…',
  'flashcards.exportCsv': 'Export CSV',
  'flashcards.exportAnki': 'Export Anki (TSV)',
  'flashcards.shareDeck': 'Share deck',
  'flashcards.shareImport': 'Add to my deck',
  'flashcards.shareNotFound': 'Deck not found or unavailable.',
  'flashcards.shareFail': 'Could not share the deck.',
  'flashcards.shareCopied': 'Link copied',
  'flashcards.shareImported': 'Deck imported',
  'flashcards.shareImportedBody': 'Added: {added}. Skipped: {skipped}.',
  'flashcards.shareMeta': '{n} cards · {lang}',
  'flashcards.shareLoginRequired': 'Sign in to share a deck.',
  'flashcards.modeLabel': 'Mode',
  'flashcards.mode.recognition': 'Recognize',
  'flashcards.mode.recall': 'Recall',
  'flashcards.mode.cloze': 'Cloze',
  'flashcards.mode.listen': 'Listen',
  'flashcards.emptyBrowse': 'No cards match this filter yet.',
  'flashcards.speakCard': 'Speak',
  'flashcards.addGrammar': '+ Add to cards',
  'flashcards.grammarAdded': 'Grammar in deck',
  'progress.dailyGoal': 'Daily goal',
  'progress.wordsGoal': 'Words {n}/{goal}',
  'progress.cardsGoal': 'Cards {n}/{goal}',
  'progress.goalMet': 'Daily goal reached!',
  'progress.dueCards': 'Due: {n}',
  'progress.continueWithDue': 'Continue · due {n}',
  'word.removeFromDeck': 'Remove from deck',
  'word.knownRemoved': 'Known — removed from SRS',
  'flashcards.queueLabel': "Queue",
  'flashcards.queue.default': "Default",
  'flashcards.queue.weak': "Weak",
  'flashcards.queue.mixed': "Mixed",
  'flashcards.keyboardHint': "Space — reveal · 1–4 — grade",
  'flashcards.demoDeck': "Demo deck",
  'flashcards.demoDeckDone': "Demo cards added: {n}",
  'flashcards.importAnki': "Import Anki",
  'flashcards.importAnkiDone': "Imported: {added}. Skipped: {skipped}.",
  'progress.dueBannerTitle': "Due today: {n}",
  'progress.dueBannerHint': "A short session keeps your streak alive",
  'progress.dueBannerCta': "Open cards",
  'progress.weekTitle': "This week",
  'progress.weekStats': "{words} words · {cards} cards · {min} min",
  'catalog.publicDecks': "Public decks",
  'catalog.noPublicDecks': "No public decks yet",
  'catalog.deckCardsCount': "{n} cards",
  'addBook.screenSubtitle.en':
    'Language: English. Paste English or translate from your native language — words become tappable and the parallel text is saved with the book.',
  'addBook.screenSubtitle.zh':
    'Language: 中文. Paste Chinese or translate from your native language — HSK 3.0 highlights hard words and pinyin.',
  'addBook.screenSubtitle.ru':
    'Language: Russian. Paste Russian study text — use the button below to get a parallel translation into your native language.',
  'addBook.sourceLang': 'Source text language',
  'addBook.fanficTitle': 'Fanfic title',
  'addBook.titlePlaceholder': 'e.g. Harry Potter and the Chamber of Secrets',
  'addBook.fanficText': 'Fanfic text',
  'addBook.uploadTxt': 'Upload .txt',
  'addBook.placeholder.en':
    'Paste text in your native language (to translate) or in English…',
  'addBook.placeholder.zh':
    'Paste text in your native language or in Chinese…',
  'addBook.placeholder.ru':
    'Paste Russian study text, or native text to translate…',
  'addBook.translateFromTo': 'Translate from {from} → {to}',
  'addBook.hskLevel': 'Target HSK level',
  'addBook.collection': 'Collection',
  'addBook.createCollection': '+ Create new collection',
  'addBook.analyzeEn': 'Analyze English text',
  'addBook.saveLangText': 'Save {lang} text',
  'addBook.analyzeText': 'Analyze text',
  'addBook.saveAndRead': 'Save and start reading',
  'addBook.enPreviewTitle': 'English breakdown · {n} words',
  'addBook.enPreviewMeta':
    'Tokens: {n}. No pinyin. language: en.',
  'addBook.parallelLabel': 'Parallel text ({lang})',
  'addBook.parallelEmpty':
    'Parallel text is empty for now — we will try again on save.',
  'addBook.parallelError': 'Translation: {error}',
  'addBook.moreItems': '…and {n} more',
  'addBook.grammarTitle': 'Grammar / Patterns · {n}',
  'addBook.defaultTitle': 'New fanfic',
  'addBook.newCollection': 'New collection',
  'addBook.collectionNamePlaceholder': 'Collection name',
  'addBook.color': 'Color',
  'addBook.create': 'Create',
  'addBook.a11y.back': 'Back',
  'addBook.a11y.theme': 'Toggle theme',
  'addBook.a11y.translate': 'Translate from native language',
  'addBook.a11y.analyze': 'Analyze text',
  'addBook.alert.attention': 'Notice',
  'addBook.alert.error': 'Error',
  'addBook.alert.translateError': 'Translation error',
  'addBook.alert.analyzeError': 'Analysis error',
  'addBook.alert.saveError': 'Save error',
  'addBook.alert.enterCollection': 'Enter a collection name.',
  'addBook.alert.pasteForTranslate':
    'Paste text in {lang} to translate.',
  'addBook.alert.notLikely':
    'This does not look like {lang}. Paste native-language text or change the content language.',
  'addBook.alert.enterTitle': 'Enter a fanfic title.',
  'addBook.alert.enterText': 'Paste the fanfic text.',
  'addBook.alert.parallelTitle': 'Parallel translation',
  'addBook.alert.parallelBody':
    'The translation API timed out. Word breakdown is ready — you can save without a parallel text or try again.',
  'addBook.alert.translateUnavailableTitle': 'Translation unavailable',
  'addBook.alert.translateUnavailableSave':
    'Saving without a parallel translation. Try translating later.',
  'addBook.alert.translateUnavailableRetry':
    'Could not get a parallel translation. The book will be saved without it.',
  'addBook.alert.unsupportedPair':
    'Translation pair {from} → {to} is not supported yet.',
  'addBook.loading.translatePrep': 'Translating: preparing…',
  'addBook.loading.analyzeEn': 'Tokenizing English…',
  'addBook.loading.analyzeHsk': 'Analyzing with the HSK dictionary…',
  'addBook.loading.prepareContent': 'Preparing text…',
  'addBook.loading.translateParallel': 'Translating parallel text…',
  'addBook.unknownError': 'Unknown error',
  'reader.peekHint': 'Tap to peek translation',
  'reader.showParagraphTranslation': 'Show paragraph translation',
  'reader.hideParagraphTranslation': 'Hide paragraph translation',
  'reader.peekedSuffix': ' · peeked',
  'reader.hiddenSuffix': ' · hidden',
  'reader.ttsWord': 'Speak {word}',
  'reader.ttsParagraph': 'Speak paragraph',
  'reader.grammarBadge': 'Grammar',
  'reader.grammarToggle': 'Grammar ({n})',
  'reader.targetHskNotebook': 'Target HSK {n} · notebook mode',
  'reader.sourceParallel': 'Source: original parallel text',
  'reader.showNativeTranslation': 'Show / hide translation',
  'reader.parsing': 'Parsing text and grammar…',
  'reader.translatingParagraphs': 'Translating paragraphs…',
  'reader.translateTextFail': 'Could not translate the text',
  'word.addToDict': 'Add to dictionary',
  'word.markKnown': 'I already know this',
  'word.inDict': 'In dictionary',
  'word.markedKnown': 'Marked as known',
  'auth.enterEmail': 'Enter your email.',
  'auth.enterPassword': 'Enter your password.',
  'auth.passwordTooShort': 'Password must be at least 6 characters.',
  'auth.redirectingGoogle': 'Redirecting to Google…',
  'auth.signOutTimeout': 'Sign-out took too long',
  'auth.syncTimeout': 'Sync took too long',
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Sign up',
  'auth.signInSubtitle': 'Sign in to your existing account.',
  'auth.signUpSubtitle': 'Create a new account to sync.',
  'auth.passwordPlaceholder': 'Password (min. 6 characters)',
  'auth.noAccount': 'No account yet? Go to sign up',
  'auth.hasAccount': 'Already have an account? Go to sign in',
  'auth.continueGuest': 'Continue without signing in',
  'auth.syncDevicesHint':
    'Your fanfics and cards sync across devices.',
  'auth.signOut': 'Sign out',
  'auth.syncNow': 'Sync now',
  'auth.submitSignIn': 'Sign in',
  'auth.submitSignUp': 'Create account',
  'auth.googleSignIn': '🔵 Sign in with Google',
  'auth.syncError': 'Sync error',
};

const zh: Dictionary = {
  'nav.home': '主页',
  'nav.explore': '小说',
  'nav.library': '图书馆',
  'nav.flashcards': '卡片',
  'nav.settings': '设置',
  'brand.hub': '多语言学习中心',
  'action.addFanfic': '添加小说',
  'action.back': '返回',
  'action.close': '关闭',
  'action.save': '保存',
  'action.saving': '保存中…',
  'action.read': '阅读',
  'action.continue': '继续',
  'action.search': '搜索',
  'action.showText': '显示译文',
  'action.hideText': '隐藏译文',
  'action.toggleTranslation': '显示 / 隐藏译文',
  'action.theme': '切换主题',
  'action.active': '当前',
  'action.next': '下一步',
  'action.skip': '跳过',
  'action.done': '完成',
  'action.start': '开始',
  'action.retry': '重试',
  'action.openExplore': '打开小说',
  'action.copyLink': '复制链接',
  'action.copied': '已复制 ✓',
  'settings.title': '设置',
  'settings.direction': '学习方向',
  'settings.directionHint':
    'Learn — 文本语言。Native — 界面语言与弹窗释义语言。',
  'settings.learn': '学习',
  'settings.native': '母语',
  'settings.russianTranslation': '对照译文',
  'settings.translationHidden': '已隐藏（练习模式）',
  'settings.translationShown': '显示在文本旁',
  'settings.theme': '主题',
  'settings.themeDark': '深色 (Dark Neon)',
  'settings.themeLight': '浅色 (Soft Light)',
  'auth.guest': '访客模式',
  'auth.loginForSync': '登录以同步',
  'auth.account': '账户',
  'sync.synced': '已同步',
  'sync.syncing': '同步中…',
  'sync.error': '同步错误',
  'sync.ready': '待同步',
  'sync.offline': '离线',
  'offline.title': '当前处于离线模式，可阅读已保存文本',
  'offline.hint': '阅读进度会保存在本地，恢复网络后上传到云端。',
  'offline.dismiss': '好的',
  'addBook.title': '添加小说',
  'addBook.subtitle': '导入与分析',
  'lang.learn': '学习',
  'lang.native': '母语',
  'lang.all': '全部语言',
  'lang.zh': '中文',
  'lang.ru': 'RU',
  'lang.en': 'EN',
  'library.searchPlaceholder': '按标题或正文搜索…',
  'library.searchAria': '搜索图书馆',
  'library.searching': '搜索中…',
  'library.allBooks': '全部书籍',
  'library.addCategory': '+ 分类',
  'library.emptyCollectionsHint': '按主题整理小说。',
  'library.nothingFound': '未找到结果',
  'library.nothingFoundHint': '试试其他筛选、语言或清空搜索。',
  'library.resetFilters': '重置筛选',
  'library.editOwner': '编辑（仅作者）',
  'library.deleteOwner': '删除（仅作者）',
  'library.paragraphs': '{n} 段',
  'library.fromCatalog': '小说',
  'empty.libraryTitle': '这里还是空的',
  'empty.libraryDesc':
    '添加第一部小说——阅读原文、收集单词，按自己的节奏学习。',
  'empty.libraryAction': '添加第一部小说',
  'empty.collectionsTitle': '这里还是空的',
  'empty.collectionsDesc':
    '创建第一个合集，按主题、作者或等级整理小说。',
  'empty.collectionsAction': '创建第一个合集',
  'empty.genericTitle': '这里还是空的',
  'empty.genericDesc': '现在开始吧——添加你自己的内容。',
  'empty.genericAction': '开始',
  'reader.noBook': '未打开小说',
  'reader.notesTitle': '笔记',
  'reader.notesBody': '点击单词即可打开母语释义卡片。',
  'reader.pageLight': '浅色',
  'reader.pageDark': '深色',
  'reader.pageSepia': '羊皮纸',
  'reader.showHints': '显示提示',
  'reader.hideHints': '隐藏提示',
  'reader.showPinyin': '显示拼音',
  'reader.hidePinyin': '隐藏拼音',
  'reader.settings': '阅读器设置',
  'reader.fontSmaller': '缩小字体',
  'reader.fontLarger': '放大字体',
  'reader.autoScrollOn': '停止自动滚动',
  'reader.autoScrollOff': '缓慢向下滚动',
  'reader.toggleRu': '显示 / 隐藏译文',
  'reader.ttsPlay': '朗读文本',
  'reader.ttsStop': '停止朗读',
  'reader.audio': '朗读',
  'reader.stop': '停止',
  'reader.download': '下载译文 (.txt)',
  'reader.delete': '删除小说',
  'reader.openTranslation': '打开译文',
  'reader.downloadFail': '无法生成文件',
  'reader.downloadEmpty': '没有可下载的小说',
  'reader.downloadError': '下载失败',
  'alert.noAccess': '无权限',
  'alert.deleteAuthorOnly': '只有作者可以删除小说。',
  'alert.deleteFanfic': '删除小说？',
  'alert.deleteFanficBody': '此操作无法撤销。',
  'alert.error': '错误',
  'alert.deleteFail': '无法删除小说',
  'word.cardTitle': '单词卡',
  'word.close': '关闭',
  'word.translating': '翻译中…',
  'word.searchTrans': '正在查找翻译…',
  'word.transFail': '无法获取翻译，请重试。',
  'word.addCard': '+ 加入卡片',
  'word.alreadyInCard': '已在卡片中',
  'word.waitTranslate': '等待翻译…',
  'word.retry': '重试翻译',
  'word.grammar': '语法 / 结构',
  'word.translateLabel': '翻译',
  'word.dictRu': 'BKRS · 俄语',
  'word.serviceUnavailable': '翻译服务不可用，请重试。',
  'tour.welcomeTitle': '欢迎来到 languageeee',
  'tour.welcomeBody':
    '通过小说学语言：读原文、看译文，并把单词收入卡组。',
  'tour.libraryTitle': '图书馆与合集',
  'tour.libraryBody':
    '你的文本在图书馆里。可按作者、主题或等级分组。',
  'tour.clickWordTitle': '点击单词',
  'tour.clickWordBody':
    '点击文中的词会打开翻译卡片，也可以加入闪卡。',
  'tour.addBookTitle': '自己的文本',
  'tour.addBookBody':
    '「添加小说」可上传新文本，解析与翻译会在处理后出现。',
  'tour.languageTitle': '语言',
  'tour.languageBody':
    '在顶栏或设置中选择学习语言与母语（中文 / RU / EN）——界面与释义会随之切换。',
  'catalog.searchPlaceholder': '按标题、正文、标签、作者搜索…',
  'catalog.searchAria': '搜索小说',
  'catalog.allTags': '全部标签',
  'catalog.opening': '打开中…',
  'catalog.adding': '添加中…',
  'catalog.addToLibrary': '加入我的图书馆',
  'catalog.addAndRead': '添加并阅读',
  'catalog.openInReader': '在阅读器中打开',
  'catalog.readOnly': '只读',
  'catalog.title': '小说 · 公共馆',
  'catalog.subtitle':
    '带词汇解析的小说——加入你的图书馆，按自己的进度阅读。',
  'catalog.searching': '搜索中…',
  'catalog.myLibrary': '→ 我的图书馆',
  'catalog.publicCollections': '公开合集',
  'catalog.readyTexts': '精选小说',
  'catalog.loadingCollections': '正在加载合集…',
  'catalog.loadCollectionsFail': '无法加载公开合集',
  'catalog.noPublicCollections': '暂无已发布的合集',
  'catalog.noPublicCollectionsQuery': '（当前搜索）',
  'catalog.noStories': '没有符合筛选条件的小说。',
  'catalog.inLibrary': '已在图书馆',
  'catalog.genre': '类型',
  'catalog.bookCardAria': '小说卡片',
  'catalog.youAreAuthor': '你是作者（请在「我的图书馆」中编辑）',
  'catalog.badgePublic': '公开',
  'catalog.badgeOwner': '我的',
  'catalog.textsCount': '{n} 篇',
  'catalog.textsCountOne': '{n} 篇',
  'catalog.allLevels': '全部等级',
  'catalog.levelBeginner': '初级 / HSK 1–2',
  'catalog.levelIntermediate': '中级 / HSK 3–4',
  'catalog.levelAdvanced': '高级 / HSK 5–6',
  'catalog.allGenres': '全部类型',
  'catalog.cat.fantasy': '奇幻',
  'catalog.cat.romance': '恋爱',
  'catalog.cat.adventure': '冒险',
  'catalog.cat.slice-of-life': '日常',
  'catalog.cat.school': '校园',
  'catalog.cat.original': '原创',
  'catalog.cat.harry-potter': '哈利·波特',
  'catalog.tag.hsk2': 'HSK 2级',
  'catalog.tag.hsk3': 'HSK 3级',
  'catalog.tag.cefr-a2': 'CEFR A2',
  'catalog.tag.cefr-b1': 'CEFR B1',
  'catalog.tag.school': '校园',
  'catalog.tag.daily': '日常',
  'catalog.tag.cafe': '咖啡馆',
  'catalog.tag.dialogue': '对话',
  'catalog.tag.romance': '恋爱',
  'catalog.tag.travel': '旅行',
  'catalog.tag.narrative': '叙事',
  'catalog.lang.zh': '中文',
  'catalog.lang.ru': '俄语',
  'catalog.lang.en': '英语',
  'catalog.hskLevel': 'HSK {n}级',
  'catalog.cefrLevel': 'CEFR · lvl {n}',
  'public.notFound': '未找到合集或为私密',
  'public.loadFail': '无法加载文本',
  'public.title': '公开合集',
  'public.loading': '加载中…',
  'public.goHome': '返回主页',
  'public.editHint': '仅合集作者可以编辑或删除。',
  'public.texts': '文本',
  'public.emptyBooks': '合集中还没有文本。',
  'progress.easy': '基础',
  'progress.medium': '中等',
  'progress.hard': '较难',
  'progress.activityHint': '活跃度：越亮表示当天读词越多',
  'stories.pageTitle': '您喜爱的小说',
  'stories.tab.new': '新作',
  'stories.tab.reading': '在读',
  'stories.tab.completed': '已读完',
  'stories.chaptersCount': '{n} 章',
  'stories.statusLabel': '状态：',
  'stories.status.complete': '已完结',
  'stories.status.incomplete': '连载中',
  'action.cancel': '取消',
  'action.create': '创建',
  'action.on': '开',
  'action.off': '关',
  'alert.category': '分类',
  'alert.publish': '发布',
  'alert.publishLoginRequired': '请登录账号，以便将合集设为公开并获取链接。',
  'alert.published': '已发布',
  'alert.linkCopied': '链接已复制：\n{url}',
  'alert.linkTitle': '链接',
  'alert.linkAfterPublish': '请先将合集保存为公开——发布后会出现链接。',
  'alert.cannotDeleteSystem': '系统分类无法删除。',
  'alert.deleteCategory': '删除分类？',
  'alert.deleteCategoryBody': '「{title}」将被删除。书籍仍保留在图书馆中，但不属于任何分类。',
  'alert.editCollectionOwnerOnly': '只有所有者可以修改此合集。',
  'alert.editCollectionOnly': '只有作者可以编辑此合集。',
    'alert.editFanficOnly': '只有作者可以编辑小说。',
'alert.deleteFanficNamed': '删除「{title}」？此操作无法撤销。',
  'progress.title': '进度',
  'progress.continueReading': '继续阅读',
  'progress.readingLine': '{pct}% · 第 {current}/{total} 段',
  'progress.streak': '连续',
  'progress.streakDays': '天',
  'progress.wordsLearned': '已学单词',
  'progress.today': '今天',
  'progress.wordsReadToday': '已读词数',
  'progress.cardsReviewedToday': '已复习卡片',
  'progress.minutesInApp': '使用分钟',
  'progress.activity': '活跃度',
  'progress.activityDay': '{date}：{n} 词',
  'progress.less': '少',
  'progress.more': '多',
  'progress.reading': '阅读',
  'progress.readingWords': '{pct}% · {n} 词',
  'progress.enCoverage': 'EN 覆盖',
  'progress.hskLevels': 'HSK 等级',
  'progress.coverageStats': '{label} · {unique} 个不重复 · 卡片中 {known}%',
  'progress.uniqueShort': '{n} 个不重复',
  'progress.inFlashcards': '卡片中 {n}%',
  'progress.coverage': '覆盖度',
  'progress.coverageHint': '打开一本书后，这里会显示 HSK / EN 文本分析。',
  'reader.autoScrollLabel': '自动滚动',
  'reader.clickWordHintNative': '点击单词即可打开母语释义卡片。',
  'reader.readProgressLine': '已读 {pct}% · 第 {current}/{total} 段',
  'reader.autoScrollBadge': ' · 自动滚动',
  'reader.practiceModeHint': '译文已隐藏 · 阅读练习 · 点击段落可偷看',
  'reader.peekTranslation': '偷看译文',
  'reader.grammarCount': '语法 / 结构 · {n}',
  'mini.nowPlaying': '正在播放',
  'mini.paused': '已暂停',
  'mini.seek': '进度',
  'mini.seekOwnTracks': '进度条仅适用于你自己的曲目',
  'mini.loadingShort': '加载中…',
  'mini.volume': '音量',
  'mini.title': '我的音乐',
  'mini.localHint': '文件保存在本机（最大 {n} MB）。不使用 Firebase Storage。',
  'mini.empty': '暂无内容 — 请上传音频文件。',
  'mini.localDevice': '{title} · 保存在本机',
  'mini.delete': '删除',
  'mini.upload': '+ 上传文件（最大 {n} MB）',
  'mini.uploadTimeout': '上传超时。文件可能已保存在本地 — 请刷新列表或选择更小的文件。',
  'settings.addBookHint': 'HSK · MyMemory · cloud',
  'library.newCategory': '新建分类',
  'library.newCategoryPlaceholder': '例如：收藏',
  'library.editBook': '编辑书籍',
  'library.originalTitle': '原标题',
  'library.translatedTitle': '译名',
  'library.optionalPlaceholder': '可选',
  'library.categoryLabel': '分类',
  'library.languageHint': '语言：{lang}（添加新文本时可更改）',
  'library.linkAfterSave': '保存后将显示链接。',
  'library.noCollection': '未分类',
  'library.publicShort': ' · 公开',
  'home.tagline': 'Y2K WebCore · 通过小说学语言',
  'home.importTitle': '导入',
  'folder.retroTitle': '复古图书馆 · Finder folders',
  'folder.all': '全部',
  'folder.emptyTitle': '这里还是空的',
  'folder.emptyHint': '请在「我的图书馆」中创建第一个合集',
  'folder.dropActive': '松开文件',
  'folder.dropIdle': '拖放区',
  'folder.dropHint': '拖入 .txt / .md / .pdf',
  'folder.needFile': '需要 .txt、.md 或 .pdf 文件',
  'folder.readFail': '无法读取文件',
  'action.open': '打开',
  'action.edit': '编辑',
  'action.delete': '删除',
  'library.loading': '加载中…',
  'flashcards.brand': '🌸 SRS · 间隔复习',
  'flashcards.title.hub': '卡片',
  'flashcards.title.session': '练习',
  'flashcards.title.done': '完成',
  'flashcards.back': '返回',
  'flashcards.backToDeck': '返回卡组',
  'flashcards.dueTotal': '待复习：{due} · 总计：{total}',
  'flashcards.stat.new': '新卡',
  'flashcards.stat.learning': '学习中',
  'flashcards.stat.learned': '已掌握',
  'flashcards.langLabel': '语言',
  'flashcards.langAll': '全部',
  'flashcards.sourceLabel': '书籍 / 小说',
  'flashcards.allBooks': '全部书籍',
  'flashcards.startSession': '开始练习 · {n} 张卡片',
  'flashcards.nothingToReview': '暂无待复习',
  'flashcards.emptyHint.en':
    '请从阅读器添加英语单词（点击 →「加入卡片」）。',
  'flashcards.emptyHint.zh': '请从阅读器添加单词 — 卡组目前为空。',
  'flashcards.emptyHint.other': '请从阅读器添加单词，或更换筛选条件。',
  'flashcards.sessionHint':
    '先复习「学习中」的卡片，再学新卡。作答后间隔会更新（SM-2）。',
  'flashcards.sessionDone': '练习完成',
  'flashcards.reviewedSummary':
    '已复习：{done}\n重来 {again} · 较难 {hard} · 良好 {good} · 简单 {easy}',
  'flashcards.anotherSession': '再来一轮',
  'flashcards.progress': '{i} / {total}',
  'flashcards.progressWithAnswers': ' · 已答 {n}',
  'flashcards.fromFanfic': '来自小说',
  'flashcards.noContextYet': '新卡片的例句会在阅读器中添加后出现',
  'flashcards.noTranslation': '暂无翻译',
  'flashcards.tapToReveal': '点击查看答案',
  'flashcards.showAnswer': '显示答案',
  'flashcards.grade.again': '重来',
  'flashcards.grade.hard': '较难',
  'flashcards.grade.good': '良好',
  'flashcards.grade.easy': '简单',
  'flashcards.grade.againHint': '1天',
  'flashcards.grade.hardHint': '更难',
  'flashcards.grade.goodHint': '还行',
  'flashcards.grade.easyHint': '轻松',
  'flashcards.delete': '删除卡片',
  'flashcards.deleteConfirm': '删除这张卡片？',
  'flashcards.deleteConfirmBody': '「{word}」将不再出现在复习中。',
  'flashcards.browse': '卡组',
  'flashcards.browseTitle': '全部卡片',
  'flashcards.searchPlaceholder': '搜索单词或翻译…',
  'flashcards.exportCsv': '导出 CSV',
  'flashcards.exportAnki': '导出 Anki (TSV)',
  'flashcards.shareDeck': '分享卡组',
  'flashcards.shareImport': '加入我的卡组',
  'flashcards.shareNotFound': '卡组不存在或不可用。',
  'flashcards.shareFail': '无法分享卡组。',
  'flashcards.shareCopied': '链接已复制',
  'flashcards.shareImported': '卡组已导入',
  'flashcards.shareImportedBody': '已添加：{added}。跳过：{skipped}。',
  'flashcards.shareMeta': '{n} 张卡片 · {lang}',
  'flashcards.shareLoginRequired': '请登录后再分享卡组。',
  'flashcards.modeLabel': '模式',
  'flashcards.mode.recognition': '认词',
  'flashcards.mode.recall': '回忆',
  'flashcards.mode.cloze': '完形',
  'flashcards.mode.listen': '听力',
  'flashcards.emptyBrowse': '当前筛选下暂无卡片。',
  'flashcards.speakCard': '朗读',
  'flashcards.addGrammar': '+ 加入卡片',
  'flashcards.grammarAdded': '语法已在卡组',
  'progress.dailyGoal': '今日目标',
  'progress.wordsGoal': '阅读 {n}/{goal}',
  'progress.cardsGoal': '卡片 {n}/{goal}',
  'progress.goalMet': '今日目标已完成！',
  'progress.dueCards': '待复习：{n}',
  'progress.continueWithDue': '继续 · 待复习 {n}',
  'word.removeFromDeck': '移出卡组',
  'word.knownRemoved': '已掌握 — 已移出 SRS',
  'flashcards.queueLabel': "队列",
  'flashcards.queue.default': "默认",
  'flashcards.queue.weak': "薄弱",
  'flashcards.queue.mixed': "混合",
  'flashcards.keyboardHint': "空格翻面 · 1–4 评分",
  'flashcards.demoDeck': "演示卡组",
  'flashcards.demoDeckDone': "已添加演示卡片：{n}",
  'flashcards.importAnki': "导入 Anki",
  'flashcards.importAnkiDone': "已导入：{added}。跳过：{skipped}。",
  'progress.dueBannerTitle': "今日待复习：{n}",
  'progress.dueBannerHint': "短时复习可保持连续天数",
  'progress.dueBannerCta': "去卡片",
  'progress.weekTitle': "本周",
  'progress.weekStats': "{words} 词 · {cards} 卡 · {min} 分钟",
  'catalog.publicDecks': "公开卡组",
  'catalog.noPublicDecks': "暂无公开卡组",
  'catalog.deckCardsCount': "{n} 张卡片",
  'addBook.screenSubtitle.en':
    '语言：English。粘贴英语，或从母语翻译 — 单词可点击，平行译文会随书籍保存。',
  'addBook.screenSubtitle.zh':
    '语言：中文。粘贴中文，或从母语翻译 — HSK 3.0 会高亮难词与拼音。',
  'addBook.screenSubtitle.ru':
    '语言：俄语。粘贴俄语学习文本 — 可用下方按钮生成母语平行译文。',
  'addBook.sourceLang': '原文语言',
  'addBook.fanficTitle': '小说标题',
  'addBook.titlePlaceholder': '例如：哈利·波特与密室',
  'addBook.fanficText': '小说正文',
  'addBook.uploadTxt': '上传 .txt',
  'addBook.placeholder.en':
    '粘贴母语文本（用于翻译）或英语文本…',
  'addBook.placeholder.zh':
    '粘贴母语文本或中文文本…',
  'addBook.placeholder.ru':
    '粘贴俄语学习文本，或母语文本以便翻译…',
  'addBook.translateFromTo': '从 {from} 翻译 → {to}',
  'addBook.hskLevel': '目标 HSK 等级',
  'addBook.collection': '合集',
  'addBook.createCollection': '+ 新建合集',
  'addBook.analyzeEn': '分析英语文本',
  'addBook.saveLangText': '保存{lang}文本',
  'addBook.analyzeText': '分析文本',
  'addBook.saveAndRead': '保存并开始阅读',
  'addBook.enPreviewTitle': '英语解析 · {n} 个词',
  'addBook.enPreviewMeta':
    '词元：{n}。不使用拼音。language: en。',
  'addBook.parallelLabel': '平行文本（{lang}）',
  'addBook.parallelEmpty':
    '平行文本暂为空 — 保存时会再试一次翻译。',
  'addBook.parallelError': '翻译：{error}',
  'addBook.moreItems': '…还有 {n} 项',
  'addBook.grammarTitle': '语法 / 句式 · {n}',
  'addBook.defaultTitle': '新小说',
  'addBook.newCollection': '新建合集',
  'addBook.collectionNamePlaceholder': '合集名称',
  'addBook.color': '颜色',
  'addBook.create': '创建',
  'addBook.a11y.back': '返回',
  'addBook.a11y.theme': '切换主题',
  'addBook.a11y.translate': '从母语翻译',
  'addBook.a11y.analyze': '分析文本',
  'addBook.alert.attention': '注意',
  'addBook.alert.error': '错误',
  'addBook.alert.translateError': '翻译错误',
  'addBook.alert.analyzeError': '分析错误',
  'addBook.alert.saveError': '保存错误',
  'addBook.alert.enterCollection': '请输入合集名称。',
  'addBook.alert.pasteForTranslate':
    '请粘贴{lang}文本以便翻译。',
  'addBook.alert.notLikely':
    '文本不像{lang}。请粘贴母语原文，或更换内容语言。',
  'addBook.alert.enterTitle': '请输入小说标题。',
  'addBook.alert.enterText': '请粘贴小说正文。',
  'addBook.alert.parallelTitle': '平行翻译',
  'addBook.alert.parallelBody':
    '翻译接口超时。分词已完成 — 可先无译文保存，或稍后重试。',
  'addBook.alert.translateUnavailableTitle': '无法翻译',
  'addBook.alert.translateUnavailableSave':
    '将保存为无平行译文。可稍后再译。',
  'addBook.alert.translateUnavailableRetry':
    '未能获得平行译文。书籍将不含译文保存。',
  'addBook.alert.unsupportedPair':
    '暂不支持翻译方向 {from} → {to}。',
  'addBook.loading.translatePrep': '翻译中：准备…',
  'addBook.loading.analyzeEn': '正在分词英语…',
  'addBook.loading.analyzeHsk': '正在按 HSK 词典分析…',
  'addBook.loading.prepareContent': '正在准备文本…',
  'addBook.loading.translateParallel': '正在翻译平行文本…',
  'addBook.unknownError': '未知错误',
  'reader.peekHint': '点击查看翻译',
  'reader.showParagraphTranslation': '显示段落翻译',
  'reader.hideParagraphTranslation': '隐藏段落翻译',
  'reader.peekedSuffix': ' · 已查看',
  'reader.hiddenSuffix': ' · 已隐藏',
  'reader.ttsWord': '朗读 {word}',
  'reader.ttsParagraph': '朗读段落',
  'reader.grammarBadge': '语法',
  'reader.grammarToggle': '语法 ({n})',
  'reader.targetHskNotebook': '目标 HSK {n} · notebook mode',
  'reader.sourceParallel': '来源：原始平行译文',
  'reader.showNativeTranslation': '显示 / 隐藏译文',
  'reader.parsing': '正在解析文本与语法…',
  'reader.translatingParagraphs': '正在翻译段落…',
  'reader.translateTextFail': '无法翻译文本',
  'word.addToDict': '加入生词本',
  'word.markKnown': '已认识',
  'word.inDict': '已在生词本',
  'word.markedKnown': '已标为认识',
  'auth.enterEmail': '请输入邮箱。',
  'auth.enterPassword': '请输入密码。',
  'auth.passwordTooShort': '密码至少需要 6 个字符。',
  'auth.redirectingGoogle': '正在跳转到 Google…',
  'auth.signOutTimeout': '退出超时',
  'auth.syncTimeout': '同步超时',
  'auth.signIn': '登录',
  'auth.signUp': '注册',
  'auth.signInSubtitle': '登录已有账户。',
  'auth.signUpSubtitle': '创建新账户以同步数据。',
  'auth.passwordPlaceholder': '密码（至少 6 个字符）',
  'auth.noAccount': '还没有账户？去注册',
  'auth.hasAccount': '已有账户？去登录',
  'auth.continueGuest': '暂不登录，继续使用',
  'auth.syncDevicesHint': '你的小说与卡片会在各设备间同步。',
  'auth.signOut': '退出登录',
  'auth.syncNow': '立即同步',
  'auth.submitSignIn': '登录',
  'auth.submitSignUp': '注册',
  'auth.googleSignIn': '🔵 使用 Google 登录',
  'auth.syncError': '同步错误',
};

const TABLES: Record<NativeLanguage, Dictionary> = { ru, en, zh };

export function translateUi(
  key: UiMessageKey,
  lang: NativeLanguage,
  vars?: Record<string, string | number>
): string {
  let text = TABLES[lang]?.[key] ?? TABLES.ru[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function getUiDictionary(lang: NativeLanguage): Dictionary {
  return TABLES[lang] ?? TABLES.ru;
}
