/**
 * Gemini API Service
 * Main export file for all Gemini API functionality
 */

// Export core API functionality
import { callGeminiApi } from './core';

// Export request management functionality
import {
    abortAllRequests,
    getProcessingForceStopped,
    setProcessingForceStopped
} from './requestManagement';

// Export prompt management functionality
import {
    PROMPT_PRESETS,
    DEFAULT_TRANSCRIPTION_PROMPT,
    getUserPromptPresets,
    saveUserPromptPresets,
    getDefaultTranslationPrompt,
    getDefaultConsolidatePrompt,
    getDefaultSummarizePrompt
} from './promptManagement';

// Export translation functionality
import { translateSubtitles, cancelTranslation } from './translation';

// Export document processing functionality
import { completeDocument, summarizeDocument } from './documentProcessingService';

// Export WebSocket client
import { GeminiWebSocketClient } from './client/GeminiWebSocketClient';

// Export audio utilities
import {
    convertPcmBase64ToWavBase64,
    createWavFromPcm,
    base64ToArrayBuffer,
    writeString
} from './utils/audioUtils';

// Export blob utilities
import { blobToJSON } from './utils/blobUtils';

// Export aliases for backward compatibility
const transcribeVideo = callGeminiApi;
const transcribeAudio = callGeminiApi;
const transcribeYouTubeVideo = callGeminiApi;

// Export all functionality
export {
    // Core API
    callGeminiApi,

    // Request management
    abortAllRequests,
    getProcessingForceStopped,
    setProcessingForceStopped,

    // Prompt management
    PROMPT_PRESETS,
    DEFAULT_TRANSCRIPTION_PROMPT,
    getUserPromptPresets,
    saveUserPromptPresets,
    getDefaultTranslationPrompt,
    getDefaultConsolidatePrompt,
    getDefaultSummarizePrompt,

    // Translation
    translateSubtitles,
    cancelTranslation,

    // Document processing
    completeDocument,
    summarizeDocument,

    // WebSocket client
    GeminiWebSocketClient,

    // Audio utilities
    convertPcmBase64ToWavBase64,
    createWavFromPcm,
    base64ToArrayBuffer,
    writeString,

    // Blob utilities
    blobToJSON,

    // Aliases for backward compatibility
    transcribeVideo,
    transcribeAudio,
    transcribeYouTubeVideo
};
