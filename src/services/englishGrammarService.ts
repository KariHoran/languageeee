import type { GrammarPoint } from '../types';

/**
 * Локальный разбор английской морфологии и конструкций (без сетевого ИИ).
 * Даёт лемму, часть речи и короткие пояснения на русском.
 */

export type EnglishPosRu =
  | 'существительное'
  | 'глагол'
  | 'прилагательное'
  | 'наречие'
  | 'местоимение'
  | 'предлог'
  | 'союз'
  | 'артикль'
  | 'определитель'
  | 'имя собственное'
  | 'частица'
  | 'слово';

export interface EnglishWordGrammar {
  surface: string;
  lemma: string;
  partOfSpeech: EnglishPosRu;
  /** Краткая метка конструкции / формы */
  structure: string;
  explanation: string;
  example?: string;
  /** Доп. конструкции вокруг слова в контексте */
  constructions: GrammarPoint[];
}

export interface EnglishGrammarMatch {
  start: number;
  end: number;
  point: GrammarPoint;
  patternId: string;
}

interface PhrasalEntry {
  particles: string[];
  structure: string;
  explanation: string;
  example: string;
}

/** Неправильные глаголы: past / past participle → lemma */
const IRREGULAR: Record<string, string> = {
  was: 'be',
  were: 'be',
  been: 'be',
  am: 'be',
  is: 'be',
  are: 'be',
  "i'm": 'be',
  went: 'go',
  gone: 'go',
  did: 'do',
  done: 'do',
  does: 'do',
  had: 'have',
  has: 'have',
  have: 'have',
  said: 'say',
  made: 'make',
  took: 'take',
  taken: 'take',
  came: 'come',
  saw: 'see',
  seen: 'see',
  knew: 'know',
  known: 'know',
  got: 'get',
  gotten: 'get',
  gave: 'give',
  given: 'give',
  found: 'find',
  thought: 'think',
  told: 'tell',
  became: 'become',
  left: 'leave',
  felt: 'feel',
  kept: 'keep',
  began: 'begin',
  begun: 'begin',
  ran: 'run',
  sat: 'sit',
  stood: 'stand',
  ate: 'eat',
  eaten: 'eat',
  wrote: 'write',
  written: 'write',
  spoke: 'speak',
  spoken: 'speak',
  heard: 'hear',
  brought: 'bring',
  bought: 'buy',
  caught: 'catch',
  taught: 'teach',
  fought: 'fight',
  slept: 'sleep',
  woke: 'wake',
  woken: 'wake',
  wore: 'wear',
  worn: 'wear',
  won: 'win',
  lost: 'lose',
  met: 'meet',
  paid: 'pay',
  put: 'put',
  read: 'read',
  set: 'set',
  shut: 'shut',
  hit: 'hit',
  cut: 'cut',
  let: 'let',
  hurt: 'hurt',
  cost: 'cost',
};

const DETERMINERS = new Set([
  'a',
  'an',
  'the',
  'this',
  'that',
  'these',
  'those',
  'my',
  'your',
  'his',
  'her',
  'its',
  'our',
  'their',
  'some',
  'any',
  'no',
  'every',
  'each',
]);

const PRONOUNS = new Set([
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'myself',
  'yourself',
  'himself',
  'herself',
  'itself',
  'ourselves',
  'themselves',
  'who',
  'whom',
  'whose',
  'which',
  'what',
]);

const PREPOSITIONS = new Set([
  'in',
  'on',
  'at',
  'to',
  'for',
  'from',
  'with',
  'without',
  'about',
  'into',
  'onto',
  'over',
  'under',
  'between',
  'among',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'by',
  'of',
  'off',
  'up',
  'down',
  'out',
  'around',
  'across',
  'against',
  'along',
  'beside',
  'near',
  'since',
  'until',
  'till',
  'within',
  'as',
]);

const CONJUNCTIONS = new Set([
  'and',
  'but',
  'or',
  'so',
  'because',
  'although',
  'though',
  'if',
  'when',
  'while',
  'whereas',
  'unless',
  'until',
  'before',
  'after',
  'since',
  'that',
  'whether',
  'nor',
  'yet',
]);

