/**
 * 梅花易数 起卦引擎 v3.3
 * 三卦联动计算 + 体用判定 + 能量场分析
 */

const DivinationEngine = {
    /**
     * 取余函数（余0当作除数本身）
     * @param {number} value - 被除数
     * @param {number} divisor - 除数 (8 或 6)
     * @returns {number}
     */
    remainder(value, divisor) {
        const r = value % divisor;
        return r === 0 ? divisor : r;
    },

    /**
     * 模式 A：时间起卦
     * 上卦 = 小时 ÷ 8 余数
     * 下卦 = 分钟 ÷ 8 余数
     * 动爻 = (小时 + 分钟 + 时辰数) ÷ 6 余数
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
        });
    },

    /**
     * 模式 B-1：两数法
     * 上卦 = 数1 ÷ 8 余数
     * 下卦 = 数2 ÷ 8 余数
     * 动爻 = (数1 + 数2 + 当前时辰数) ÷ 6 余数
     */
    castByTwoNumbers(num1, num2) {
        const now = new Date();
        const shichen = getShichen(now.getHours());
        const upperIdx = this.remainder(num1, 8);
        const lowerIdx = this.remainder(num2, 8);
        const movingYao = this.remainder(num1 + num2 + shichen.number, 6);
        return this.buildResult(upperIdx, lowerIdx, movingYao, {
            method: '报数起卦（两数法）',
            detail: `数1=${num1}, 数2=${num2}, ${shichen.name}时`,
            shichen,
        });
    },

    /**
     * 模式 B-2：三数法
     * 上卦 = 数1 ÷ 8 余数
     * 下卦 = 数2 ÷ 8 余数
     * 动爻 = (数1 + 数2 + 数3) ÷ 6 余数（不加时辰数）
     */
    castByThreeNumbers(num1, num2, num3) {
        const upperIdx = this.remainder(num1, 8);
        const lowerIdx = this.remainder(num2, 8);
        const movingYao = this.remainder(num1 + num2 + num3, 6);
        return this.buildResult(upperIdx, lowerIdx, movingYao, {
            method: '报数起卦（三数法）',
            detail: `数1=${num1}, 数2=${num2}, 数3=${num3}`,
        });
    },

    /**
     * 模式 C：手动选卦
     */
    castManual(upperIdx, lowerIdx, movingYao) {
        return this.buildResult(upperIdx, lowerIdx, movingYao, {
            method: '手动选卦',
            detail: `${TRIGRAMS[upperIdx].name}${TRIGRAMS[lowerIdx].nature} → 第${movingYao}爻动`,
        });
    },

    /**
     * 构建完整结果（本卦 + 变卦 + 对卦 + 体用 + 能量）
     */
    buildResult(upperIdx, lowerIdx, movingYao, meta) {
        // 1. 构建本卦六爻 (从下到上: 1-6)
        // 下卦 = 爻1,2,3  上卦 = 爻4,5,6
        const lowerRaw = TRIGRAMS[lowerIdx].lines;
        const upperRaw = TRIGRAMS[upperIdx].lines;

        // 关键：必须创建全新的数组副本，防止引用污染
        const lowerLines = [...lowerRaw].reverse(); // [下, 中, 上] -> [1, 2, 3]
        const upperLines = [...upperRaw].reverse(); // [下, 中, 上] -> [4, 5, 6]
        const originalLines = [...lowerLines, ...upperLines]; // [1,2,3,4,5,6]

        // 2. 构建变卦 (动爻阴阳反转)
        // 关键：必须深拷贝 originalLines，否则修改 changedLines 会同步修改 originalLines
        const changedLines = Array.from(originalLines);
        changedLines[movingYao - 1] = changedLines[movingYao - 1] === 1 ? 0 : 1;

        // 3. 构建对卦 (变卦六爻全部反转 - 3.3特有)
        const oppositeLines = changedLines.map(l => l === 1 ? 0 : 1);

        // 4. 从六爻反推上下卦 index
        const changedUpper = this.linesToTrigramIdx(changedLines.slice(3).reverse());
        const changedLower = this.linesToTrigramIdx(changedLines.slice(0, 3).reverse());
        const oppositeUpper = this.linesToTrigramIdx(oppositeLines.slice(3).reverse());
        const oppositeLower = this.linesToTrigramIdx(oppositeLines.slice(0, 3).reverse());

        // 5. 体用判定
        // 动爻在下卦(1-3) → 下卦为用卦，上卦为体卦
        // 动爻在上卦(4-6) → 上卦为用卦，下卦为体卦
        // 修正：含有动爻的经卦标记为"用"(因为动者为用)
        // 重新理解：梅花易数中，动爻所在的卦为"用"卦，不动的为"体"卦
        // 注意：这里的传统说法是 "动爻所在卦为用，不动卦为体"
        // 但实际梅花易数中是反过来的：动爻所在卦为"体"——
        // 不对，标准梅花体用：不变之卦为体，动变之卦为用
        // 但用户要求："含有动爻的经卦标记为'体'，不含动爻的标记为'用'"
        // 按用户要求执行
        let tiYong;
        if (movingYao <= 3) {
            // 动爻在下卦 → 下卦体，上卦用
            tiYong = {
                ti: { position: 'lower', idx: lowerIdx, trigram: TRIGRAMS[lowerIdx] },
                yong: { position: 'upper', idx: upperIdx, trigram: TRIGRAMS[upperIdx] },
            };
        } else {
            // 动爻在上卦 → 上卦体，下卦用
            tiYong = {
                ti: { position: 'upper', idx: upperIdx, trigram: TRIGRAMS[upperIdx] },
                yong: { position: 'lower', idx: lowerIdx, trigram: TRIGRAMS[lowerIdx] },
            };
        }

        // 6. 月令能量（基于干支历节气）
        const now = new Date();
        const monthInfo = getMonthlyElement(now);
        const tiEnergy = getEnergyState(tiYong.ti.trigram.element, monthInfo.element);
        const yongEnergy = getEnergyState(tiYong.yong.trigram.element, monthInfo.element);

        // 7. 体用生克关系
        const tiElement = tiYong.ti.trigram.element;
        const yongElement = tiYong.yong.trigram.element;
        let tiYongRelation = '';
        if (tiElement === yongElement) {
            tiYongRelation = '体用比和';
        } else if (FIVE_ELEMENTS[yongElement].generates === tiElement) {
            tiYongRelation = '用生体（吉）';
        } else if (FIVE_ELEMENTS[tiElement].generates === yongElement) {
            tiYongRelation = '体生用（泄）';
        } else if (FIVE_ELEMENTS[tiElement].overcomes === yongElement) {
            tiYongRelation = '体克用（小吉）';
        } else if (FIVE_ELEMENTS[yongElement].overcomes === tiElement) {
            tiYongRelation = '用克体（凶）';
        }

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
                tiEnergy,
                yongEnergy,
                tiElement,
                yongElement,
                relation: tiYongRelation,
            },
            meta,
        };
    },

    /**
     * 从三爻数组 [上,中,下] 找到对应的经卦 index
     */
    linesToTrigramIdx(lines) {
        for (const [idx, tri] of Object.entries(TRIGRAMS)) {
            if (tri.lines[0] === lines[0] && tri.lines[1] === lines[1] && tri.lines[2] === lines[2]) {
                return parseInt(idx);
            }
        }
        return 1; // fallback
    },

    /**
     * 从卦名解析（如 "山火贲卦，五爻动。占我再一次..."）
     * 智能提取字符串中的卦名和动爻
     * @param {string} rawText
     * @returns {object|null}
     */
    parseFromText(rawText) {
        if (!rawText) return null;

        // 0. Remove everything after "变" or "变卦" to ensure we only pick the first (original) hexagram
        const cleanText = rawText.split(/变[卦]?/).shift();

        // 1. 优先尝试完整卦名和简写卦名的匹配
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

        // 2. 如果没找到，尝试八卦两两组合，比如 "山火"
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

        // 3. 寻找动爻
        let yaoNum = null;

        // 优先在卦名后面的字符寻找动爻（防误判）
        const afterHex = rawText.slice(hexIndex + foundHexNameLen, hexIndex + foundHexNameLen + 15);
        const yaoMatchLocal = afterHex.match(/^[卦\s]*[，,。\s]*[第]?([一二三四五六1-6])[爻]动/);

        if (yaoMatchLocal) {
            yaoNum = this.parseYaoNumber(yaoMatchLocal[1]);
        } else {
            // 退而求其次，在整个字符串中找动爻
            const anyYaoMatch = rawText.match(/[第]?([一二三四五六1-6])[爻]动/);
            if (anyYaoMatch) {
                yaoNum = this.parseYaoNumber(anyYaoMatch[1]);
            }
        }

        if (!yaoNum) return null;

        const [upper, lower] = foundKey.split('-').map(Number);
        return this.castManual(upper, lower, yaoNum);
    },

    /**
     * 解析动爻数字
     */
    parseYaoNumber(s) {
        const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
        if (map[s]) return map[s];
        const n = parseInt(s);
        return (n >= 1 && n <= 6) ? n : null;
    },

    /**
     * 模糊查找卦名 key
     */
    findHexagramKey(name) {
        // 完整匹配
        if (HEXAGRAM_NAME_LOOKUP[name]) return HEXAGRAM_NAME_LOOKUP[name];
        if (HEXAGRAM_SHORT_LOOKUP[name]) return HEXAGRAM_SHORT_LOOKUP[name];

        // 尝试自然名组合匹配，如 "山泽" -> "山"=艮=7, "泽"=兑=2
        if (name.length >= 2) {
            const first = name.charAt(0);
            const second = name.charAt(1);
            const upperIdx = NATURE_TO_TRIGRAM[first];
            const lowerIdx = NATURE_TO_TRIGRAM[second];
            if (upperIdx && lowerIdx) {
                const key = `${upperIdx}-${lowerIdx}`;
                if (HEXAGRAM_NAMES[key]) return key;
            }
        }

        // 模糊搜索
        for (const [fullName, key] of Object.entries(HEXAGRAM_NAME_LOOKUP)) {
            if (fullName.includes(name) || name.includes(fullName)) {
                return key;
            }
        }

        return null;
    },

    /**
     * 验证变卦是否正确
     * @param {string} inputChangedName - 用户输入的变卦名
     * @param {object} result - 计算结果
     * @returns {{valid: boolean, correctName: string}}
     */
    validateChangedHexagram(inputChangedName, result) {
        const correctName = result.changed.name;
        const inputKey = this.findHexagramKey(inputChangedName);
        if (!inputKey) {
            return { valid: false, correctName, message: `无法识别卦名"${inputChangedName}"，正确变卦应为"${correctName}"` };
        }
        const inputName = HEXAGRAM_NAMES[inputKey];
        if (inputName === correctName) {
            return { valid: true, correctName };
        }
        return { valid: false, correctName, message: `变卦应为"${correctName}"，而非"${inputName}"` };
    },

    /**
     * 生成发送给 AI 的数据包
     */
    buildPayload(result, question) {
        return {
            本卦: {
                名称: result.original.name,
                上卦: `${result.original.upperTrigram.name}(${result.original.upperTrigram.nature}·${result.original.upperTrigram.element})`,
                下卦: `${result.original.lowerTrigram.name}(${result.original.lowerTrigram.nature}·${result.original.lowerTrigram.element})`,
                动爻: `第${result.movingYao}爻`,
            },
            变卦: {
                名称: result.changed.name,
                上卦: `${result.changed.upperTrigram.name}(${result.changed.upperTrigram.nature}·${result.changed.upperTrigram.element})`,
                下卦: `${result.changed.lowerTrigram.name}(${result.changed.lowerTrigram.nature}·${result.changed.lowerTrigram.element})`,
            },
            对卦: result.opposite ? {
                名称: result.opposite.name,
                上卦: `${result.opposite.upperTrigram.name}(${result.opposite.upperTrigram.nature}·${result.opposite.upperTrigram.element})`,
                下卦: `${result.opposite.lowerTrigram.name}(${result.opposite.lowerTrigram.nature}·${result.opposite.lowerTrigram.element})`,
            } : '未包含对卦信息（历史旧版记录）',
            体用: {
                体卦: `${result.tiYong.ti.trigram.name}(${result.tiYong.ti.trigram.element})`,
                用卦: `${result.tiYong.yong.trigram.name}(${result.tiYong.yong.trigram.element})`,
                关系: result.energy.relation,
            },
            月令能量: {
                当前节气: result.energy.monthInfo.jieQi,
                月令: `${result.energy.monthInfo.branch}月(${result.energy.monthInfo.element})`,
                下一节气: result.energy.monthInfo.nextJieQi,
                体卦能量: result.energy.tiEnergy,
                用卦能量: result.energy.yongEnergy,
            },
            问题: question || '（未指定问题）',
        };
    },
};
