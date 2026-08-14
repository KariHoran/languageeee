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
