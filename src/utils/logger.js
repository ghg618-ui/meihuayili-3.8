/**
 * Logger - Lightweight leveled logging utility
 *
 * Levels: debug < info < warn < error
 * In production builds (import.meta.env.PROD), only warn+ are shown.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// Default to debug; Vite and Jest both expose NODE_ENV safely here.
const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
const minLevel = isProd ? LEVELS.warn : LEVELS.debug;

function makeLogger(module) {
    const prefix = `[${module}]`;

    return {
        debug(...args) {
            if (minLevel <= LEVELS.debug) console.log(prefix, ...args);
        },
        info(...args) {
            if (minLevel <= LEVELS.info) console.log(prefix, ...args);
        },
        warn(...args) {
            if (minLevel <= LEVELS.warn) console.warn(prefix, ...args);
        },
        error(...args) {
            if (minLevel <= LEVELS.error) console.error(prefix, ...args);
        }
    };
}

export default makeLogger;
