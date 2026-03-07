/**
 * 八卦 & 六十四卦 数据库
 * 梅花义理·数智决策系统 3.7.1
 */

import GanzhiCalendar from './ganzhi-calendar.js';

// ===================== 八卦 (Trigrams) =====================
// 1=乾，2=兑，3=离，4=震，5=巽，6=坎，7=艮，8=坤
export const TRIGRAMS = {
  1: { name: '乾', nature: '天', symbol: '☰', element: '金', lines: [1, 1, 1] },
  2: { name: '兑', nature: '泽', symbol: '☱', element: '金', lines: [0, 1, 1] },
  3: { name: '离', nature: '火', symbol: '☲', element: '火', lines: [1, 0, 1] },
  4: { name: '震', nature: '雷', symbol: '☳', element: '木', lines: [0, 0, 1] },
  5: { name: '巽', nature: '风', symbol: '☴', element: '木', lines: [1, 1, 0] },
  6: { name: '坎', nature: '水', symbol: '☵', element: '水', lines: [0, 1, 0] },
  7: { name: '艮', nature: '山', symbol: '☶', element: '土', lines: [1, 0, 0] },
  8: { name: '坤', nature: '地', symbol: '☷', element: '土', lines: [0, 0, 0] },
};

// 十二地支时辰数
export const SHICHEN = [
  { name: '子', number: 1, hours: [23, 0] },
  { name: '丑', number: 2, hours: [1, 2] },
  { name: '寅', number: 3, hours: [3, 4] },
  { name: '卯', number: 4, hours: [5, 6] },
  { name: '辰', number: 5, hours: [7, 8] },
  { name: '巳', number: 6, hours: [9, 10] },
  { name: '午', number: 7, hours: [11, 12] },
  { name: '未', number: 8, hours: [13, 14] },
  { name: '申', number: 9, hours: [15, 16] },
  { name: '酉', number: 10, hours: [17, 18] },
  { name: '戌', number: 11, hours: [19, 20] },
  { name: '亥', number: 12, hours: [21, 22] },
];

export function getShichen(hour) {
  if (hour === 23 || hour === 0) return SHICHEN[0];
  if (hour === 1 || hour === 2) return SHICHEN[1];
  if (hour === 3 || hour === 4) return SHICHEN[2];
  if (hour === 5 || hour === 6) return SHICHEN[3];
  if (hour === 7 || hour === 8) return SHICHEN[4];
  if (hour === 9 || hour === 10) return SHICHEN[5];
  if (hour === 11 || hour === 12) return SHICHEN[6];
  if (hour === 13 || hour === 14) return SHICHEN[7];
  if (hour === 15 || hour === 16) return SHICHEN[8];
  if (hour === 17 || hour === 18) return SHICHEN[9];
  if (hour === 19 || hour === 20) return SHICHEN[10];
  if (hour === 21 || hour === 22) return SHICHEN[11];
  return SHICHEN[0];
}

export const HEXAGRAM_NAMES = {
  '1-1': '乾为天', '1-2': '天泽履', '1-3': '天火同人', '1-4': '天雷无妄',
  '1-5': '天风姤', '1-6': '天水讼', '1-7': '天山遁', '1-8': '天地否',
  '2-1': '泽天夬', '2-2': '兑为泽', '2-3': '泽火革', '2-4': '泽雷随',
  '2-5': '泽风大过', '2-6': '泽水困', '2-7': '泽山咸', '2-8': '泽地萃',
  '3-1': '火天大有', '3-2': '火泽睽', '3-3': '离为火', '3-4': '火雷噬嗑',
  '3-5': '火风鼎', '3-6': '火水未济', '3-7': '火山旅', '3-8': '火地晋',
  '4-1': '雷天大壮', '4-2': '雷泽归妹', '4-3': '雷火丰', '4-4': '震为雷',
  '4-5': '雷风恒', '4-6': '雷水解', '4-7': '雷山小过', '4-8': '雷地豫',
  '5-1': '风天小畜', '5-2': '风泽中孚', '5-3': '风火家人', '5-4': '风雷益',
  '5-5': '巽为风', '5-6': '风水涣', '5-7': '风山渐', '5-8': '风地观',
  '6-1': '水天需', '6-2': '水泽节', '6-3': '水火既济', '6-4': '水雷屯',
  '6-5': '水风井', '6-6': '坎为水', '6-7': '水山蹇', '6-8': '水地比',
  '7-1': '山天大畜', '7-2': '山泽损', '7-3': '山火贲', '7-4': '山雷颐',
  '7-5': '山风蛊', '7-6': '山水蒙', '7-7': '艮为山', '7-8': '山地剥',
  '8-1': '地天泰', '8-2': '地泽临', '8-3': '地火明夷', '8-4': '地雷复',
  '8-5': '地风升', '8-6': '地水师', '8-7': '地山谦', '8-8': '坤为地',
};

export const FIVE_ELEMENTS = {
  '金': { generates: '水', overcomes: '木', generatedBy: '土', overcomeBy: '火' },
  '木': { generates: '火', overcomes: '土', generatedBy: '水', overcomeBy: '金' },
  '水': { generates: '木', overcomes: '火', generatedBy: '金', overcomeBy: '土' },
  '火': { generates: '土', overcomes: '金', generatedBy: '木', overcomeBy: '水' },
  '土': { generates: '金', overcomes: '水', generatedBy: '火', overcomeBy: '木' },
};

export function getMonthlyElement(date) {
  date = date || new Date();
  return GanzhiCalendar.getMonthlyInfo(date);
}

export function getEnergyState(element, monthElement) {
  if (element === monthElement) return '旺';
  if (FIVE_ELEMENTS[monthElement].generates === element) return '相';
  if (FIVE_ELEMENTS[element].generates === monthElement) return '休';
  if (FIVE_ELEMENTS[element].overcomes === monthElement) return '囚';
  if (FIVE_ELEMENTS[monthElement].overcomes === element) return '死';
  return '平';
}

export const HEXAGRAM_NAME_LOOKUP = {};
for (const key in HEXAGRAM_NAMES) {
  if (Object.prototype.hasOwnProperty.call(HEXAGRAM_NAMES, key)) {
    HEXAGRAM_NAME_LOOKUP[HEXAGRAM_NAMES[key]] = key;
  }
}

export const HEXAGRAM_SHORT_LOOKUP = {};
for (const key2 in HEXAGRAM_NAMES) {
  if (Object.prototype.hasOwnProperty.call(HEXAGRAM_NAMES, key2)) {
    const name = HEXAGRAM_NAMES[key2];
    HEXAGRAM_SHORT_LOOKUP[name] = key2;
    if (name.includes('为')) {
      const shortName = name.charAt(0);
      if (!HEXAGRAM_SHORT_LOOKUP[shortName]) {
        HEXAGRAM_SHORT_LOOKUP[shortName] = key2;
      }
    }
  }
}

export const NATURE_TO_TRIGRAM = {};
for (const idx in TRIGRAMS) {
  if (Object.prototype.hasOwnProperty.call(TRIGRAMS, idx)) {
    const tri = TRIGRAMS[idx];
    NATURE_TO_TRIGRAM[tri.nature] = parseInt(idx);
    NATURE_TO_TRIGRAM[tri.name] = parseInt(idx);
  }
}

export default {
  TRIGRAMS,
  SHICHEN,
  getShichen,
  HEXAGRAM_NAMES,
  FIVE_ELEMENTS,
  getMonthlyElement,
  getEnergyState,
  HEXAGRAM_NAME_LOOKUP,
  HEXAGRAM_SHORT_LOOKUP,
  NATURE_TO_TRIGRAM,
};
