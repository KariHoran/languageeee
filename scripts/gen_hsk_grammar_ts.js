const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'src/data/hsk_grammar.json');
const outPath = path.join(root, 'src/data/hskGrammarData.ts');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const header = `/**
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

const HSK_GRAMMAR_DATA: HskGrammarJsonEntry[] = `;

const footer = `;

export default HSK_GRAMMAR_DATA;
`;

fs.writeFileSync(outPath, header + JSON.stringify(data, null, 2) + footer, 'utf8');
console.log('wrote', outPath, data.length, 'entries');
