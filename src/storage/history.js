/**
 * Divination History Storage
 */
import makeLogger from '../utils/logger.js';

const log = makeLogger('History');

export function getUserHistoryKey(userName) {
    return userName ? `meihua_history_${userName}` : null;
}

export function loadHistory(userName) {
    const key = getUserHistoryKey(userName);
    if (!key) return [];
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
        log.error('Failed to load history', e);
        return [];
    }
}

export function saveHistory(userName, history) {
    const key = getUserHistoryKey(userName);
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
        // Storage quota exceeded — trim oldest records and retry
        log.warn('Storage quota exceeded, trimming old records');
        while (history.length > 3) {
            history.pop();
            try {
                localStorage.setItem(key, JSON.stringify(history));
                return;
            } catch (_) { /* keep trimming */ }
        }
        throw e;
    }
}

export function addHistoryRecord(userName, record) {
    const history = loadHistory(userName);
    history.unshift(record);
    if (history.length > 50) history.pop();
    saveHistory(userName, history);
    return history;
}

export function deleteHistoryRecord(userName, recordId) {
    let history = loadHistory(userName);
    history = history.filter(r => String(r.id) !== String(recordId));
    saveHistory(userName, history);
    return history;
}

// ============================================
// Feedback Storage (Self-Iteration Learning)
// ============================================
const FEEDBACK_KEY_PREFIX = 'meihua_feedback_';
const MAX_FEEDBACK = 30;

export function loadFeedback(userName) {
    if (!userName) return [];
    try {
        return JSON.parse(localStorage.getItem(FEEDBACK_KEY_PREFIX + userName) || '[]');
    } catch (e) {
        log.error('Failed to load feedback', e);
        return [];
    }
}

export function saveFeedback(userName, feedbackList) {
    if (!userName) return;
    try {
        localStorage.setItem(FEEDBACK_KEY_PREFIX + userName, JSON.stringify(feedbackList));
    } catch (e) {
        log.warn('Feedback storage quota exceeded, trimming');
        while (feedbackList.length > 5) {
            feedbackList.pop();
            try {
                localStorage.setItem(FEEDBACK_KEY_PREFIX + userName, JSON.stringify(feedbackList));
                return;
            } catch (_) { /* keep trimming */ }
        }
    }
}

export function addFeedbackRecord(userName, record) {
    const list = loadFeedback(userName);
    list.unshift(record);
    if (list.length > MAX_FEEDBACK) list.pop();
    saveFeedback(userName, list);
    return list;
}