const ADVERBS = new Set([
  'very',
  'really',
  'quite',
  'just',
  'also',
  'too',
  'already',
  'still',
  'even',
  'always',
  'never',
  'often',
  'sometimes',
  'usually',
  'here',
  'there',
  'now',
  'then',
  'soon',
  'well',
  'badly',
  'together',
  'alone',
  'away',
  'back',
  'again',
]);

const AUX = new Set([
  'be',
  'am',
  'is',
  'are',
  'was',
  'were',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'shall',
  'should',
  'can',
  'could',
  'may',
  'might',
  'must',
]);

/** Фразовые глаголы: lemma → частицы */
const PHRASALS: Record<string, PhrasalEntry[]> = {
  look: [
    {
      particles: ['for'],
      structure: 'look for',
      explanation:
        'Фразовый глагол look for = «искать». Не путать с look at («смотреть на»).',
      example: 'He looked for Ron. — Он искал Рона.',
    },
    {
      particles: ['at'],
      structure: 'look at',
      explanation: 'Фразовый глагол look at = «смотреть на».',
      example: 'Look at the board.',
    },
    {
      particles: ['up'],
      structure: 'look up',
      explanation: 'look up = «искать (в словаре)» или «поднять взгляд».',
      example: 'Look up the word.',
    },
  ],
  walk: [
    {
      particles: ['into'],
      structure: 'walk into',
      explanation: 'walk into = «войти в» (движение внутрь пространства).',
      example: 'Harry walked into the Great Hall.',
    },
  ],
  sit: [
    {
      particles: ['at'],
      structure: 'sit at',
      explanation: 'sit at = «сидеть за (столом / партой)».',
      example: 'Ron was sitting at the table.',
    },
    {
      particles: ['down'],
      structure: 'sit down',
      explanation: 'sit down = «сесть».',
      example: 'Please sit down.',
    },
  ],
  get: [
    {
      particles: ['up'],
      structure: 'get up',
      explanation: 'get up = «вставать (с постели)».',
      example: 'I get up at seven.',
    },
    {
      particles: ['on'],
      structure: 'get on',
      explanation: 'get on = «садиться (на автобус)» или «ладить».',
      example: 'Get on the bus.',
    },
  ],
  put: [
    {
      particles: ['on'],
      structure: 'put on',
      explanation: 'put on = «надеть».',
      example: 'Put on your coat.',
    },
    {
      particles: ['off'],
      structure: 'put off',
      explanation: 'put off = «откладывать».',
      example: 'Don\'t put it off.',
    },
  ],
  take: [
    {
      particles: ['off'],
      structure: 'take off',
      explanation: 'take off = «снять (одежду)» или «взлететь».',
      example: 'Take off your shoes.',
    },
    {
      particles: ['out'],
      structure: 'take out',
      explanation: 'take out = «вынуть / вывести».',
      example: 'Take out a pen.',
    },
  ],
  give: [
    {
      particles: ['up'],
      structure: 'give up',
      explanation: 'give up = «сдаться, бросить».',
      example: 'Don\'t give up.',
    },
  ],
  find: [
    {
      particles: ['out'],
      structure: 'find out',
      explanation: 'find out = «узнать, выяснить».',
      example: 'I found out the truth.',
    },
  ],
  turn: [
    {
      particles: ['on'],
      structure: 'turn on',
      explanation: 'turn on = «включить».',
      example: 'Turn on the light.',
    },
    {
      particles: ['off'],
      structure: 'turn off',
      explanation: 'turn off = «выключить».',
      example: 'Turn off the TV.',
    },
  ],
  come: [
    {
      particles: ['from'],
      structure: 'come from',
      explanation: 'come from = «быть родом из / происходить из».',
      example: 'She comes from London.',
    },
  ],
  pick: [
    {
      particles: ['up'],
      structure: 'pick up',
      explanation: 'pick up = «поднять» или «забрать (кого-то)».',
      example: 'Pick up the book.',
    },
  ],
};

