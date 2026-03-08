/**
 * Shared Application State
 * Central state object accessible by all controllers
 */
import { getCurrentUser } from '../storage/auth.js';

const state = {
    currentUser: getCurrentUser(),
    history: [],
    currentResult: null,
    lastRecordId: null,
    selectedModelKey: 'sf-deepseek-r1',
    modelAnalyses: [],
    currentAbortController: null,
    isPaused: false,
    stopCurrentThinkingProgress: null,  // cleanup fn for the active thinking timer
    // For continue-after-stop
    interruptedCtx: null,  // { targetEl, messages, partialContent, partialReasoning, question, renderHistory }
    // For comparison (model switch)
    lastAnalysisCtx: null,  // { msgEl, modelKey, question }
    pendingModelComparison: false
};

export default state;
