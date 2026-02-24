/**
 * 八卦 & 六十四卦 数据库
 * 梅花义理·数智决策系统 3.3
 */

// ===================== 八卦 (Trigrams) =====================
// 数字对应：余数 -> 经卦 (余0按8算)
// 1=乾, 2=兑, 3=离, 4=震, 5=巽, 6=坎, 7=艮, 8=坤
const TRIGRAMS = {
  1: { name: '乾', nature: '天', symbol: '☰', element: '金', lines: [1, 1, 1] },
  2: { name: '兑', nature: '泽', symbol: '☱', element: '金', lines: [0, 1, 1] },
  3: { name: '离', nature: '火', symbol: '☲', element: '火', lines: [1, 0, 1] },
  4: { name: '震', nature: '雷', symbol: '☳', element: '木', lines: [0, 0, 1] },
  5: { name: '巽', nature: '风', symbol: '☴', element: '木', lines: [1, 1, 0] },
  6: { name: '坎', nature: '水', symbol: '☵', element: '水', lines: [0, 1, 0] },
  7: { name: '艮', nature: '山', symbol: '☶', element: '土', lines: [1, 0, 0] },
  8: { name: '坤', nature: '地', symbol: '☷', element: '土', lines: [0, 0, 0] },
};

// 巽卦修正: 巽的爻为 110 (阳阳阴, 从上到下)
// 实际上经卦从下到上: 巽=011(下中上)，显示从上到下为110
// 标准：lines数组表示 [上, 中, 下] 的爻
// 乾=111, 兑=011, 离=101, 震=001, 巽=110, 坎=010, 艮=100, 坤=000
// 修正TRIGRAMS的lines为从上到下
// 确认标准八卦爻画 (从下到上读)：
// 乾☰: ⚊⚊⚊ (阳阳阳)
// 兑☱: ⚋⚊⚊ (上阴,中阳,下阳) -> 从上到下 [0,1,1]
// 离☲: ⚊⚋⚊ (上阳,中阴,下阳) -> 从上到下 [1,0,1]  
// 震☳: ⚋⚋⚊ (上阴,中阴,下阳) -> 从上到下 [0,0,1]
// 巽☴: ⚊⚊⚋ (上阳,中阳,下阴) -> 从上到下 [1,1,0]
// 坎☵: ⚋⚊⚋ (上阴,中阳,下阴) -> 从上到下 [0,1,0]
// 艮☶: ⚊⚋⚋ (上阳,中阴,下阴) -> 从上到下 [1,0,0]
// 坤☷: ⚋⚋⚋ (阴阴阴) -> 从上到下 [0,0,0]

// 十二地支时辰数
// 子=1, 丑=2, 寅=3, 卯=4, 辰=5, 巳=6, 午=7, 未=8, 申=9, 酉=10, 戌=11, 亥=12
const SHICHEN = [
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

/**
 * 获取当前时辰数
 * @param {number} hour - 24小时制的小时
 * @returns {{name: string, number: number}}
 */
function getShichen(hour) {
  if (hour === 23 || hour === 0) return SHICHEN[0]; // 子时
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

// ===================== 六十四卦名称映射 =====================
// key: "上卦编号-下卦编号" (上下卦的trigram index)
const HEXAGRAM_NAMES = {
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

// ===================== 五行生克关系 =====================
const FIVE_ELEMENTS = {
  '金': { generates: '水', overcomes: '木', generatedBy: '土', overcomeBy: '火' },
  '木': { generates: '火', overcomes: '土', generatedBy: '水', overcomeBy: '金' },
  '水': { generates: '木', overcomes: '火', generatedBy: '金', overcomeBy: '土' },
  '火': { generates: '土', overcomes: '金', generatedBy: '木', overcomeBy: '水' },
  '土': { generates: '金', overcomes: '水', generatedBy: '火', overcomeBy: '木' },
};

// ===================== 月令五行旺衰 =====================
// 使用干支历（按节气转换月支），不再简单按公历月份对应
// 节气月令：立春→寅月(木), 惊蛰→卯月(木), 清明→辰月(土), ...
// 由 GanzhiCalendar 模块提供精确的节气日期计算

/**
 * 获取当前日期的干支月令信息
 * @param {Date} [date] - 可选，默认当前时间
 * @returns {{branch: string, element: string, monthNum: number, jieQi: string, nextJieQi: string, nextJieDate: Date}}
 */
function getMonthlyElement(date) {
  date = date || new Date();
  return GanzhiCalendar.getMonthlyInfo(date);
}

/**
 * 计算某五行在某月令下的能量状态
 * 旺：与月令五行相同
 * 相：月令五行所生
 * 休：生月令五行者
 * 囚：克月令五行者
 * 死：被月令五行所克
 * @param {string} element - 五行 (金木水火土)
 * @param {string} monthElement - 月令五行
 * @returns {string} 旺/相/休/囚/死
 */
function getEnergyState(element, monthElement) {
  if (element === monthElement) return '旺';
  if (FIVE_ELEMENTS[monthElement].generates === element) return '相';
  if (FIVE_ELEMENTS[element].generates === monthElement) return '休';
  if (FIVE_ELEMENTS[element].overcomes === monthElement) return '囚';
  if (FIVE_ELEMENTS[monthElement].overcomes === element) return '死';
  return '平';
}

// ===================== 卦名反查 =====================
// 从卦名反查上下卦 index
const HEXAGRAM_NAME_LOOKUP = {};
for (const [key, name] of Object.entries(HEXAGRAM_NAMES)) {
  HEXAGRAM_NAME_LOOKUP[name] = key;
}

// 用于模糊匹配的简化名映射
// 例如 "山泽损" -> "7-2", "乾" -> "1-1"
const HEXAGRAM_SHORT_LOOKUP = {};
for (const [key, name] of Object.entries(HEXAGRAM_NAMES)) {
  // 也存储去掉"为"字后的名称
  HEXAGRAM_SHORT_LOOKUP[name] = key;
  // 提取最后一两个字作为别名（如"损", "益"）
  const parts = key.split('-');
  // "天泽履" -> "履"，但 "乾为天" -> "乾"
  if (name.includes('为')) {
    const shortName = name.charAt(0);
    if (!HEXAGRAM_SHORT_LOOKUP[shortName]) {
      HEXAGRAM_SHORT_LOOKUP[shortName] = key;
    }
  }
}

// 从自然名（天、地、雷、风等）反查 trigram index
const NATURE_TO_TRIGRAM = {};
for (const [idx, tri] of Object.entries(TRIGRAMS)) {
  NATURE_TO_TRIGRAM[tri.nature] = parseInt(idx);
  NATURE_TO_TRIGRAM[tri.name] = parseInt(idx);
}