const CONSTRUCTION_PATTERNS: Array<{
  id: string;
  re: RegExp;
  structure: string;
  explanation: string;
  example: string;
}> = [
  {
    id: 'past-continuous',
    re: /\b(was|were)\s+(\w+ing)\b/gi,
    structure: 'Past Continuous (was/were + V-ing)',
    explanation:
      'Past Continuous: действие в процессе в прошлом. was/were + глагол с -ing.',
    example: 'He was sitting at the table. — Он сидел за столом.',
  },
  {
    id: 'present-continuous',
    re: /\b(am|is|are)\s+(\w+ing)\b/gi,
    structure: 'Present Continuous (am/is/are + V-ing)',
    explanation:
      'Present Continuous: действие происходит сейчас. am/is/are + V-ing.',
    example: 'She is reading. — Она читает (сейчас).',
  },
  {
    id: 'present-perfect',
    re: /\b(have|has)\s+(\w+ed|\w+en|been|gone|done|seen|taken)\b/gi,
    structure: 'Present Perfect (have/has + V3)',
    explanation:
      'Present Perfect: результат к настоящему моменту. have/has + третья форма.',
    example: 'I have eaten. — Я уже поел.',
  },
  {
    id: 'past-perfect',
    re: /\bhad\s+(\w+ed|\w+en|been|gone|done|seen)\b/gi,
    structure: 'Past Perfect (had + V3)',
    explanation:
      'Past Perfect: действие раньше другого в прошлом. had + третья форма.',
    example: 'He had left before I arrived.',
  },
  {
    id: 'going-to',
    re: /\b(am|is|are|was|were)\s+going\s+to\s+(\w+)\b/gi,
    structure: 'be going to + V',
    explanation: 'be going to + инфинитив — намерение или прогноз.',
    example: 'I am going to study. — Я собираюсь учиться.',
  },
  {
    id: 'will-future',
    re: /\bwill\s+(\w+)\b/gi,
    structure: 'Future Simple (will + V)',
    explanation: 'will + первая форма — будущее время / обещание.',
    example: 'I will help you.',
  },
  {
    id: 'there-is',
    re: /\bthere\s+(is|are|was|were)\b/gi,
    structure: 'there is / there are',
    explanation:
      'Конструкция there is/are = «есть / находится». Подлежащее идёт после глагола.',
    example: 'There is a book on the table.',
  },
  {
    id: 'used-to',
    re: /\bused\s+to\s+(\w+)\b/gi,
    structure: 'used to + V',
    explanation: 'used to + V — привычка или состояние в прошлом, которого больше нет.',
    example: 'I used to play football.',
  },
  {
    id: 'with-together',
    re: /\bwith\s+\w+(?:\s+\w+)?\b/gi,
    structure: 'with + person',
    explanation: 'with + человек/объект = «с (кем/чем)».',
    example: 'breakfast with Hermione — завтрак с Гермионой',
  },
  {
    id: 'very-adj',
    re: /\bvery\s+(\w+)\b/gi,
    structure: 'very + adjective',
    explanation: 'very усиливает прилагательное: «очень + признак».',
    example: 'very hungry — очень голодный',
  },
];

