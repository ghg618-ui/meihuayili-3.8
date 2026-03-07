import DivinationEngine from '../src/core/divination-engine.js';
import { TRIGRAMS, HEXAGRAM_NAMES, getShichen, getEnergyState } from '../src/core/bagua-data.js';
import { HEXAGRAM_JUDGMENTS, LINE_TEXTS } from '../src/core/hexagram-texts.js';

describe('DivinationEngine', () => {
    describe('castByTime', () => {
        test('should return complete divination data', () => {
            const result = DivinationEngine.castByTime(14, 30);
            expect(result).toBeDefined();
            expect(result.original).toBeDefined();
            expect(result.changed).toBeDefined();
            expect(result.opposite).toBeDefined();
            expect(result.energy).toBeDefined();
            expect(result.movingYao).toBeGreaterThanOrEqual(1);
            expect(result.movingYao).toBeLessThanOrEqual(6);
        });

        test('should have 6 lines in each hexagram', () => {
            const result = DivinationEngine.castByTime(10, 0);
            expect(result.original.lines).toHaveLength(6);
            expect(result.changed.lines).toHaveLength(6);
            expect(result.opposite.lines).toHaveLength(6);
        });

        test('should set tiYong correctly based on moving yao', () => {
            const result = DivinationEngine.castByTime(14, 30);
            const { tiYong, movingYao } = result;
            if (movingYao <= 3) {
                expect(tiYong.ti.position).toBe('lower');
                expect(tiYong.yong.position).toBe('upper');
            } else {
                expect(tiYong.ti.position).toBe('upper');
                expect(tiYong.yong.position).toBe('lower');
            }
        });

        test('should have valid hexagram names', () => {
            const result = DivinationEngine.castByTime(8, 15);
            expect(result.original.name).toBeDefined();
            expect(typeof result.original.name).toBe('string');
            expect(result.changed.name).toBeDefined();
            expect(result.opposite.name).toBeDefined();
        });

        test('should include energy/monthInfo', () => {
            const result = DivinationEngine.castByTime(12, 30);
            expect(result.energy.monthInfo).toBeDefined();
            expect(result.energy.monthInfo.element).toBeDefined();
            expect(result.energy.original.relation).toBeDefined();
        });
    });

    describe('castByTwoNumbers', () => {
        test('should produce valid result for two numbers', () => {
            const result = DivinationEngine.castByTwoNumbers(3, 5);
            expect(result.original).toBeDefined();
            expect(result.movingYao).toBeGreaterThanOrEqual(1);
            expect(result.movingYao).toBeLessThanOrEqual(6);
            expect(result.meta.method).toBe('报数起卦（两数法）');
        });

        test('should handle large numbers via modulo', () => {
            const result = DivinationEngine.castByTwoNumbers(100, 200);
            expect(result.original.upperIdx).toBeGreaterThanOrEqual(1);
            expect(result.original.upperIdx).toBeLessThanOrEqual(8);
            expect(result.original.lowerIdx).toBeGreaterThanOrEqual(1);
            expect(result.original.lowerIdx).toBeLessThanOrEqual(8);
        });
    });

    describe('castByThreeNumbers', () => {
        test('should produce valid result for three numbers', () => {
            const result = DivinationEngine.castByThreeNumbers(1, 2, 3);
            expect(result.original).toBeDefined();
            expect(result.meta.method).toBe('报数起卦（三数法）');
        });
    });

    describe('castManual', () => {
        test('should accept manual upper/lower/yao selection', () => {
            const result = DivinationEngine.castManual(1, 8, 3);
            expect(result.original.upperIdx).toBe(1);
            expect(result.original.lowerIdx).toBe(8);
            expect(result.movingYao).toBe(3);
            expect(result.original.name).toBe('天地否');
        });
    });

    describe('remainder', () => {
        test('should return divisor when value is exact multiple', () => {
            expect(DivinationEngine.remainder(8, 8)).toBe(8);
            expect(DivinationEngine.remainder(16, 8)).toBe(8);
        });

        test('should return normal modulo for non-multiples', () => {
            expect(DivinationEngine.remainder(5, 8)).toBe(5);
            expect(DivinationEngine.remainder(9, 8)).toBe(1);
        });
    });

    describe('buildPayload', () => {
        test('should produce valid payload for AI', () => {
            const result = DivinationEngine.castByTime(14, 30);
            const payload = DivinationEngine.buildPayload(result, '测试问题');
            expect(payload['用户问题']).toBe('测试问题');
            expect(payload['本卦']).toBeDefined();
            expect(payload['变卦']).toBeDefined();
            expect(payload['月令状态']).toBeDefined();
        });
    });

    describe('threeStageDeduction', () => {
        test('should return three stages', () => {
            const result = DivinationEngine.castByTime(14, 30);
            const deduction = DivinationEngine.threeStageDeduction(result);
            expect(deduction.origin).toBeDefined();
            expect(deduction.process).toBeDefined();
            expect(deduction.final).toBeDefined();
        });
    });
});

describe('Bagua Data', () => {
    test('TRIGRAMS should have 8 entries', () => {
        expect(Object.keys(TRIGRAMS)).toHaveLength(8);
    });

    test('each trigram should have name, nature, symbol, element, lines', () => {
        for (const [, trigram] of Object.entries(TRIGRAMS)) {
            expect(trigram.name).toBeDefined();
            expect(trigram.nature).toBeDefined();
            expect(trigram.symbol).toBeDefined();
            expect(trigram.element).toBeDefined();
            expect(trigram.lines).toHaveLength(3);
        }
    });

    test('HEXAGRAM_NAMES should have 64 entries', () => {
        expect(Object.keys(HEXAGRAM_NAMES)).toHaveLength(64);
    });

    test('getShichen should return correct shichen', () => {
        expect(getShichen(0).name).toBe('子');
        expect(getShichen(23).name).toBe('子');
        expect(getShichen(7).name).toBe('辰');
        expect(getShichen(14).name).toBe('未');
    });

    test('getEnergyState should return valid state', () => {
        const state = getEnergyState('金', '金');
        expect(['旺', '相', '休', '囚', '死']).toContain(state);
    });
});

describe('Hexagram Texts', () => {
    test('HEXAGRAM_JUDGMENTS should have 64 entries', () => {
        expect(Object.keys(HEXAGRAM_JUDGMENTS)).toHaveLength(64);
    });

    test('each judgment should have name, judgment, strategy', () => {
        for (const [, j] of Object.entries(HEXAGRAM_JUDGMENTS)) {
            expect(j.name).toBeDefined();
            expect(j.judgment).toBeDefined();
            expect(j.strategy).toBeDefined();
        }
    });

    test('LINE_TEXTS should have entries with 6 lines each', () => {
        for (const [key, lines] of Object.entries(LINE_TEXTS)) {
            expect(lines).toHaveLength(6);
        }
    });
});
