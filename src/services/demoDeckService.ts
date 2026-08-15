/**
 * Демо-колода для онбординга SRS без своей библиотеки.
 */
import type { LearningLanguage } from '../types';
import { addFlashcard, getFlashcardsCount } from './flashcardsStore';

const DEMO_ZH: Array<{
  hanzi: string;
  pinyin: string;
  translation: string;
  contextSentence: string;
}> = [
  {
    hanzi: '你好',
    pinyin: 'nǐ hǎo',
    translation: 'hello',
    contextSentence: '你好，我是小林。',
  },
  {
    hanzi: '喜欢',
    pinyin: 'xǐ huān',
    translation: 'to like',
    contextSentence: '我喜欢看小说。',
  },
  {
    hanzi: '学习',
    pinyin: 'xué xí',
    translation: 'to study',
    contextSentence: '他每天学习中文。',
  },
  {
    hanzi: '朋友',
    pinyin: 'péng you',
    translation: 'friend',
    contextSentence: '她是我的好朋友。',
  },
  {
    hanzi: '时间',
    pinyin: 'shí jiān',
    translation: 'time',
    contextSentence: '现在没有时间。',
  },
  {
    hanzi: '因为',
    pinyin: 'yīn wèi',
    translation: 'because',
    contextSentence: '因为下雨，我待在家里。',
  },
  {
    hanzi: '可以',
    pinyin: 'kě yǐ',
    translation: 'can / may',
    contextSentence: '你现在可以进来。',
  },
  {
    hanzi: '故事',
    pinyin: 'gù shi',
    translation: 'story',
    contextSentence: '这是一个有趣的故事。',
  },
];

const DEMO_EN: Array<{
  hanzi: string;
  translation: string;
  contextSentence: string;
}> = [
  {
    hanzi: 'whisper',
    translation: 'шептать',
    contextSentence: 'She whispered the secret.',
  },
  {
    hanzi: 'dawn',
    translation: 'рассвет',
    contextSentence: 'They left at dawn.',
  },
  {
    hanzi: 'brave',
    translation: 'храбрый',
    contextSentence: 'Be brave and try again.',
  },
  {
    hanzi: 'journey',
    translation: 'путешествие',
    contextSentence: 'The journey was long.',
  },
  {
    hanzi: 'promise',
    translation: 'обещание',
    contextSentence: 'Keep your promise.',
  },
  {
    hanzi: 'shadow',
    translation: 'тень',
    contextSentence: 'A shadow moved nearby.',
  },
];

/** Добавить демо-карточки, если колода почти пуста. */
export async function seedDemoDeck(
  language: LearningLanguage | 'all' = 'zh'
): Promise<{ added: number }> {
  const lang: LearningLanguage = language === 'en' ? 'en' : 'zh';
  const stats = await getFlashcardsCount(lang);
  if (stats.total >= 8) return { added: 0 };

  let added = 0;
  if (lang === 'en') {
    for (const row of DEMO_EN) {
      try {
        await addFlashcard({
          ...row,
          language: 'en',
          sourceTitle: 'Demo deck',
        });
        added += 1;
      } catch {
        /* skip */
      }
    }
  } else {
    for (const row of DEMO_ZH) {
      try {
        await addFlashcard({
          ...row,
          language: 'zh',
          sourceTitle: 'Demo deck',
        });
        added += 1;
      } catch {
        /* skip */
      }
    }
  }
  return { added };
}