function tokenizeWithIndex(
  text: string
): Array<{ surface: string; key: string; start: number; end: number }> {
  const out: Array<{ surface: string; key: string; start: number; end: number }> =
    [];
  const re = /[A-Za-z][A-Za-z0-9'-]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      surface: m[0],
      key: m[0].toLowerCase(),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

function looksProper(surface: string): boolean {
  return /^[A-Z][a-z]+$/.test(surface) || /^[A-Z]{2,}$/.test(surface);
}

/** Простая лемматизация английского слова. */
export function lemmatizeEnglish(surface: string): string {
  const raw = surface.trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/'s$/, '');
  if (IRREGULAR[key]) return IRREGULAR[key];
  if (key.endsWith('ies') && key.length > 4) return `${key.slice(0, -3)}y`;
  if (key.endsWith('ying') && key.length > 5) return `${key.slice(0, -3)}`; // dying→dy? skip
  if (key.endsWith('ing') && key.length > 5) {
    const stem = key.slice(0, -3);
    // running → run (удвоенная согласная)
    if (
      stem.length > 2 &&
      stem[stem.length - 1] === stem[stem.length - 2] &&
      /[bdfglmnprst]$/.test(stem)
    ) {
      return stem.slice(0, -1);
    }
    if (stem.endsWith('e')) return stem;
    return stem;
  }
  if (key.endsWith('ied') && key.length > 4) return `${key.slice(0, -3)}y`;
  if (key.endsWith('ed') && key.length > 4) {
    const stem = key.slice(0, -2);
    // stopped → stop
    if (
      stem.length > 3 &&
      stem[stem.length - 1] === stem[stem.length - 2] &&
      /[bdfglmnprst]$/.test(stem)
    ) {
      return stem.slice(0, -1);
    }
    return stem;
  }
  if (key.endsWith('oes') && key.length > 4) return key.slice(0, -2); // goes → go
  if (key.endsWith('ses') || key.endsWith('xes') || key.endsWith('zes') || key.endsWith('ches') || key.endsWith('shes')) {
    return key.slice(0, -2);
  }
  if (key.endsWith('s') && !key.endsWith('ss') && key.length > 3) {
    return key.slice(0, -1);
  }
  if (key.endsWith('ly') && key.length > 4) return key.slice(0, -2);
  return key;
}

function guessPos(
  surface: string,
  key: string,
  lemma: string,
  prevKey?: string,
  nextKey?: string
): { pos: EnglishPosRu; structure: string; explanation: string } {
  if (DETERMINERS.has(key)) {
    return {
      pos: 'артикль',
      structure: key === 'a' || key === 'an' || key === 'the' ? 'Article' : 'Determiner',
      explanation:
        key === 'the'
          ? 'Определённый артикль the — объект уже известен слушателю.'
          : key === 'a' || key === 'an'
            ? 'Неопределённый артикль a/an — объект упоминается впервые.'
            : `Определитель «${surface}» уточняет существительное.`,
    };
  }
  if (PRONOUNS.has(key)) {
    return {
      pos: 'местоимение',
      structure: 'Pronoun',
      explanation: `Местоимение «${surface}» заменяет существительное.`,
    };
  }
  if (PREPOSITIONS.has(key)) {
    return {
      pos: 'предлог',
      structure: 'Preposition',
      explanation: `Предлог «${surface}» связывает слова и указывает отношение (место, направление, время).`,
    };
  }
  if (CONJUNCTIONS.has(key)) {
    return {
      pos: 'союз',
      structure: 'Conjunction',
      explanation: `Союз «${surface}» соединяет слова или части предложения.`,
    };
  }
  if (ADVERBS.has(key) || (key.endsWith('ly') && key.length > 4)) {
    return {
      pos: 'наречие',
      structure: 'Adverb',
      explanation: `Наречие «${surface}» уточняет глагол, прилагательное или другое наречие.`,
    };
  }
  if (AUX.has(key) || AUX.has(lemma)) {
    return {
      pos: 'глагол',
      structure: 'Auxiliary / linking verb',
      explanation: `Вспомогательный или глагол-связка «${surface}» (лемма: ${lemma}).`,
    };
  }
  if (looksProper(surface) && !['I'].includes(surface)) {
    return {
      pos: 'имя собственное',
      structure: 'Proper noun',
      explanation: `Имя собственное «${surface}» — имя человека, места или названия.`,
    };
  }

  // 3sg Present Simple: he/she/it + Vs
  if (
    prevKey &&
    ['he', 'she', 'it'].includes(prevKey) &&
    key.endsWith('s') &&
    !key.endsWith('ss') &&
    lemma !== key
  ) {
    return {
      pos: 'глагол',
      structure: 'Present Simple, 3-е лицо ед. ч.',
      explanation: `Форма Present Simple 3sg: к основе ${lemma} добавляется -s/-es после he/she/it.`,
    };
  }

  if (key.endsWith('ing') && key.length > 4) {
    if (prevKey && ['am', 'is', 'are', 'was', 'were', 'be'].includes(prevKey)) {
      return {
        pos: 'глагол',
        structure: 'V-ing (Continuous)',
        explanation: `Форма Continuous: ${prevKey} + ${surface}. Лемма: ${lemma}.`,
      };
    }
    return {
      pos: 'глагол',
      structure: 'V-ing (gerund / participle)',
      explanation: `Форма на -ing («${surface}»). Лемма: ${lemma}. Может быть Continuous, герундий или причастие.`,
    };
  }

  if ((key.endsWith('ed') || IRREGULAR[key]) && lemma !== key) {
    if (prevKey && ['have', 'has', 'had'].includes(prevKey)) {
      return {
        pos: 'глагол',
        structure: 'Past participle (Perfect)',
        explanation: `Причастие прошедшего времени в Perfect: ${prevKey} + ${surface}. Лемма: ${lemma}.`,
      };
    }
    return {
      pos: 'глагол',
      structure: 'Past Simple / V2',
      explanation: `Форма прошедшего времени «${surface}». Начальная форма (лемма): ${lemma}.`,
    };
  }

  if (prevKey && DETERMINERS.has(prevKey)) {
    return {
      pos: 'существительное',
      structure: 'Noun',
      explanation: `Существительное после определителя «${prevKey}». Лемма: ${lemma}.`,
    };
  }

  if (nextKey && PREPOSITIONS.has(nextKey)) {
    return {
      pos: 'глагол',
      structure: 'Verb (+ preposition?)',
      explanation: `Похоже на глагол перед предлогом «${nextKey}». Проверьте фразовый глагол. Лемма: ${lemma}.`,
    };
  }

  if (key.endsWith('ous') || key.endsWith('ful') || key.endsWith('less') || key.endsWith('ive') || key.endsWith('al')) {
    return {
      pos: 'прилагательное',
      structure: 'Adjective',
      explanation: `Прилагательное «${surface}» описывает признак.`,
    };
  }

  return {
    pos: 'слово',
    structure: 'Word form',
    explanation: `Форма «${surface}», начальная форма (лемма): ${lemma}.`,
  };
}

function findPhrasalAround(
  tokens: Array<{ surface: string; key: string; start: number; end: number }>,
  index: number
): GrammarPoint | null {
  const tok = tokens[index];
  if (!tok) return null;
  const lemma = lemmatizeEnglish(tok.surface);
  const entries = PHRASALS[lemma] ?? PHRASALS[tok.key];
  if (!entries) return null;

  for (const entry of entries) {
    let ok = true;
    for (let p = 0; p < entry.particles.length; p += 1) {
      const next = tokens[index + 1 + p];
      if (!next || next.key !== entry.particles[p]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return {
        structure: entry.structure,
        explanation: entry.explanation,
        example: entry.example,
      };
    }
  }
  return null;
}

/** Конструкции в абзаце (времена, there is, phrasals…). */
export function findEnglishGrammarMatches(text: string): EnglishGrammarMatch[] {
  const matches: EnglishGrammarMatch[] = [];
  const seen = new Set<string>();

  for (const pattern of CONSTRUCTION_PATTERNS) {
    const re = new RegExp(pattern.re.source, pattern.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const key = `${pattern.id}:${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        patternId: pattern.id,
        point: {
          structure: pattern.structure,
          explanation: pattern.explanation,
          example: pattern.example,
        },
      });
    }
  }

  const tokens = tokenizeWithIndex(text);
  for (let i = 0; i < tokens.length; i += 1) {
    const phrasal = findPhrasalAround(tokens, i);
    if (!phrasal) continue;
    const lemma = lemmatizeEnglish(tokens[i]!.surface);
    const entry = (PHRASALS[lemma] ?? []).find((e) =>
      e.particles.every((p, pi) => tokens[i + 1 + pi]?.key === p)
    );
    const particleCount = entry?.particles.length ?? 0;
    const endTok = tokens[i + particleCount] ?? tokens[i]!;
    const start = tokens[i]!.start;
    const end = endTok.end;
    const key = `phrasal:${start}:${phrasal.structure}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      start,
      end,
      patternId: `phrasal-${phrasal.structure}`,
      point: phrasal,
    });
  }

  return matches.sort((a, b) => a.start - b.start || b.end - a.end);
}

export function detectEnglishGrammarPoints(text: string): GrammarPoint[] {
  const matches = findEnglishGrammarMatches(text);
  const out: GrammarPoint[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    if (seen.has(m.point.structure)) continue;
    seen.add(m.point.structure);
    out.push(m.point);
  }
  return out;
}

/**
 * Разбор кликнутого слова в контексте предложения:
 * лемма, часть речи, фразовый глагол / время, если есть.
 */
export function analyzeEnglishWordGrammar(
  surface: string,
  context = ''
): EnglishWordGrammar {
  const trimmed = surface.trim();
  const key = trimmed.toLowerCase();
  const lemma = lemmatizeEnglish(trimmed);
  const ctx = context || trimmed;
  const tokens = tokenizeWithIndex(ctx);
  const idx = tokens.findIndex(
    (t) =>
      t.key === key ||
      t.surface === trimmed ||
      ctx.slice(t.start, t.end).toLowerCase() === key
  );

  const prevKey = idx > 0 ? tokens[idx - 1]?.key : undefined;
  const nextKey = idx >= 0 ? tokens[idx + 1]?.key : undefined;
  const { pos, structure, explanation } = guessPos(
    trimmed,
    key,
    lemma,
    prevKey,
    nextKey
  );

  const constructions: GrammarPoint[] = [];

  if (idx >= 0) {
    const phrasal = findPhrasalAround(tokens, idx);
    if (phrasal) constructions.push(phrasal);
  }

  // Конструкции абзаца, пересекающие слово
  if (idx >= 0) {
    const tok = tokens[idx]!;
    for (const m of findEnglishGrammarMatches(ctx)) {
      if (tok.start >= m.start && tok.end <= m.end) {
        if (!constructions.some((c) => c.structure === m.point.structure)) {
          constructions.push(m.point);
        }
      }
    }
  }

  let finalStructure = structure;
  let finalExplanation = explanation;
  const tenseHit = constructions.find((c) =>
    /Continuous|Perfect|Future|going to|will \+|there is/i.test(c.structure)
  );
  const phrasalHit = constructions.find((c) =>
    Object.values(PHRASALS).some((list) =>
      list.some((e) => e.structure === c.structure)
    )
  );
  if (phrasalHit) {
    finalStructure = `Фразовый глагол: ${phrasalHit.structure}`;
    finalExplanation = phrasalHit.explanation;
  } else if (tenseHit) {
    finalStructure = tenseHit.structure;
    finalExplanation = tenseHit.explanation;
  }

  return {
    surface: trimmed,
    lemma,
    partOfSpeech: pos,
    structure: finalStructure,
    explanation: finalExplanation,
    example: phrasalHit?.example ?? tenseHit?.example ?? constructions[0]?.example,
    constructions,
  };
}

/** CSS-класс подсветки для английских конструкций. */
export function englishGrammarClassAt(
  matches: EnglishGrammarMatch[],
  pos: number
): string | undefined {
  const m = matches.find((g) => pos >= g.start && pos < g.end);
  if (!m) return undefined;
  if (/continuous|perfect|future|will|going/i.test(m.point.structure)) {
    return 'grammar-mark-en-tense';
  }
  if (/phrasal|look |walk |sit |get |put |take |give |find |turn |come |pick /i.test(m.patternId + m.point.structure)) {
    return 'grammar-mark-en-phrasal';
  }
  return 'grammar-mark-en-other';
}
