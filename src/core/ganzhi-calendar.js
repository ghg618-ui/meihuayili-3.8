/**
 * 干支历 · 节气月令计算
 * 基于天文算法，按"节"气转换月支
 */

// 24节气名称
export const SOLAR_TERMS = [
    '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
    '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
    '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
    '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
];

// 12个"节"气对应的月支信息
export const JIE_QI_MONTHS = {
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

const JIE_NAMES = ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种',
    '小暑', '立秋', '白露', '寒露', '立冬', '大雪'];

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

function sunLongitude(jd) {
    const T = (jd - 2451545.0) / 36525.0;
    const L0 = mod360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    const M = mod360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    const Mrad = M * Math.PI / 180;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
        + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
        + 0.000289 * Math.sin(3 * Mrad);
    const sunTrue = L0 + C;
    const omega = 125.04 - 1934.136 * T;
    const omegaRad = omega * Math.PI / 180;
    const apparent = sunTrue - 0.00569 - 0.00478 * Math.sin(omegaRad);
    return mod360(apparent);
}

function mod360(x) {
    return ((x % 360) + 360) % 360;
}

function findSolarTermJD(targetLng, jdEstimate) {
    let jd = jdEstimate;
    for (let i = 0; i < 50; i++) {
        const lng = sunLongitude(jd);
        let diff = targetLng - lng;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        if (Math.abs(diff) < 0.0001) break;
        jd += diff / 360 * 365.25;
    }
    return jd;
}

export function getSolarTermsOfYear(year) {
    const terms = [];
    const startAngles = [285, 300, 315, 330, 345, 0,
        15, 30, 45, 60, 75, 90,
        105, 120, 135, 150, 165, 180,
        195, 210, 225, 240, 255, 270];

    for (let i = 0; i < 24; i++) {
        const angle = startAngles[i];
        const estimateMonth = (i < 4) ? 1 :
            (i < 6) ? 2 + Math.floor((i - 4) / 2) :
                Math.floor(i / 2) + 1;
        const estimateDay = (i % 2 === 0) ? 6 : 21;
        const jdEstimate = toJulianDay(year, estimateMonth, estimateDay);

        const jd = findSolarTermJD(angle, jdEstimate);
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

const _cache = {};

function getCachedTerms(year) {
    if (!_cache[year]) {
        _cache[year] = getSolarTermsOfYear(year);
    }
    return _cache[year];
}

export function getMonthlyInfo(date) {
    const year = date.getFullYear();
    const prevTerms = getCachedTerms(year - 1);
    const currTerms = getCachedTerms(year);
    const nextTerms = getCachedTerms(year + 1);

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

    allJie.sort((a, b) => a.date - b.date);

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

export function formatJieDate(dateInput) {
    if (!dateInput) return '--';
    let date = dateInput;
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

/**
 * 查找某年某公历月中的节气（节，非中气）
 * 每个公历月都恰好有一个"节"过渡点
 */
export function getJieInMonth(year, month) {
    for (const yr of [year - 1, year, year + 1]) {
        const terms = getCachedTerms(yr);
        for (const term of terms) {
            if (!JIE_NAMES.includes(term.name)) continue;
            const d = term.date;
            if (d.getFullYear() === year && d.getMonth() + 1 === month) {
                return { name: term.name, date: term.date, ...JIE_QI_MONTHS[term.name] };
            }
        }
    }
    return null;
}

const GanzhiCalendar = {
    getMonthlyInfo,
    getSolarTermsOfYear,
    formatJieDate,
    getJieInMonth,
    JIE_QI_MONTHS,
};

export default GanzhiCalendar;
