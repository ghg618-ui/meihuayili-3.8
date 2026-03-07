import { hashPassword } from '../src/utils/hashing.js';
import { escapeHtml } from '../src/utils/dom.js';
import { formatMarkdown } from '../src/utils/formatter.js';

describe('hashPassword', () => {
    test('should return a deterministic hash', () => {
        const h1 = hashPassword('testPassword');
        const h2 = hashPassword('testPassword');
        expect(h1).toBe(h2);
    });

    test('should return different hashes for different inputs', () => {
        expect(hashPassword('abc')).not.toBe(hashPassword('def'));
    });

    test('should return a string', () => {
        expect(typeof hashPassword('test')).toBe('string');
        expect(hashPassword('test').length).toBeGreaterThan(0);
    });
});

describe('escapeHtml', () => {
    test('should escape HTML special characters', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe(
            '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
        );
    });

    test('should escape ampersands', () => {
        expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    test('should escape single quotes', () => {
        expect(escapeHtml("it's")).toBe("it&#039;s");
    });

    test('should return empty string for falsy input', () => {
        expect(escapeHtml('')).toBe('');
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});

describe('formatMarkdown', () => {
    test('should convert ## headers to h3', () => {
        expect(formatMarkdown('## Hello')).toContain('<h3>');
    });

    test('should convert ### headers to h4', () => {
        expect(formatMarkdown('### World')).toContain('<h4>');
    });

    test('should convert **bold** to strong', () => {
        expect(formatMarkdown('**bold text**')).toContain('<strong>bold text</strong>');
    });

    test('should convert *italic* to em', () => {
        expect(formatMarkdown('*italic text*')).toContain('<em>italic text</em>');
    });

    test('should convert newlines to br', () => {
        expect(formatMarkdown('line1\nline2')).toContain('<br>');
    });

    test('should return empty string for empty input', () => {
        expect(formatMarkdown('')).toBe('');
        expect(formatMarkdown(null)).toBe('');
    });

    test('should escape HTML in input before formatting', () => {
        const result = formatMarkdown('<script>bad</script>');
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;script&gt;');
    });
});
