import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAudioUrl } from '../../services/narrationService';
import useNarrationHandlers from './hooks/useNarrationHandlers';

// Import custom hooks
import useNarrationState from './hooks/useNarrationState';
import useAvailabilityCheck from './hooks/useAvailabilityCheck';
import useGeminiNarration from './hooks/useGeminiNarration';
import useAudioPlayback from './hooks/useAudioPlayback';
import useNarrationStorage from './hooks/useNarrationStorage';
import useUIEffects from './hooks/useUIEffects';

// Import modular components
import ReferenceAudioSection from './components/ReferenceAudioSection';
import AudioControls from './components/AudioControls';
import SubtitleSourceSelection from './components/SubtitleSourceSelection';
import GeminiSubtitleSourceSelection from './components/GeminiSubtitleSourceSelection';
import GeminiSleepTimeSlider from './components/GeminiSleepTimeSlider';
import GeminiVoiceSelection from './components/GeminiVoiceSelection';
import AdvancedSettingsToggle from './components/AdvancedSettingsToggle';
import GenerateButton from './components/GenerateButton';
import GeminiGenerateButton from './components/GeminiGenerateButton';
import NarrationResults from './components/NarrationResults';
import GeminiNarrationResults from './components/GeminiNarrationResults';
import StatusMessage from './components/StatusMessage';
import NarrationMethodSelection from './components/NarrationMethodSelection';

// Import styles
import '../../styles/narration/unifiedNarrationRedesign.css';

/**
 * Unified Narration Section component that combines settings and generation
 * @param {Object} props - Component props
 * @param {Array} props.subtitles - Subtitles to generate narration for (fallback)
 * @param {Array} props.originalSubtitles - Original subtitles
 * @param {Array} props.translatedSubtitles - Translated subtitles (optional)
 * @param {string} props.videoPath - Path to the current video (optional)
 * @param {Function} props.onReferenceAudioChange - Callback when reference audio changes
 * @param {Object} props.referenceAudio - Initial reference audio
 * @returns {JSX.Element} - Rendered component
 */
