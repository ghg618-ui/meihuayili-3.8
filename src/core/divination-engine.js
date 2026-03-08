/**
 * 梅花易数 起卦引擎 v3.7.1
 * 三卦联动计算 + 体用判定 + 能量场分析
 */

import {
    TRIGRAMS,
    HEXAGRAM_NAMES,
    FIVE_ELEMENTS,
    getShichen,
    getMonthlyElement,
    getEnergyState,
    HEXAGRAM_NAME_LOOKUP,
    HEXAGRAM_SHORT_LOOKUP,
    NATURE_TO_TRIGRAM
} from './bagua-data.js';

import {
    HEXAGRAM_JUDGMENTS,
    LINE_TEXTS
} from './hexagram-texts.js';

const DivinationEngine = {
    /**
     * 取余函数（余 0 当作除数本身）
     */
    remainder(value, divisor) {
        const r = value % divisor;
        return r === 0 ? divisor : r;
    },

    /**
     * 模式 A：时间起卦
     */
    castByTime(hour, minute) {
        const shichen = getShichen(hour);
        const upperIdx = this.remainder(hour, 8);
        const lowerIdx = this.remainder(minute, 8);
        const movingYao = this.remainder(hour + minute + shichen.number, 6);
        return this.buildResult(upperIdx, lowerIdx, movingYao, {
            method: '时间起卦',
            detail: `${hour}时${minute}分 (${shichen.name}时)`,
            shichen,
            hour,
            minute,
        });
    },

    /**
     * 模式 B-1：两数法
     */
    castByTwoNumbers(num1, num2) {
        const now = new Date();
        const shichen = getShichen(now.getHours());
        const upperIdx = this.remainder(num1, 8);
        const lowerIdx = this.remainder(num2, 8);
        const movingYao = this.remainder(num1 + num2 + shichen.number, 6);
        return this.buildResult(upperIdx, lowerIdx, movingYao, {
            method: '报数起卦（两数法）',
            detail: `数 1=${num1}, 数 2=${num2}, ${shichen.name}时`,
            shichen,
            num1,
            num2,
            date: now,
        });
    },

    /**
     * 模式 B-2：三数法
     */
    castByThreeNumbers(num1, num2, num3) {
        const now = new Date();
        const upperIdx = this.remainder(num1, 8);
        const lowerIdx = this.remainder(num2, 8);
        const movingYao = this.remainder(num1 + num2 + num3, 6);
        return this.buildResult(upperIdx, lowerIdx, movingYao, {
            method: '报数起卦（三数法）',
            detail: `数 1=${num1}, 数 2=${num2}, 数 3=${num3}`,
            num1,
            num2,
            num3,
            date: now,
        });
    },

    /**
     * 模式 C：手动选卦
     */
    castManual(upperIdx, lowerIdx, movingYao) {
        const now = new Date();
        return this.buildResult(upperIdx, lowerIdx, movingYao, {
            method: '手动选卦',
            detail: `${TRIGRAMS[upperIdx].name}${TRIGRAMS[lowerIdx].nature} → 第${movingYao}爻动`,
            upperIdx,
            lowerIdx,
            movingYao,
            date: now,
        });
    },

    /**
     * 构建完整结果
     */
    buildResult(upperIdx, lowerIdx, movingYao, meta) {
        const lowerRaw = TRIGRAMS[lowerIdx].lines;
        const upperRaw = TRIGRAMS[upperIdx].lines;
        const lowerLines = [...lowerRaw].reverse();
        const upperLines = [...upperRaw].reverse();
        const originalLines = [...lowerLines, ...upperLines];

        const changedLines = Array.from(originalLines);
        changedLines[movingYao - 1] = changedLines[movingYao - 1] === 1 ? 0 : 1;
        const oppositeLines = changedLines.map(l => l === 1 ? 0 : 1);

        const changedUpper = this.linesToTrigramIdx(changedLines.slice(3).reverse());
        const changedLower = this.linesToTrigramIdx(changedLines.slice(0, 3).reverse());
        const oppositeUpper = this.linesToTrigramIdx(oppositeLines.slice(3).reverse());
        const oppositeLower = this.linesToTrigramIdx(oppositeLines.slice(0, 3).reverse());

        let tiYong;
        if (movingYao <= 3) {
            tiYong = {
                ti: { position: 'lower', idx: lowerIdx, trigram: TRIGRAMS[lowerIdx] },
                yong: { position: 'upper', idx: upperIdx, trigram: TRIGRAMS[upperIdx] },
            };
        } else {
            tiYong = {
                ti: { position: 'upper', idx: upperIdx, trigram: TRIGRAMS[upperIdx] },
                yong: { position: 'lower', idx: lowerIdx, trigram: TRIGRAMS[lowerIdx] },
            };
        }

        const divinationDate = meta.date ? new Date(meta.date) : new Date();
        const monthInfo = getMonthlyElement(divinationDate);
        const monthElement = monthInfo.element;

        const originalTiEnergy = getEnergyState(tiYong.ti.trigram.element, monthElement);
        const originalYongEnergy = getEnergyState(tiYong.yong.trigram.element, monthElement);

        const changedTiElement = tiYong.ti.position === 'upper' ? TRIGRAMS[changedUpper].element : TRIGRAMS[changedLower].element;
        const changedYongElement = tiYong.yong.position === 'upper' ? TRIGRAMS[changedUpper].element : TRIGRAMS[changedLower].element;
        const changedTiEnergy = getEnergyState(changedTiElement, monthElement);
        const changedYongEnergy = getEnergyState(changedYongElement, monthElement);

        const oppositeTiElement = tiYong.ti.position === 'upper' ? TRIGRAMS[oppositeUpper].element : TRIGRAMS[oppositeLower].element;
        const oppositeYongElement = tiYong.yong.position === 'upper' ? TRIGRAMS[oppositeUpper].element : TRIGRAMS[oppositeLower].element;
        const oppositeTiEnergy = getEnergyState(oppositeTiElement, monthElement);
        const oppositeYongEnergy = getEnergyState(oppositeYongElement, monthElement);

        const tiElement = tiYong.ti.trigram.element;
        const yongElement = tiYong.yong.trigram.element;

        const getRelation = (ti, yong) => {
            if (ti === yong) return '体用比和';
            if (FIVE_ELEMENTS[yong].generates === ti) return '用生体（吉）';
            if (FIVE_ELEMENTS[ti].generates === yong) return '体生用（泄）';
            if (FIVE_ELEMENTS[ti].overcomes === yong) return '体克用（小吉）';
            if (FIVE_ELEMENTS[yong].overcomes === ti) return '用克体（凶）';
            return '平';
        };

        const tiYongRelation = getRelation(tiElement, yongElement);
        const changedTiYongRelation = getRelation(changedTiElement, changedYongElement);
        const oppositeTiYongRelation = getRelation(oppositeTiElement, oppositeYongElement);

        return {
            original: {
                upperIdx,
                lowerIdx,
                lines: originalLines,
                name: HEXAGRAM_NAMES[`${upperIdx}-${lowerIdx}`],
                upperTrigram: TRIGRAMS[upperIdx],
                lowerTrigram: TRIGRAMS[lowerIdx],
            },
            changed: {
                upperIdx: changedUpper,
                lowerIdx: changedLower,
                lines: changedLines,
                name: HEXAGRAM_NAMES[`${changedUpper}-${changedLower}`],
                upperTrigram: TRIGRAMS[changedUpper],
                lowerTrigram: TRIGRAMS[changedLower],
            },
            opposite: {
                upperIdx: oppositeUpper,
                lowerIdx: oppositeLower,
                lines: oppositeLines,
                name: HEXAGRAM_NAMES[`${oppositeUpper}-${oppositeLower}`],
                upperTrigram: TRIGRAMS[oppositeUpper],
                lowerTrigram: TRIGRAMS[oppositeLower],
            },
            movingYao,
            tiYong,
            energy: {
                monthInfo,
                original: { tiEnergy: originalTiEnergy, yongEnergy: originalYongEnergy, tiElement, yongElement, relation: tiYongRelation },
                changed: { tiEnergy: changedTiEnergy, yongEnergy: changedYongEnergy, tiElement: changedTiElement, yongElement: changedYongElement, relation: changedTiYongRelation },
                opposite: { tiEnergy: oppositeTiEnergy, yongEnergy: oppositeYongEnergy, tiElement: oppositeTiElement, yongElement: oppositeYongElement, relation: oppositeTiYongRelation },
            },
            meta,
        };
    },

    linesToTrigramIdx(lines) {
        for (const [idx, tri] of Object.entries(TRIGRAMS)) {
            if (tri.lines[0] === lines[0] && tri.lines[1] === lines[1] && tri.lines[2] === lines[2]) {
                return parseInt(idx);
            }
        }
        return 1;
    },

    parseFromText(rawText) {
        if (!rawText) return null;
        const cleanText = rawText.split(/变 [卦]？/).shift();
        const allNames = { ...HEXAGRAM_NAME_LOOKUP, ...HEXAGRAM_SHORT_LOOKUP };
        let earliestIdx = Infinity;
        let foundKey = null;
        let foundHexNameLen = 0;
        let hexIndex = -1;

        for (const [name, key] of Object.entries(allNames)) {
            const idx = cleanText.indexOf(name);
            if (idx !== -1 && idx < earliestIdx) {
                foundKey = key;
                foundHexNameLen = name.length;
                hexIndex = idx;
                earliestIdx = idx;
            }
        }

        if (!foundKey) {
            for (const [first, upperIdx] of Object.entries(NATURE_TO_TRIGRAM)) {
                for (const [second, lowerIdx] of Object.entries(NATURE_TO_TRIGRAM)) {
                    const combo = first + second;
                    const idx = cleanText.indexOf(combo);
                    if (idx !== -1 && idx < earliestIdx) {
                        const key = `${upperIdx}-${lowerIdx}`;
                        if (HEXAGRAM_NAMES[key]) {
                            foundKey = key;
                            foundHexNameLen = 2;
                            hexIndex = idx;
                            earliestIdx = idx;
                        }
                    }
                }
            }
        }

        if (!foundKey) return null;

        let yaoNum = null;
        const afterHex = rawText.slice(hexIndex + foundHexNameLen, hexIndex + foundHexNameLen + 15);
        const extractYaoChar = (text) => {
            const match = text.match(/(.)爻动/);
            if (!match) return null;
            const yaoChar = match[1];
            if ('初一二三四五六上'.includes(yaoChar) || /^[1-6]$/.test(yaoChar)) return yaoChar;
            return null;
        };
        const yaoCharLocal = extractYaoChar(afterHex) || extractYaoChar(rawText);
        if (yaoCharLocal) yaoNum = this.parseYaoNumber(yaoCharLocal);

        if (!yaoNum) return null;
        const [upper, lower] = foundKey.split('-').map(Number);
        return this.castManual(upper, lower, yaoNum);
    },

    parseYaoNumber(s) {
        const map = { '初': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '上': 6 };
        if (map[s]) return map[s];
        const n = parseInt(s);
        return (n >= 1 && n <= 6) ? n : null;
    },

    findHexagramKey(name) {
        if (HEXAGRAM_NAME_LOOKUP[name]) return HEXAGRAM_NAME_LOOKUP[name];
        if (HEXAGRAM_SHORT_LOOKUP[name]) return HEXAGRAM_SHORT_LOOKUP[name];
        if (name.length >= 2) {
            const upperIdx = NATURE_TO_TRIGRAM[name.charAt(0)];
            const lowerIdx = NATURE_TO_TRIGRAM[name.charAt(1)];
            if (upperIdx && lowerIdx && HEXAGRAM_NAMES[`${upperIdx}-${lowerIdx}`]) return `${upperIdx}-${lowerIdx}`;
        }
        for (const [fullName, key] of Object.entries(HEXAGRAM_NAME_LOOKUP)) {
            if (fullName.includes(name) || name.includes(fullName)) return key;
        }
        return null;
    },

    validateChangedHexagram(inputChangedName, result) {
        const correctName = result.changed.name;
        const inputKey = this.findHexagramKey(inputChangedName);
        if (!inputKey) return { valid: false, correctName, message: `无法识别卦名"${inputChangedName}"，正确变卦应为"${correctName}"` };
        const inputName = HEXAGRAM_NAMES[inputKey];
        return { valid: inputName === correctName, correctName, message: inputName === correctName ? '' : `变卦应为"${correctName}"，而非"${inputName}"` };
    },

    buildPayload(result, question) {
        const tiPos = result.tiYong.ti.position;
        return {
            '起卦逻辑': {
                '体位': tiPos === 'upper' ? '上卦' : '下卦',
                '用位': tiPos === 'upper' ? '下卦' : '上卦',
            },
            '本卦': {
                '名称': result.original.name,
                '体卦': tiPos === 'upper' ? `${result.original.upperTrigram.name}(${result.original.upperTrigram.element})` : `${result.original.lowerTrigram.name}(${result.original.lowerTrigram.element})`,
                '用卦': tiPos === 'upper' ? `${result.original.lowerTrigram.name}(${result.original.lowerTrigram.element})` : `${result.original.upperTrigram.name}(${result.original.upperTrigram.element})`,
                '动爻': `第${result.movingYao}爻`,
                '体用关系': result.energy.original.relation,
                '体能量': result.energy.original.tiEnergy,
                '用能量': result.energy.original.yongEnergy,
            },
            '变卦': {
                '名称': result.changed.name,
                '体卦': tiPos === 'upper' ? `${result.changed.upperTrigram.name}(${result.changed.upperTrigram.element})` : `${result.changed.lowerTrigram.name}(${result.changed.lowerTrigram.element})`,
                '用卦': tiPos === 'upper' ? `${result.changed.lowerTrigram.name}(${result.changed.lowerTrigram.element})` : `${result.changed.upperTrigram.name}(${result.changed.upperTrigram.element})`,
                '体用关系': result.energy.changed.relation,
                '体能量': result.energy.changed.tiEnergy,
                '用能量': result.energy.changed.yongEnergy,
            },
            '对卦（终局裁判）': {
                '名称': result.opposite.name,
                '体卦': tiPos === 'upper' ? `${result.opposite.upperTrigram.name}(${result.opposite.upperTrigram.element})` : `${result.opposite.lowerTrigram.name}(${result.opposite.lowerTrigram.element})`,
                '用卦': tiPos === 'upper' ? `${result.opposite.lowerTrigram.name}(${result.opposite.lowerTrigram.element})` : `${result.opposite.upperTrigram.name}(${result.opposite.upperTrigram.element})`,
                '体用关系': result.energy.opposite.relation,
                '体能量': result.energy.opposite.tiEnergy,
                '用能量': result.energy.opposite.yongEnergy,
            },
            '月令状态': {
                '月令': `${result.energy.monthInfo.branch}月 (${result.energy.monthInfo.element})`,
                '节气': result.energy.monthInfo.jieQi,
            },
            '天道义理': (() => {
                const hexKey = result.original.upperIdx + '-' + result.original.lowerIdx;
                const judgment = HEXAGRAM_JUDGMENTS[hexKey];
                const lineText = LINE_TEXTS[hexKey] ? LINE_TEXTS[hexKey][result.movingYao - 1] : null;
                if (!judgment) return { '提示': '卦辞数据缺失' };
                return {
                    '本卦卦辞（宏观底座）': judgment.judgment,
                    '卦辞战略': judgment.strategy,
                    '动爻爻辞（微观指针）': lineText || '爻辞缺失',
                };
            })(),
            '用户问题': question || '（未指定）',
        };
    },

    threeStageDeduction(result) {
        const analyze = (energy, stage) => ({
            stage,
            relation: energy.relation,
            summary: `${stage}：${energy.relation}，体${energy.tiEnergy}，用${energy.yongEnergy}`,
        });
        return {
            origin: analyze(result.energy.original, '缘起'),
            process: analyze(result.energy.changed, '过程'),
            final: analyze(result.energy.opposite, '终局'),
            finalOutcome: { outcome: result.energy.opposite.relation.includes('吉') ? '成功' : '自保', confidence: '中' },
        };
    },

    classifyMatrix(oppositeEnergy, moralOutcome) {
        const realitySuccess = oppositeEnergy.relation.includes('吉') || oppositeEnergy.relation.includes('比和');
        let quadrant, description, advice;
        if (realitySuccess && moralOutcome === '吉') {
            quadrant = '第一象限'; description = '大胜之象'; advice = '名正言顺，大胆推进';
        } else if (!realitySuccess && moralOutcome === '凶') {
            quadrant = '第二象限'; description = '大败之象'; advice = '全盘皆输，立刻止损';
        } else if (realitySuccess && moralOutcome === '凶') {
            quadrant = '第三象限'; description = '假胜之象'; advice = '饮鸩止渴，必埋隐患，宜急流勇退';
        } else if (!realitySuccess && moralOutcome === '吉') {
            quadrant = '第四象限'; description = '挡灾之象'; advice = '塞翁失马，用现实挫折挡住未来大祸';
        } else {
            quadrant = '平象'; description = '吉凶参半'; advice = '谨慎行事';
        }
        return { quadrant, description, advice, summary: `${quadrant}【${description}】：${advice}` };
    },

    /**
     * 从问题文本中解析起卦日期
     * 返回 { type:'specific', date } 或 { type:'month_only', year, month } 或 null
     */
    parseDateFromQuestion(text) {
        if (!text) return null;
        // 精确日期：2026年1月5日 / 2026年01月05号
        const fullMatch = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
        if (fullMatch) {
            const year = parseInt(fullMatch[1]);
            const month = parseInt(fullMatch[2]);
            const day = parseInt(fullMatch[3]);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return { type: 'specific', year, month, day, date: new Date(year, month - 1, day, 12, 0, 0) };
            }
        }
        // 仅月份：2026年1月
        const monthMatch = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
        if (monthMatch) {
            const year = parseInt(monthMatch[1]);
            const month = parseInt(monthMatch[2]);
            if (month >= 1 && month <= 12) {
                return { type: 'month_only', year, month };
            }
        }
        return null;
    },

    /**
     * 用指定日期重新计算月令旺衰，返回更新后的 result
     */
    recalculateMonthlyEnergy(result, date) {
        const monthInfo = getMonthlyElement(date);
        const monthElement = monthInfo.element;
        const getState = (element) => getEnergyState(element, monthElement);
        const recalc = (part) => ({
            ...part,
            tiEnergy: getState(part.tiElement),
            yongEnergy: getState(part.yongElement),
        });
        return {
            ...result,
            meta: { ...result.meta, date },
            energy: {
                monthInfo,
                original: recalc(result.energy.original),
                changed: recalc(result.energy.changed),
                opposite: recalc(result.energy.opposite),
            },
        };
    }
};

export default DivinationEngine;
