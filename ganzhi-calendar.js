/**
 * 干支历 · 节气月令计算
 * 基于天文算法，按"节"气转换月支
 * 
 * 节气月令对照：
 * 小寒 → 丑月(土)  |  立春 → 寅月(木)  |  惊蛰 → 卯月(木)
 * 清明 → 辰月(土)  |  立夏 → 巳月(火)  |  芒种 → 午月(火)
 * 小暑 → 未月(土)  |  立秋 → 申月(金)  |  白露 → 酉月(金)
 * 寒露 → 戌月(土)  |  立冬 → 亥月(水)  |  大雪 → 子月(水)
 */

const GanzhiCalendar = (function () {
    'use strict';

    // 24节气名称（按黄经度排列，从春分0°开始每15°一个）
    // 这里按照从小寒开始排列（与月令对应更直观）
    const SOLAR_TERMS = [
        '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
        '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
        '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
        '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
    ];

    // 12个"节"气对应的月支信息（"节"是每月开始的标志）
    // 节气名: { branch: 地支, element: 五行 }
    const JIE_QI_MONTHS = {
        '小寒': { branch: '丑', element: '土', monthNum: 12 },
        '立春': { branch: '寅', element: '木', monthNum: 1 },
        '惊蛰': { branch: '卯', element: '木', monthNum: 2 },
        '清明': { branch: '辰', element: '土', monthNum: 3 },
        '立夏': { branch: '巳', element: '火', monthNum: 4 },
        '芒种': { branch: '午', element: '火', monthNum: 5 },
        '小暑': { branch: '未', element: '土', monthNum: 6 },
        '立秋': { branch: '申', element: '金', monthNum: 7 },
        '白露': { branch: '酉', element: '金', monthNum: 8 },
        '寒露': { branch: '戌', element: '土', monthNum: 9 },
        '立冬': { branch: '亥', element: '水', monthNum: 10 },
        '大雪': { branch: '子', element: '水', monthNum: 11 },
    };

    // 12个"节"气名称列表（用于月份判定）
    const JIE_NAMES = ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种',
        '小暑', '立秋', '白露', '寒露', '立冬', '大雪'];

    /**
     * 计算儒略日数 (Julian Day Number)
     * @param {number} year
     * @param {number} month (1-12)
     * @param {number} day (可含小数表示时刻)
     * @returns {number} JD
     */
    function toJulianDay(year, month, day) {
        if (month <= 2) {
            year -= 1;
            month += 12;
        }
        const A = Math.floor(year / 100);
        const B = 2 - A + Math.floor(A / 4);
        return Math.floor(365.25 * (year + 4716)) +
            Math.floor(30.6001 * (month + 1)) +
            day + B - 1524.5;
    }

    /**
     * 儒略日转公历日期
     * @param {number} jd
     * @returns {Date}
     */
    function fromJulianDay(jd) {
        jd += 0.5;
        const Z = Math.floor(jd);
        const F = jd - Z;
        let A;
        if (Z < 2299161) {
            A = Z;
        } else {
            const alpha = Math.floor((Z - 1867216.25) / 36524.25);
            A = Z + 1 + alpha - Math.floor(alpha / 4);
        }
        const B = A + 1524;
        const C = Math.floor((B - 122.1) / 365.25);
        const D = Math.floor(365.25 * C);
        const E = Math.floor((B - D) / 30.6001);
        const day = B - D - Math.floor(30.6001 * E) + F;
        const month = (E < 14) ? E - 1 : E - 13;
        const year = (month > 2) ? C - 4716 : C - 4715;
        return new Date(year, month - 1, Math.floor(day),
            Math.floor((day % 1) * 24),
            Math.floor(((day % 1) * 24 % 1) * 60));
    }

    /**
     * 计算太阳黄经（简化VSOP87）
     * @param {number} jd - 儒略日
     * @returns {number} 太阳黄经（度）
     */
    function sunLongitude(jd) {
        const T = (jd - 2451545.0) / 36525.0; // 儒略世纪数

        // 太阳平黄经
        const L0 = mod360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);

        // 太阳平近点角
        const M = mod360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
        const Mrad = M * Math.PI / 180;

        // 太阳中心差
        const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
            + 0.000289 * Math.sin(3 * Mrad);

        // 太阳真黄经
        const sunTrue = L0 + C;

        // 黄经章动修正（简化）
        const omega = 125.04 - 1934.136 * T;
        const omegaRad = omega * Math.PI / 180;
        const apparent = sunTrue - 0.00569 - 0.00478 * Math.sin(omegaRad);

        return mod360(apparent);
    }

    function mod360(x) {
        return ((x % 360) + 360) % 360;
    }

    /**
     * 以牛顿迭代法求太阳黄经达到指定角度的儒略日
     * @param {number} targetLng - 目标太阳黄经（度）
     * @param {number} jdEstimate - 初始估算JD
     * @returns {number} 精确JD
     */
    function findSolarTermJD(targetLng, jdEstimate) {
        let jd = jdEstimate;
        for (let i = 0; i < 50; i++) {
            const lng = sunLongitude(jd);
            let diff = targetLng - lng;
            // 处理360°跨越
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            if (Math.abs(diff) < 0.0001) break;
            // 太阳每天约移动1°
            jd += diff / 360 * 365.25;
        }
        return jd;
    }

    /**
     * 计算某年所有24节气的日期（北京时间 UTC+8）
     * @param {number} year
     * @returns {Array<{name: string, date: Date, jd: number}>}
     */
    function getSolarTermsOfYear(year) {
        const terms = [];

        // 24节气对应的太阳黄经度数
        // 春分=0°, 每个节气间隔15°
        // 按SOLAR_TERMS数组顺序：小寒=285°, 大寒=300°, 立春=315°, ...
        const startAngles = [285, 300, 315, 330, 345, 0,
            15, 30, 45, 60, 75, 90,
            105, 120, 135, 150, 165, 180,
            195, 210, 225, 240, 255, 270];

        for (let i = 0; i < 24; i++) {
            const angle = startAngles[i];
            // 估算该节气大约在一年中的哪一天
            // 小寒≈1月6日, 大寒≈1月20日, ...
            const estimateMonth = (i < 4) ? 1 :
                (i < 6) ? 2 + Math.floor((i - 4) / 2) :
                    Math.floor(i / 2) + 1;
            const estimateDay = (i % 2 === 0) ? 6 : 21;
            const jdEstimate = toJulianDay(year, estimateMonth, estimateDay);

            const jd = findSolarTermJD(angle, jdEstimate);
            // 转为北京时间 (UTC+8 = +8/24天)
            const jdBeijing = jd + 8 / 24;
            const date = fromJulianDay(jdBeijing);

            terms.push({
                name: SOLAR_TERMS[i],
                date: date,
                jd: jdBeijing,
                angle: angle,
            });
        }

        return terms;
    }

    // 缓存已计算的年份节气
    const _cache = {};

    function getCachedTerms(year) {
        if (!_cache[year]) {
            _cache[year] = getSolarTermsOfYear(year);
        }
        return _cache[year];
    }

    /**
     * 获取指定日期所在的干支月令
     * @param {Date} date
     * @returns {{branch: string, element: string, monthNum: number, jieQi: string, nextJieQi: string, nextJieDate: Date}}
     */
    function getMonthlyInfo(date) {
        const year = date.getFullYear();

        // 需要检查前一年的大雪和当年到下一年的节气
        const prevTerms = getCachedTerms(year - 1);
        const currTerms = getCachedTerms(year);
        const nextTerms = getCachedTerms(year + 1);

        // 收集所有"节"气及其日期，排序
        const allJie = [];

        function collectJie(terms, yr) {
            for (const term of terms) {
                if (JIE_NAMES.includes(term.name)) {
                    allJie.push({
                        name: term.name,
                        date: term.date,
                        year: yr,
                        ...JIE_QI_MONTHS[term.name],
                    });
                }
            }
        }

        collectJie(prevTerms, year - 1);
        collectJie(currTerms, year);
        collectJie(nextTerms, year + 1);

        // 按日期排序
        allJie.sort((a, b) => a.date - b.date);

        // 找到当前日期落在哪两个"节"气之间
        const dateTs = date.getTime();
        for (let i = allJie.length - 1; i >= 0; i--) {
            if (dateTs >= allJie[i].date.getTime()) {
                const current = allJie[i];
                const next = allJie[i + 1] || null;
                return {
                    branch: current.branch,
                    element: current.element,
                    monthNum: current.monthNum,
                    jieQi: current.name,
                    jieDate: current.date,
                    nextJieQi: next ? next.name : '--',
                    nextJieDate: next ? next.date : null,
                };
            }
        }

        // 兜底：取前一年最后一个节气（大雪→子月）
        const last = allJie[0];
        return {
            branch: last.branch,
            element: last.element,
            monthNum: last.monthNum,
            jieQi: last.name,
            jieDate: last.date,
            nextJieQi: allJie[1] ? allJie[1].name : '--',
            nextJieDate: allJie[1] ? allJie[1].date : null,
        };
    }

    /**
     * 格式化节气日期为可读字符串
     */
    function formatJieDate(dateInput) {
        if (!dateInput) return '--';
        let date = dateInput;
        // Handle dates that come from localStorage (JSON parsed as string)
        if (typeof date === 'string') {
            date = new Date(date);
        }
        if (isNaN(date.getTime())) return '--';

        const m = date.getMonth() + 1;
        const d = date.getDate();
        const h = date.getHours();
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${m}月${d}日 ${h}:${min}`;
    }

    // Public API
    return {
        getMonthlyInfo,
        getSolarTermsOfYear,
        formatJieDate,
        JIE_QI_MONTHS,
    };
})();
