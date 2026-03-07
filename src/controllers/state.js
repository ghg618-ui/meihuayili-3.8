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
    selectedModelKey: 'deepseek-combined',
    selectedMode: 'simple',
    modelAnalyses: [],
    currentAbortController: null,
    isPaused: false,
    // For continue-after-stop
    interruptedCtx: null,  // { targetEl, messages, partialContent, partialReasoning, question, renderHistory }
    // For comparison (mode or model switch)
    lastAnalysisCtx: null,  // { msgEl, mode, modelKey, question }
    pendingModelComparison: false
};

export default state;
