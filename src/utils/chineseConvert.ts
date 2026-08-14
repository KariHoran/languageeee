import { Converter } from 'opencc-js/t2cn';

/** Максимальная длина фразы при жадном разборе HSK */
export const MAX_HSK_WORD_LENGTH = 4;

/** Конвертер традиционного китайского → упрощённый (t → cn) */
let toSimplifiedConverter: ((text: string) => string) | null = null;

/** Запасная замена частых иероглифов, если OpenCC недоступен (например, в RN) */
const FALLBACK_CHAR_MAP: Record<string, string> = {
  沒: '没',
  點: '点',
  頭: '头',
  錯: '错',
  說: '说',
  話: '话',
  這: '这',
  個: '个',
  們: '们',
  來: '来',
  時: '时',
  會: '会',
  對: '对',
  開: '开',
  關: '关',
  長: '长',
  見: '见',
  現: '现',
  發: '发',
  經: '经',
  學: '学',
  國: '国',
  無: '无',
  電: '电',
  車: '车',
  東: '东',
  馬: '马',
  鳥: '鸟',
  愛: '爱',
  讓: '让',
  認: '认',
  為: '为',
  與: '与',
  從: '从',
  兩: '两',
  還: '还',
  進: '进',
  過: '过',
  問: '问',
  聽: '听',
  讀: '读',
  寫: '写',
  語: '语',
  詞: '词',
  聲: '声',
  體: '体',
  歡: '欢',
  樂: '乐',
  難: '难',
  應: '应',
  該: '该',
  變: '变',
  給: '给',
  覺: '觉',
  記: '记',
  許: '许',
  論: '论',
  誰: '谁',
  請: '请',
  謝: '谢',
  買: '买',
  賣: '卖',
  錢: '钱',
  飯: '饭',
  飲: '饮',
  藥: '药',
  醫: '医',
  歲: '岁',
  號: '号',
  雖: '虽',
  樣: '样',
  種: '种',
  實: '实',
  際: '际',
  結: '结',
  絕: '绝',
  緣: '缘',
  網: '网',
  線: '线',
  總: '总',
  縣: '县',
  親: '亲',
  觀: '观',
  視: '视',
  訊: '讯',
  識: '识',
  證: '证',
  譯: '译',
  護: '护',
  負: '负',
  責: '责',
  貴: '贵',
  費: '费',
  賀: '贺',
  資: '资',
  質: '质',
  輕: '轻',
  較: '较',
  輛: '辆',
  辦: '办',
  農: '农',
  運: '运',
  遠: '远',
  選: '选',
  邊: '边',
  達: '达',
  連: '连',
  適: '适',
  遺: '遗',
  雞: '鸡',
  離: '离',
  雲: '云',
  靈: '灵',
  顏: '颜',
  類: '类',
  願: '愿',
  風: '风',
  飛: '飞',
  養: '养',
  鬥: '斗',
  魚: '鱼',
  黃: '黄',
  黨: '党',
  齊: '齐',
  龍: '龙',
  龜: '龟',
};

function applyFallbackMap(text: string): string {
  return [...text].map((ch) => FALLBACK_CHAR_MAP[ch] ?? ch).join('');
}

function getConverter(): (text: string) => string {
  if (!toSimplifiedConverter) {
    toSimplifiedConverter = Converter({ from: 't', to: 'cn' });
  }
  return toSimplifiedConverter;
}

/**
 * Преобразует традиционные иероглифы в упрощённые (Simplified Chinese).
 * Безопасно вызывать для уже упрощённого текста — он не изменится.
 */
export function toSimplified(text: string): string {
  if (!text) return text;

  try {
    const converted = getConverter()(text);
    if (converted && converted !== text) return converted;
    if (converted) return converted;
  } catch {
    // OpenCC может быть недоступен в некоторых средах — используем запасную карту
  }

  return applyFallbackMap(text);
}

/** Проверяет, есть ли в тексте китайские иероглифы */
export function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

/** Проверяет, остались ли в тексте типичные традиционные иероглифы после конвертации */
export function hasUnconvertedTraditional(text: string): boolean {
  return /[沒點頭錯說話這個們來時會對開關長見現發經學國無電車東馬鳥愛讓認為與從兩還進過問聽讀寫語詞聲體歡樂難應該變給覺記許論誰請謝買賣錢飯飲藥醫歲號雖樣種實際結絕緣網線總縣親觀視訊識證譯護負責貴費賀資質輕較輛辦農運遠選邊達連適遺雞離雲靈顏類願風飛養鬥魚黃黨齊龍龜]/.test(
    text
  );
}