const UnifiedNarrationSection = ({
  subtitles,
  originalSubtitles,
  translatedSubtitles,
  videoPath,
  onReferenceAudioChange,
  referenceAudio: initialReferenceAudio
}) => {
  const { t } = useTranslation();

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const statusRef = useRef(null);

  // Use custom hooks for state management
  const narrationState = useNarrationState(initialReferenceAudio);

  // Destructure state from the hook
  const {
    // Narration Method state
    narrationMethod, setNarrationMethod,
    isGeminiAvailable, setIsGeminiAvailable,

    // Gemini-specific settings
    sleepTime, setSleepTime,
    selectedVoice, setSelectedVoice,

    // Narration Settings state (for F5-TTS)
    referenceAudio, setReferenceAudio,
    referenceText, setReferenceText,
    isRecording, setIsRecording,
    /* recordedAudio, */ setRecordedAudio,
    isExtractingSegment, setIsExtractingSegment,
    segmentStartTime, segmentEndTime,
    autoRecognize, setAutoRecognize,
    isRecognizing, setIsRecognizing,

    // Narration Generation state
    isAvailable, setIsAvailable,
    isGenerating, setIsGenerating,
    generationStatus, setGenerationStatus,
    generationResults, setGenerationResults,
    error, setError,
    currentAudio, setCurrentAudio,
    isPlaying, setIsPlaying,
    subtitleSource, setSubtitleSource,
    advancedSettings, setAdvancedSettings,
    originalLanguage, setOriginalLanguage,
    translatedLanguage, setTranslatedLanguage,
    retryingSubtitleId, setRetryingSubtitleId,
    selectedNarrationModel,

    // Helper functions
    updateReferenceAudio
  } = narrationState;

  // Use availability check hook
  useAvailabilityCheck({
    narrationMethod,
    setIsAvailable,
    setIsGeminiAvailable,
    setError,
    t
  });

  // Use Gemini narration hook
  const {
    handleGeminiNarration,
    cancelGeminiGeneration,
    retryGeminiNarration
  } = useGeminiNarration({
    setIsGenerating,
    setGenerationStatus,
    setError,
    setGenerationResults,
    generationResults,
    subtitleSource,
    originalSubtitles,
    translatedSubtitles,
    subtitles,
    originalLanguage,
    translatedLanguage,
    sleepTime,
    selectedVoice,
    t,
    setRetryingSubtitleId
  });

  // Custom function to retry all failed Gemini narrations
  const retryFailedGeminiNarrations = async () => {
    // Find all failed narrations
    const failedNarrations = generationResults.filter(result => !result.success);

    if (failedNarrations.length === 0) {
      setError(t('narration.noFailedNarrationsError', 'No failed narrations to retry'));
      return;
    }

    // Clear any previous errors
    setError('');

    // Set status for retrying failed narrations
    setGenerationStatus(t('narration.retryingFailedNarrations', 'Retrying {{count}} failed narrations...', { count: failedNarrations.length }));

    // Process each failed narration one by one
    for (let i = 0; i < failedNarrations.length; i++) {
      const failedNarration = failedNarrations[i];
      const subtitleId = failedNarration.subtitle_id;

      // Set retrying state
      setRetryingSubtitleId(subtitleId);

      // Update status
      setGenerationStatus(t('narration.retryingFailedNarrationProgress', 'Retrying failed narration {{current}} of {{total}} (ID: {{id}})...', {
        current: i + 1,
        total: failedNarrations.length,
        id: subtitleId
      }));

      try {
        // Retry this specific narration
        await retryGeminiNarration(subtitleId);

        // Add a small delay between retries to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error retrying Gemini narration for subtitle ${subtitleId}:`, error);
        // Continue with the next failed narration
      }
    }

    // Clear retrying state
    setRetryingSubtitleId(null);

    // Update status
    setGenerationStatus(t('narration.retryingFailedNarrationsComplete', 'Completed retrying all failed narrations'));
  };

  // Use audio playback hook
  const { audioRef, handleAudioEnded } = useAudioPlayback({
    isPlaying,
    currentAudio,
    setIsPlaying
  });

  // Use narration storage hook
  useNarrationStorage({
    generationResults,
    subtitleSource
  });

  // Use UI effects hook
  useUIEffects({
    isGenerating,
    generationStatus,
    statusRef,
    t,
    referenceAudio,
    referenceText,
    segmentStartTime,
    segmentEndTime,
    setError
  });

  // Update reference audio when initialReferenceAudio changes
  useEffect(() => {
    updateReferenceAudio(initialReferenceAudio);
  }, [initialReferenceAudio, updateReferenceAudio]);

  // Listen for narrations loaded from cache event
  useEffect(() => {
    const handleNarrationsLoadedFromCache = (event) => {
      if (event.detail && event.detail.narrations) {
        console.log('Received narrations loaded from cache event:', event.detail);

        // Only update if we don't already have results
        if (!generationResults || generationResults.length === 0) {
          // Get the narrations from the event
          const cachedNarrations = event.detail.narrations;

          // Immediately update the generation results
          setGenerationResults(cachedNarrations);

          // Show a status message
          setGenerationStatus(t('narration.loadedFromCache', 'Loaded narrations from previous session'));

          // Update global narration references
          if (subtitleSource === 'original') {
            window.originalNarrations = [...cachedNarrations];
            try {
              localStorage.setItem('originalNarrations', JSON.stringify(cachedNarrations));
            } catch (e) {
              console.error('Error storing originalNarrations in localStorage:', e);
            }
          } else {
            window.translatedNarrations = [...cachedNarrations];
            try {
              localStorage.setItem('translatedNarrations', JSON.stringify(cachedNarrations));
            } catch (e) {
              console.error('Error storing translatedNarrations in localStorage:', e);
            }
          }

          // Dispatch a custom event to notify other components
          const updateEvent = new CustomEvent('narrations-updated', {
            detail: {
              source: subtitleSource,
              narrations: cachedNarrations,
              fromCache: true
            }
          });
          window.dispatchEvent(updateEvent);

          // Force a re-render after a short delay to ensure the UI updates
          setTimeout(() => {
            console.log('Forcing re-render after loading narrations from cache');
            setGenerationStatus(t('narration.loadedFromCacheComplete', 'Successfully loaded narrations from previous session'));
          }, 200);
        }
      }
    };

    // Add event listener
    window.addEventListener('narrations-loaded-from-cache', handleNarrationsLoadedFromCache);

    // Clean up
    return () => {
      window.removeEventListener('narrations-loaded-from-cache', handleNarrationsLoadedFromCache);
    };
  }, [generationResults, setGenerationResults, setGenerationStatus, subtitleSource, t]);

  // Import the handler functions from separate file to keep this component clean
  const {
    handleFileUpload,
    startRecording,
    stopRecording,
    // extractSegment is available but not used in this component
    extractSegment: _extractSegment,
    clearReferenceAudio,
    handleGenerateNarration,
    playAudio,
    downloadAllAudio,
    downloadAlignedAudio,
    cancelGeneration,
    retryF5TTSNarration,
    retryFailedNarrations
  } = useNarrationHandlers({
    fileInputRef,
    mediaRecorderRef,
    audioChunksRef,
    referenceAudio,
    referenceText,
    setReferenceAudio,
    setReferenceText,
    setRecordedAudio,
    setIsRecording,
    setIsExtractingSegment,
    setIsRecognizing,
    setError,
    autoRecognize,
    segmentStartTime,
    segmentEndTime,
    videoPath,
    onReferenceAudioChange,
    getSelectedSubtitles: () => {
      if (subtitleSource === 'translated' && translatedSubtitles && translatedSubtitles.length > 0) {
        return translatedSubtitles;
      }
      return originalSubtitles || subtitles;
    },
    advancedSettings,
    setIsGenerating,
    isGenerating,
    setGenerationStatus,
    setGenerationResults,
    generationResults,
    currentAudio,
    setCurrentAudio,
    setIsPlaying,
    statusRef,
    t,
    subtitleSource,
    translatedSubtitles,
    isPlaying,
    selectedNarrationModel,
    originalLanguage,
    translatedLanguage,
    setRetryingSubtitleId
  });

  // Only show the unavailable message if both F5-TTS and Gemini are unavailable
  if (!isAvailable && !isGeminiAvailable) {
    return (
      <div className="narration-section unavailable">
        <div className="narration-header">
          <h3>
            {t('narration.title', 'Generate Narration')}
            <span className="service-unavailable">
              {t('narration.serviceUnavailableIndicator', '(Service Unavailable)')}
            </span>
          </h3>
        </div>
        <div className="narration-unavailable-message">
          <div className="warning-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div className="message">
            {t('narration.allServicesUnavailableMessage', "Both F5-TTS and Gemini narration services are unavailable. For F5-TTS, please run with npm run dev:cuda. For Gemini, please check your API key in settings.")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="narration-section">
      <div className="narration-header">
        <h3>{t('narration.title', 'Generate Narration')}</h3>
        <p className="narration-description">
          {t('narration.description', 'Generate spoken audio from your subtitles using the reference voice.')}
        </p>
      </div>

      {/* Narration Method Selection */}
      <NarrationMethodSelection
        narrationMethod={narrationMethod}
        setNarrationMethod={setNarrationMethod}
        isGenerating={isGenerating}
        isF5Available={isAvailable}
        isGeminiAvailable={isGeminiAvailable}
      />

      {/* Error Message */}
      <StatusMessage message={error} type="error" />

      {narrationMethod === 'f5tts' ? (
        // F5-TTS UI
        <>
          {/* Audio Controls */}
          <AudioControls
            handleFileUpload={handleFileUpload}
            fileInputRef={fileInputRef}
            isRecording={isRecording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            isAvailable={isAvailable}
            referenceAudio={referenceAudio}
            clearReferenceAudio={clearReferenceAudio}
          />

          {/* Reference Audio Section */}
          <ReferenceAudioSection
            referenceAudio={referenceAudio}
            autoRecognize={autoRecognize}
            setAutoRecognize={setAutoRecognize}
            isRecognizing={isRecognizing}
            referenceText={referenceText}
            setReferenceText={setReferenceText}
            clearReferenceAudio={clearReferenceAudio}
            isRecording={isRecording}
            isExtractingSegment={isExtractingSegment}
          />

          {/* Subtitle Source Selection */}
          <SubtitleSourceSelection
            subtitleSource={subtitleSource}
            setSubtitleSource={setSubtitleSource}
            isGenerating={isGenerating}
            translatedSubtitles={translatedSubtitles}
            originalSubtitles={originalSubtitles || subtitles}
            originalLanguage={originalLanguage}
            translatedLanguage={translatedLanguage}
            setOriginalLanguage={setOriginalLanguage}
            setTranslatedLanguage={setTranslatedLanguage}
            onLanguageDetected={(source, language, modelId, modelError) => {
              console.log(`Language detected for ${source}: ${language.languageCode} (${language.languageName})`);
              console.log(`Selected narration model: ${modelId}`);
              if (modelError) {
                console.warn(`Model availability error: ${modelError}`);
              }

              // Update the appropriate language state
              if (source === 'original') {
                setOriginalLanguage(language);
              } else if (source === 'translated') {
                setTranslatedLanguage(language);
              }

              // Store in localStorage for persistence
              try {
                localStorage.setItem('detected_language', JSON.stringify({
                  source,
                  language,
                  modelId,
                  modelError
                }));
              } catch (e) {
                console.error('Error storing detected language in localStorage:', e);
              }
            }}
          />

          {/* Advanced Settings Toggle */}
          <AdvancedSettingsToggle
            advancedSettings={advancedSettings}
            setAdvancedSettings={setAdvancedSettings}
            isGenerating={isGenerating}
          />

          {/* Generate Button */}
          <GenerateButton
            handleGenerateNarration={handleGenerateNarration}
            isGenerating={isGenerating}
            referenceAudio={referenceAudio}
            generationResults={generationResults}
            downloadAllAudio={downloadAllAudio}
            downloadAlignedAudio={downloadAlignedAudio}
            cancelGeneration={cancelGeneration}
            subtitleSource={subtitleSource}
          />

          {/* Generation Status */}
          <StatusMessage
            message={(isGenerating || retryingSubtitleId) ? generationStatus : ''}
            type="info"
            statusRef={statusRef}
          />

          {/* Results */}
          <NarrationResults
            generationResults={generationResults}
            playAudio={playAudio}
            currentAudio={currentAudio}
            isPlaying={isPlaying}
            getAudioUrl={getAudioUrl}
            onRetry={retryF5TTSNarration}
            retryingSubtitleId={retryingSubtitleId}
            onRetryFailed={retryFailedNarrations}
          />

          {/* Hidden audio player for playback */}
          <audio
            ref={audioRef}
            src={currentAudio?.url}
            onEnded={handleAudioEnded}
            style={{ display: 'none' }}
          />
        </>
      ) : (
        // Gemini UI
        <>
          {/* Simplified Subtitle Source Selection for Gemini */}
          <GeminiSubtitleSourceSelection
            subtitleSource={subtitleSource}
            setSubtitleSource={setSubtitleSource}
            isGenerating={isGenerating}
            translatedSubtitles={translatedSubtitles}
            originalSubtitles={originalSubtitles || subtitles}
            originalLanguage={originalLanguage}
            translatedLanguage={translatedLanguage}
            setOriginalLanguage={setOriginalLanguage}
            setTranslatedLanguage={setTranslatedLanguage}
            onLanguageDetected={(source, language) => {
              console.log(`Language detected for ${source}: ${language.languageCode} (${language.languageName})`);

              // Update the appropriate language state
              if (source === 'original') {
                setOriginalLanguage(language);
              } else if (source === 'translated') {
                setTranslatedLanguage(language);
              }
            }}
          />

          {/* Voice Selection for Gemini */}
          <GeminiVoiceSelection
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            isGenerating={isGenerating}
          />

          {/* Sleep Time Slider for Gemini */}
          <GeminiSleepTimeSlider
            sleepTime={sleepTime}
            setSleepTime={setSleepTime}
            isGenerating={isGenerating}
          />

          {/* Gemini Generate Button */}
          <GeminiGenerateButton
            handleGenerateNarration={handleGeminiNarration}
            isGenerating={isGenerating}
            subtitleSource={subtitleSource}
            cancelGeneration={cancelGeminiGeneration}
          />

          {/* Generation Status */}
          <StatusMessage
            message={(isGenerating || retryingSubtitleId) ? generationStatus : ''}
            type="info"
            statusRef={statusRef}
          />

          {/* Gemini Results */}
          <GeminiNarrationResults
            generationResults={generationResults}
            onRetry={retryGeminiNarration}
            retryingSubtitleId={retryingSubtitleId}
            onRetryFailed={retryFailedGeminiNarrations}
            hasGenerationError={!!error && error.includes('Gemini')}
            subtitleSource={subtitleSource}
          />

          {/* No need for a separate audio element here as it's included in the GeminiNarrationResults component */}
        </>
      )}
    </div>
  );
};

export default UnifiedNarrationSection;
