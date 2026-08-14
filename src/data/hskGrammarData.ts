/**
 * Грамматические конструкции HSK (语法大纲).
 * Сгенерировано из hsk_grammar.json — не редактировать вручную.
 * Обновление: python scripts/extract_hsk_grammar.py && node scripts/gen_hsk_grammar_ts.js
 */
export interface HskGrammarJsonEntry {
  hanzi: string;
  structure: string;
  parts: string[];
  level: number;
  type: 'grammar';
  category: string;
  词语?: string;
  等级?: number;
  explanation?: string;
  example?: string;
}

const HSK_GRAMMAR_DATA: HskGrammarJsonEntry[] = [
  {
    "hanzi": "连…都…，更不用说…了",
    "structure": "连…都…，更不用说…了",
    "parts": [
      "连",
      "都",
      "更不用说",
      "了"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "连…都…，更不用说…了",
    "等级": 7
  },
  {
    "hanzi": "一则…，二则…，三则",
    "structure": "一则…，二则…，三则",
    "parts": [
      "一则",
      "二则",
      "三则"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "一则…，二则…，三则",
    "等级": 7
  },
  {
    "hanzi": "一来…，二来…，三来",
    "structure": "一来…，二来…，三来",
    "parts": [
      "一来",
      "二来",
      "三来"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "一来…，二来…，三来",
    "等级": 7
  },
  {
    "hanzi": "要是…，（就）…，否则",
    "structure": "要是…，（就）…，否则",
    "parts": [
      "要是",
      "（就）",
      "否则"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "要是…，（就）…，否则",
    "等级": 4
  },
  {
    "hanzi": "连…也/都…，…更",
    "structure": "连…也/都…，…更",
    "parts": [
      "连",
      "也/都",
      "更"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "连…也/都…，…更",
    "等级": 4
  },
  {
    "hanzi": "凡…（者），均（可）",
    "structure": "凡…（者），均（可）",
    "parts": [
      "凡",
      "（者），均（可）"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "凡…（者），均（可）",
    "等级": 7
  },
  {
    "hanzi": "一方面…另一方面",
    "structure": "一方面…另一方面",
    "parts": [
      "一方面",
      "另一方面"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "一方面…另一方面",
    "等级": 4
  },
  {
    "hanzi": "尚且…，（更）何况",
    "structure": "尚且…，（更）何况",
    "parts": [
      "尚且",
      "（更）何况"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "尚且…，（更）何况",
    "等级": 7
  },
  {
    "hanzi": "不但不/不但没有…，反而",
    "structure": "不但不/不但没有…，反而",
    "parts": [
      "不但不/不但没有",
      "反而"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不但不/不但没有…，反而",
    "等级": 5
  },
  {
    "hanzi": "一会儿…一会儿",
    "structure": "一会儿…一会儿",
    "parts": [
      "一会儿",
      "一会儿"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "一会儿…一会儿",
    "等级": 3
  },
  {
    "hanzi": "为（了）…起见，",
    "structure": "为（了）…起见，",
    "parts": [
      "为（了）",
      "起见"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "为（了）…起见，",
    "等级": 7
  },
  {
    "hanzi": "无论…与否，都",
    "structure": "无论…与否，都",
    "parts": [
      "无论",
      "与否，都"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "无论…与否，都",
    "等级": 7
  },
  {
    "hanzi": "没有…就没有",
    "structure": "没有…就没有",
    "parts": [
      "没有",
      "就没有"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "没有…就没有",
    "等级": 5
  },
  {
    "hanzi": "无非/不过/只是…罢了/而已",
    "structure": "无非/不过/只是…罢了/而已",
    "parts": [
      "无非/不过/只是",
      "罢了/而已"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "无非/不过/只是…罢了/而已",
    "等级": 7
  },
  {
    "hanzi": "幸亏/幸好…，不然/否则",
    "structure": "幸亏/幸好…，不然/否则",
    "parts": [
      "幸亏/幸好",
      "不然/否则"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "幸亏/幸好…，不然/否则",
    "等级": 7
  },
  {
    "hanzi": "不仅/不光…，还/而且",
    "structure": "不仅/不光…，还/而且",
    "parts": [
      "不仅/不光",
      "还/而且"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不仅/不光…，还/而且",
    "等级": 4
  },
  {
    "hanzi": "尽管…，但是/可是",
    "structure": "尽管…，但是/可是",
    "parts": [
      "尽管",
      "但是/可是"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "尽管…，但是/可是",
    "等级": 4
  },
  {
    "hanzi": "除非…，否则/不然",
    "structure": "除非…，否则/不然",
    "parts": [
      "除非",
      "否则/不然"
    ],
    "level": 6,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "除非…，否则/不然",
    "等级": 6
  },
  {
    "hanzi": "与其…，宁愿/宁可",
    "structure": "与其…，宁愿/宁可",
    "parts": [
      "与其",
      "宁愿/宁可"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "与其…，宁愿/宁可",
    "等级": 7
  },
  {
    "hanzi": "宁可/宁愿…，也不",
    "structure": "宁可/宁愿…，也不",
    "parts": [
      "宁可/宁愿",
      "也不"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "宁可/宁愿…，也不",
    "等级": 7
  },
  {
    "hanzi": "（由于）…，因此",
    "structure": "（由于）…，因此",
    "parts": [
      "（由于）",
      "因此"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "（由于）…，因此",
    "等级": 4
  },
  {
    "hanzi": "不是…，还/还是",
    "structure": "不是…，还/还是",
    "parts": [
      "不是",
      "还/还是"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不是…，还/还是",
    "等级": 5
  },
  {
    "hanzi": "因为…所以",
    "structure": "因为…所以",
    "parts": [
      "因为",
      "所以"
    ],
    "level": 2,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "因为…所以",
    "等级": 2
  },
  {
    "hanzi": "虽然…但是",
    "structure": "虽然…但是",
    "parts": [
      "虽然",
      "但是"
    ],
    "level": 2,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "虽然…但是",
    "等级": 2
  },
  {
    "hanzi": "一边…一边",
    "structure": "一边…一边",
    "parts": [
      "一边",
      "一边"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "一边…一边",
    "等级": 3
  },
  {
    "hanzi": "不但…而且",
    "structure": "不但…而且",
    "parts": [
      "不但",
      "而且"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不但…而且",
    "等级": 3
  },
  {
    "hanzi": "或者…或者",
    "structure": "或者…或者",
    "parts": [
      "或者",
      "或者"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "或者…或者",
    "等级": 3
  },
  {
    "hanzi": "虽然…可是",
    "structure": "虽然…可是",
    "parts": [
      "虽然",
      "可是"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "虽然…可是",
    "等级": 3
  },
  {
    "hanzi": "不仅…而且",
    "structure": "不仅…而且",
    "parts": [
      "不仅",
      "而且"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不仅…而且",
    "等级": 4
  },
  {
    "hanzi": "不是…就是",
    "structure": "不是…就是",
    "parts": [
      "不是",
      "就是"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不是…就是",
    "等级": 4
  },
  {
    "hanzi": "不是…而是",
    "structure": "不是…而是",
    "parts": [
      "不是",
      "而是"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不是…而是",
    "等级": 4
  },
  {
    "hanzi": "尽管…但是",
    "structure": "尽管…但是",
    "parts": [
      "尽管",
      "但是"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "尽管…但是",
    "等级": 4
  },
  {
    "hanzi": "首先…，其次",
    "structure": "首先…，其次",
    "parts": [
      "首先",
      "其次"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "首先…，其次",
    "等级": 4
  },
  {
    "hanzi": "首先…，然后",
    "structure": "首先…，然后",
    "parts": [
      "首先",
      "然后"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "首先…，然后",
    "等级": 4
  },
  {
    "hanzi": "或是…，或是",
    "structure": "或是…，或是",
    "parts": [
      "或是",
      "或是"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "或是…，或是",
    "等级": 5
  },
  {
    "hanzi": "一时…一时",
    "structure": "一时…一时",
    "parts": [
      "一时",
      "一时"
    ],
    "level": 6,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "一时…一时",
    "等级": 6
  },
  {
    "hanzi": "要么…要么",
    "structure": "要么…要么",
    "parts": [
      "要么",
      "要么"
    ],
    "level": 6,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "要么…要么",
    "等级": 6
  },
  {
    "hanzi": "一来…二来",
    "structure": "一来…二来",
    "parts": [
      "一来",
      "二来"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "一来…二来",
    "等级": 7
  },
  {
    "hanzi": "与其…不如",
    "structure": "与其…不如",
    "parts": [
      "与其",
      "不如"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "与其…不如",
    "等级": 7
  },
  {
    "hanzi": "宁可…也不",
    "structure": "宁可…也不",
    "parts": [
      "宁可",
      "也不"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "宁可…也不",
    "等级": 7
  },
  {
    "hanzi": "所谓…，就是",
    "structure": "所谓…，就是",
    "parts": [
      "所谓",
      "就是"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "所谓…，就是",
    "等级": 7
  },
  {
    "hanzi": "（在）…以前/以后/前/后",
    "structure": "（在）…以前/以后/前/后",
    "parts": [
      "（在）",
      "以前/以后/前/后"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "（在）…以前/以后/前/后",
    "等级": 3
  },
  {
    "hanzi": "要/快要/就要…了",
    "structure": "要/快要/就要…了",
    "parts": [
      "要/快要/就要",
      "了"
    ],
    "level": 2,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "要/快要/就要…了",
    "等级": 2
  },
  {
    "hanzi": "纵然/纵使…，也",
    "structure": "纵然/纵使…，也",
    "parts": [
      "纵然/纵使",
      "也"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "纵然/纵使…，也",
    "等级": 7
  },
  {
    "hanzi": "（是）…，还是",
    "structure": "（是）…，还是",
    "parts": [
      "（是）",
      "还是"
    ],
    "level": 2,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "（是）…，还是",
    "等级": 2
  },
  {
    "hanzi": "先…，再/然后",
    "structure": "先…，再/然后",
    "parts": [
      "先",
      "再/然后"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "先…，再/然后",
    "等级": 3
  },
  {
    "hanzi": "不管…，都/也",
    "structure": "不管…，都/也",
    "parts": [
      "不管",
      "都/也"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不管…，都/也",
    "等级": 4
  },
  {
    "hanzi": "无论…，都/也",
    "structure": "无论…，都/也",
    "parts": [
      "无论",
      "都/也"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "无论…，都/也",
    "等级": 4
  },
  {
    "hanzi": "万一…，（就）",
    "structure": "万一…，（就）",
    "parts": [
      "万一",
      "（就）"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "万一…，（就）",
    "等级": 5
  },
  {
    "hanzi": "假如…，（就）",
    "structure": "假如…，（就）",
    "parts": [
      "假如",
      "（就）"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "假如…，（就）",
    "等级": 5
  },
  {
    "hanzi": "（自）…以来",
    "structure": "（自）…以来",
    "parts": [
      "（自）",
      "以来"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "（自）…以来",
    "等级": 5
  },
  {
    "hanzi": "别说…，都/也",
    "structure": "别说…，都/也",
    "parts": [
      "别说",
      "都/也"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "别说…，都/也",
    "等级": 7
  },
  {
    "hanzi": "虽说…，但/可",
    "structure": "虽说…，但/可",
    "parts": [
      "虽说",
      "但/可"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "虽说…，但/可",
    "等级": 7
  },
  {
    "hanzi": "（在）…之余",
    "structure": "（在）…之余",
    "parts": [
      "（在）",
      "之余"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "（在）…之余",
    "等级": 7
  },
  {
    "hanzi": "不是…吗？",
    "structure": "不是…吗",
    "parts": [
      "不是",
      "吗"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不是…吗？",
    "等级": 3
  },
  {
    "hanzi": "难道…吗？",
    "structure": "难道…吗",
    "parts": [
      "难道",
      "吗"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "难道…吗？",
    "等级": 4
  },
  {
    "hanzi": "还是…吧",
    "structure": "还是…吧",
    "parts": [
      "还是",
      "吧"
    ],
    "level": 2,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "还是…吧",
    "等级": 2
  },
  {
    "hanzi": "先…然后",
    "structure": "先…然后",
    "parts": [
      "先",
      "然后"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "先…然后",
    "等级": 3
  },
  {
    "hanzi": "只有…才",
    "structure": "只有…才",
    "parts": [
      "只有",
      "才"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "只有…才",
    "等级": 3
  },
  {
    "hanzi": "只要…就",
    "structure": "只要…就",
    "parts": [
      "只要",
      "就"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "只要…就",
    "等级": 3
  },
  {
    "hanzi": "在…看来",
    "structure": "在…看来",
    "parts": [
      "在",
      "看来"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "在…看来",
    "等级": 3
  },
  {
    "hanzi": "如果…就",
    "structure": "如果…就",
    "parts": [
      "如果",
      "就"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "如果…就",
    "等级": 3
  },
  {
    "hanzi": "对…来说",
    "structure": "对…来说",
    "parts": [
      "对",
      "来说"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "对…来说",
    "等级": 3
  },
  {
    "hanzi": "不管…都",
    "structure": "不管…都",
    "parts": [
      "不管",
      "都"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不管…都",
    "等级": 4
  },
  {
    "hanzi": "为了…而",
    "structure": "为了…而",
    "parts": [
      "为了",
      "而"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "为了…而",
    "等级": 4
  },
  {
    "hanzi": "即使…也",
    "structure": "即使…也",
    "parts": [
      "即使",
      "也"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "即使…也",
    "等级": 4
  },
  {
    "hanzi": "在…方面",
    "structure": "在…方面",
    "parts": [
      "在",
      "方面"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "在…方面",
    "等级": 4
  },
  {
    "hanzi": "就是…也",
    "structure": "就是…也",
    "parts": [
      "就是",
      "也"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "就是…也",
    "等级": 4
  },
  {
    "hanzi": "拿…来说",
    "structure": "拿…来说",
    "parts": [
      "拿",
      "来说"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "拿…来说",
    "等级": 4
  },
  {
    "hanzi": "无论…都",
    "structure": "无论…都",
    "parts": [
      "无论",
      "都"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "无论…都",
    "等级": 4
  },
  {
    "hanzi": "既然…就",
    "structure": "既然…就",
    "parts": [
      "既然",
      "就"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "既然…就",
    "等级": 4
  },
  {
    "hanzi": "要是…就",
    "structure": "要是…就",
    "parts": [
      "要是",
      "就"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "要是…就",
    "等级": 4
  },
  {
    "hanzi": "跟…相比",
    "structure": "跟…相比",
    "parts": [
      "跟",
      "相比"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "跟…相比",
    "等级": 4
  },
  {
    "hanzi": "一旦…就",
    "structure": "一旦…就",
    "parts": [
      "一旦",
      "就"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "一旦…就",
    "等级": 5
  },
  {
    "hanzi": "从…来看",
    "structure": "从…来看",
    "parts": [
      "从",
      "来看"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "从…来看",
    "等级": 5
  },
  {
    "hanzi": "假如…就",
    "structure": "假如…就",
    "parts": [
      "假如",
      "就"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "假如…就",
    "等级": 5
  },
  {
    "hanzi": "哪怕…也",
    "structure": "哪怕…也",
    "parts": [
      "哪怕",
      "也"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "哪怕…也",
    "等级": 5
  },
  {
    "hanzi": "由…组成",
    "structure": "由…组成",
    "parts": [
      "由",
      "组成"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "由…组成",
    "等级": 5
  },
  {
    "hanzi": "凡是…都",
    "structure": "凡是…都",
    "parts": [
      "凡是",
      "都"
    ],
    "level": 6,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "凡是…都",
    "等级": 6
  },
  {
    "hanzi": "到…为止",
    "structure": "到…为止",
    "parts": [
      "到",
      "为止"
    ],
    "level": 6,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "到…为止",
    "等级": 6
  },
  {
    "hanzi": "就算…也",
    "structure": "就算…也",
    "parts": [
      "就算",
      "也"
    ],
    "level": 6,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "就算…也",
    "等级": 6
  },
  {
    "hanzi": "除非…才",
    "structure": "除非…才",
    "parts": [
      "除非",
      "才"
    ],
    "level": 6,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "除非…才",
    "等级": 6
  },
  {
    "hanzi": "值此…之，",
    "structure": "值此…之，",
    "parts": [
      "值此",
      "之"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "值此…之，",
    "等级": 7
  },
  {
    "hanzi": "视…而定",
    "structure": "视…而定",
    "parts": [
      "视",
      "而定"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "视…而定",
    "等级": 7
  },
  {
    "hanzi": "非得…才",
    "structure": "非得…才",
    "parts": [
      "非得",
      "才"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "非得…才",
    "等级": 7
  },
  {
    "hanzi": "一…就",
    "structure": "一…就",
    "parts": [
      "一",
      "就"
    ],
    "level": 2,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "一…就",
    "等级": 2
  },
  {
    "hanzi": "又…又…",
    "structure": "又…又…",
    "parts": [
      "又",
      "又"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "又…又…",
    "等级": 3
  },
  {
    "hanzi": "又…，又",
    "structure": "又…，又",
    "parts": [
      "又",
      "又"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "又…，又",
    "等级": 3
  },
  {
    "hanzi": "越…越",
    "structure": "越…越",
    "parts": [
      "越",
      "越"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "越…越",
    "等级": 3
  },
  {
    "hanzi": "越…越…",
    "structure": "越…越…",
    "parts": [
      "越",
      "越"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "越…越…",
    "等级": 3
  },
  {
    "hanzi": "既…又",
    "structure": "既…又",
    "parts": [
      "既",
      "又"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "既…又",
    "等级": 4
  },
  {
    "hanzi": "不…不",
    "structure": "不…不",
    "parts": [
      "不",
      "不"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不…不",
    "等级": 5
  },
  {
    "hanzi": "再…也",
    "structure": "再…也",
    "parts": [
      "再",
      "也"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "再…也",
    "等级": 5
  },
  {
    "hanzi": "了，（没）有",
    "structure": "了，（没）有",
    "parts": [
      "了，（没）有"
    ],
    "level": 6,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "了，（没）有",
    "等级": 6
  },
  {
    "hanzi": "一点儿也不",
    "structure": "一点儿也不",
    "parts": [
      "一点儿也不"
    ],
    "level": 3,
    "type": "grammar",
    "category": "fixed",
    "词语": "一点儿也不",
    "等级": 3
  },
  {
    "hanzi": "不管怎样说",
    "structure": "不管怎样说",
    "parts": [
      "不管怎样说"
    ],
    "level": 5,
    "type": "grammar",
    "category": "fixed",
    "词语": "不管怎样说",
    "等级": 5
  },
  {
    "hanzi": "去，都是/就是",
    "structure": "去，都是/就是",
    "parts": [
      "去，都是/就是"
    ],
    "level": 5,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "去，都是/就是",
    "等级": 5
  },
  {
    "hanzi": "一般来说",
    "structure": "一般来说",
    "parts": [
      "一般来说"
    ],
    "level": 3,
    "type": "grammar",
    "category": "fixed",
    "词语": "一般来说",
    "等级": 3
  },
  {
    "hanzi": "不一会儿",
    "structure": "不一会儿",
    "parts": [
      "不一会儿"
    ],
    "level": 3,
    "type": "grammar",
    "category": "fixed",
    "词语": "不一会儿",
    "等级": 3
  },
  {
    "hanzi": "的话，就",
    "structure": "的话，就",
    "parts": [
      "的话，就"
    ],
    "level": 3,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "的话，就",
    "等级": 3
  },
  {
    "hanzi": "不说，还",
    "structure": "不说，还",
    "parts": [
      "不说，还"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "不说，还",
    "等级": 7
  },
  {
    "hanzi": "动不动就",
    "structure": "动不动就",
    "parts": [
      "动不动就"
    ],
    "level": 7,
    "type": "grammar",
    "category": "fixed",
    "词语": "动不动就",
    "等级": 7
  },
  {
    "hanzi": "归根到底",
    "structure": "归根到底",
    "parts": [
      "归根到底"
    ],
    "level": 7,
    "type": "grammar",
    "category": "fixed",
    "词语": "归根到底",
    "等级": 7
  },
  {
    "hanzi": "总的来说",
    "structure": "总的来说",
    "parts": [
      "总的来说"
    ],
    "level": 7,
    "type": "grammar",
    "category": "fixed",
    "词语": "总的来说",
    "等级": 7
  },
  {
    "hanzi": "总而言之",
    "structure": "总而言之",
    "parts": [
      "总而言之"
    ],
    "level": 7,
    "type": "grammar",
    "category": "fixed",
    "词语": "总而言之",
    "等级": 7
  },
  {
    "hanzi": "换句话说",
    "structure": "换句话说",
    "parts": [
      "换句话说"
    ],
    "level": 7,
    "type": "grammar",
    "category": "fixed",
    "词语": "换句话说",
    "等级": 7
  },
  {
    "hanzi": "无论如何",
    "structure": "无论如何",
    "parts": [
      "无论如何"
    ],
    "level": 7,
    "type": "grammar",
    "category": "fixed",
    "词语": "无论如何",
    "等级": 7
  },
  {
    "hanzi": "综上所述",
    "structure": "综上所述",
    "parts": [
      "综上所述"
    ],
    "level": 7,
    "type": "grammar",
    "category": "fixed",
    "词语": "综上所述",
    "等级": 7
  },
  {
    "hanzi": "这样一来",
    "structure": "这样一来",
    "parts": [
      "这样一来"
    ],
    "level": 7,
    "type": "grammar",
    "category": "fixed",
    "词语": "这样一来",
    "等级": 7
  },
  {
    "hanzi": "再也不/没",
    "structure": "再也不/没",
    "parts": [
      "再也不/没"
    ],
    "level": 4,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "再也不/没",
    "等级": 4
  },
  {
    "hanzi": "越来越",
    "structure": "越来越",
    "parts": [
      "越来越"
    ],
    "level": 3,
    "type": "grammar",
    "category": "fixed",
    "词语": "越来越",
    "等级": 3
  },
  {
    "hanzi": "有的是",
    "structure": "有的是",
    "parts": [
      "有的是"
    ],
    "level": 4,
    "type": "grammar",
    "category": "fixed",
    "词语": "有的是",
    "等级": 4
  },
  {
    "hanzi": "来不及",
    "structure": "来不及",
    "parts": [
      "来不及"
    ],
    "level": 4,
    "type": "grammar",
    "category": "fixed",
    "词语": "来不及",
    "等级": 4
  },
  {
    "hanzi": "来得及",
    "structure": "来得及",
    "parts": [
      "来得及"
    ],
    "level": 4,
    "type": "grammar",
    "category": "fixed",
    "词语": "来得及",
    "等级": 4
  },
  {
    "hanzi": "说不定",
    "structure": "说不定",
    "parts": [
      "说不定"
    ],
    "level": 4,
    "type": "grammar",
    "category": "fixed",
    "词语": "说不定",
    "等级": 4
  },
  {
    "hanzi": "何至于",
    "structure": "何至于",
    "parts": [
      "何至于"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "何至于",
    "等级": 7
  },
  {
    "hanzi": "巴不得",
    "structure": "巴不得",
    "parts": [
      "巴不得"
    ],
    "level": 7,
    "type": "grammar",
    "category": "fixed",
    "词语": "巴不得",
    "等级": 7
  },
  {
    "hanzi": "怪不得",
    "structure": "怪不得",
    "parts": [
      "怪不得"
    ],
    "level": 7,
    "type": "grammar",
    "category": "fixed",
    "词语": "怪不得",
    "等级": 7
  },
  {
    "hanzi": "莫过于",
    "structure": "莫过于",
    "parts": [
      "莫过于"
    ],
    "level": 7,
    "type": "grammar",
    "category": "ellipsis",
    "词语": "莫过于",
    "等级": 7
  }
];

export default HSK_GRAMMAR_DATA;
