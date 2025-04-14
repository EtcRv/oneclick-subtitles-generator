import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/ParallelProcessingStatus.css';
import { FiRefreshCw, FiStar, FiAward, FiZap, FiCpu, FiChevronDown, FiFileText, FiEdit } from 'react-icons/fi';
import SegmentRetryModal from './SegmentRetryModal';

/**
 * Component to display the status of parallel segment processing
 * @param {Object} props - Component props
 * @param {Array} props.segments - Array of segment status objects
 * @param {string} props.overallStatus - Overall processing status message
 * @param {string} props.statusType - Status type (loading, success, error, warning)
 * @param {Function} props.onRetrySegment - Function to retry processing a specific segment
 * @param {Function} props.onRetryWithModel - Function to retry processing a segment with a specific model
 * @param {Function} props.onGenerateSegment - Function to generate a specific segment (for strong model)
 * @param {Array} props.retryingSegments - Array of segment indices that are currently being retried
 * @param {Function} props.onViewRules - Function to open the transcription rules editor
 * @param {string} props.userProvidedSubtitles - User-provided subtitles for the whole media
 * @returns {JSX.Element} - Rendered component
 */
const ParallelProcessingStatus = ({
  segments,
  overallStatus,
  statusType,
  onRetrySegment,
  onRetryWithModel,
  onGenerateSegment,
  retryingSegments = [],
  onViewRules,
  userProvidedSubtitles = ''
 }) => {
  const { t } = useTranslation();
  const [openDropdownIndex, setOpenDropdownIndex] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef({});
  const [rulesAvailable, setRulesAvailable] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(null);

  // Calculate dropdown position when a button is clicked
  const calculateDropdownPosition = (index) => {
    if (buttonRefs.current[index]) {
      const buttonRect = buttonRefs.current[index].getBoundingClientRect();
      const dropdownHeight = 232; // Approximate height of dropdown (4 model options + header)

      // Check if there's enough space above the button
      const spaceAbove = buttonRect.top;
      const spaceBelow = window.innerHeight - buttonRect.bottom;

      let top;
      if (spaceAbove >= dropdownHeight + 8 || spaceAbove > spaceBelow) {
        // Position above if there's enough space or more space above than below
        top = buttonRect.top - dropdownHeight - 8; // Position above with 8px gap
      } else {
        // Otherwise position below
        top = buttonRect.bottom + 8;
      }

      const left = Math.max(buttonRect.left - 240, 10); // Align to left of button, but keep on screen

      setDropdownPosition({ top, left });
    }
  };

  // Toggle dropdown and calculate position
  const toggleDropdown = (e, index) => {
    e.stopPropagation();

    if (openDropdownIndex === index) {
      setOpenDropdownIndex(null);
    } else {
      calculateDropdownPosition(index);
      setOpenDropdownIndex(index);
    }
  };

  // Check if transcription rules are available
  useEffect(() => {
    const checkRulesAvailability = async () => {
      try {
        // Dynamically import to avoid circular dependencies
        const { getTranscriptionRules } = await import('../utils/transcriptionRulesStore');
        const rules = getTranscriptionRules();
        setRulesAvailable(!!rules);
      } catch (error) {
        console.error('Error checking transcription rules availability:', error);
        setRulesAvailable(false);
      }
    };

    checkRulesAvailability();
  }, []);

  // Close dropdown when clicking outside and handle scroll/resize
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if the click is outside any dropdown
      const dropdowns = document.querySelectorAll('.model-dropdown');
      const buttons = document.querySelectorAll('.segment-retry-btn');
      let clickedInsideDropdown = false;

      dropdowns.forEach(dropdown => {
        if (dropdown.contains(event.target)) {
          clickedInsideDropdown = true;
        }
      });

      buttons.forEach(button => {
        if (button.contains(event.target)) {
          clickedInsideDropdown = true;
        }
      });

      if (!clickedInsideDropdown) {
        setOpenDropdownIndex(null);
      }
    };

    // Handle window resize
    const handleResize = () => {
      if (openDropdownIndex !== null) {
        calculateDropdownPosition(openDropdownIndex);
      }
    };

    // Handle window scroll
    const handleScroll = () => {
      if (openDropdownIndex !== null) {
        // Recalculate dropdown position when scrolling
        calculateDropdownPosition(openDropdownIndex);
      }
    };

    document.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [openDropdownIndex]);

  if (!segments || segments.length === 0) {
    return (
      <div className={`status ${statusType}`}>
        {overallStatus}
      </div>
    );
  }

  // Handle opening the retry modal
  const handleOpenRetryModal = (index) => {
    setSelectedSegmentIndex(index);
    setShowRetryModal(true);
  };

  // Handle retry with custom subtitles
  const handleRetryWithOptions = (segmentIndex, segments, options) => {
    onRetrySegment(segmentIndex, segments, options);
  };

  return (
    <div className={`parallel-processing-container ${openDropdownIndex !== null ? 'model-dropdown-open' : ''}`}>
      <div className={`status ${statusType}`}>
        {overallStatus}
      </div>

      {/* Segment Retry Modal */}
      {showRetryModal && selectedSegmentIndex !== null && (
        <SegmentRetryModal
          isOpen={showRetryModal}
          onClose={() => setShowRetryModal(false)}
          segmentIndex={selectedSegmentIndex}
          segments={segments}
          onRetry={handleRetryWithOptions}
          userProvidedSubtitles={userProvidedSubtitles}
        />
      )}

      <div className="segments-status">
        <div className="segments-status-header">
          <h4>{t('output.segmentsStatus', 'Segments Status')}</h4>
          {rulesAvailable && onViewRules && (
            <button
              className="view-rules-button"
              onClick={onViewRules}
              title={t('output.viewRules', 'View transcription rules')}
            >
              <FiFileText size={14} />
              <span>{t('output.viewRules', 'View Rules')}</span>
            </button>
          )}
        </div>
        <div className="segments-grid">
          {segments.map((segment, index) => (
            <div
              key={index}
              className={`segment-status ${segment.status}`}
              title={segment.message}
            >
              <span className="segment-number">{index + 1}</span>
              <span className="segment-indicator"></span>
              <div className="segment-info">
                <span className="segment-message">{segment.shortMessage || segment.status}</span>
                {segment.timeRange && (
                  <span className="segment-time-range">{segment.timeRange}</span>
                )}
              </div>
              {/* Show generate button for pending segments */}
              {segment.status === 'pending' && !retryingSegments.includes(index) && onGenerateSegment && (
                <button
                  className="segment-generate-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Generate button clicked for segment', index);
                    onGenerateSegment(index);
                  }}
                  title={t('output.generateSegmentTooltip', 'Process this segment')}
                >
                  {t('output.generateSegment', 'Generate')}
                </button>
              )}

              {/* Show retry button with dropdown for completed segments that aren't currently being retried */}
              {(segment.status === 'success' || segment.status === 'error') && !retryingSegments.includes(index) && onRetryWithModel && (
                <div className="model-retry-dropdown-container">
                  {/* Retry button - changed to div with role="button" */}
                  <div
                    className={`segment-retry-btn ${openDropdownIndex === index ? 'active-dropdown-btn' : ''}`}
                    onClick={(e) => toggleDropdown(e, index)}
                    title={t('output.retryWithModel', 'Retry with different model')}
                    ref={el => buttonRefs.current[index] = el}
                    role="button"
                    tabIndex="0"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        toggleDropdown(e, index);
                      }
                    }}
                  >
                    <FiRefreshCw size={14} />
                    <FiChevronDown size={10} className="dropdown-icon" />
                  </div>

                  {/* Model dropdown */}
                  {openDropdownIndex === index && (
                    <div
                      className="model-dropdown"
                      style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`
                      }}
                    >
                      <div className="model-dropdown-header">
                        {t('output.selectModel', 'Select model for retry')}
                      </div>

                      {/* Gemini 2.5 Pro */}
                      <div
                        className="model-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Retry with Gemini 2.5 Pro for segment', index);
                          onRetryWithModel(index, 'gemini-2.5-pro-exp-03-25');
                          setOpenDropdownIndex(null);
                        }}
                        role="button"
                        tabIndex="0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onRetryWithModel(index, 'gemini-2.5-pro-exp-03-25');
                            setOpenDropdownIndex(null);
                          }
                        }}
                      >
                        <div className="model-option-icon model-pro">
                          <FiStar size={14} />
                        </div>
                        <div className="model-option-text">
                          <div className="model-option-name">{t('models.gemini25Pro', 'Gemini 2.5 Pro')}</div>
                          <div className="model-option-desc">{t('models.bestAccuracy', 'Best accuracy')}</div>
                        </div>
                      </div>

                      {/* Gemini 2.0 Flash Thinking */}
                      <div
                        className="model-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Retry with Gemini 2.0 Flash Thinking for segment', index);
                          onRetryWithModel(index, 'gemini-2.0-flash-thinking-exp-01-21');
                          setOpenDropdownIndex(null);
                        }}
                        role="button"
                        tabIndex="0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onRetryWithModel(index, 'gemini-2.0-flash-thinking-exp-01-21');
                            setOpenDropdownIndex(null);
                          }
                        }}
                      >
                        <div className="model-option-icon model-thinking">
                          <FiAward size={14} />
                        </div>
                        <div className="model-option-text">
                          <div className="model-option-name">{t('models.gemini20FlashThinking', 'Gemini 2.0 Flash Thinking')}</div>
                          <div className="model-option-desc">{t('models.highAccuracy', 'High accuracy')}</div>
                        </div>
                      </div>

                      {/* Gemini 2.0 Flash */}
                      <div
                        className="model-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Retry with Gemini 2.0 Flash for segment', index);
                          onRetryWithModel(index, 'gemini-2.0-flash');
                          setOpenDropdownIndex(null);
                        }}
                        role="button"
                        tabIndex="0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onRetryWithModel(index, 'gemini-2.0-flash');
                            setOpenDropdownIndex(null);
                          }
                        }}
                      >
                        <div className="model-option-icon model-flash">
                          <FiZap size={14} />
                        </div>
                        <div className="model-option-text">
                          <div className="model-option-name">{t('models.gemini20Flash', 'Gemini 2.0 Flash')}</div>
                          <div className="model-option-desc">{t('models.balancedModel', 'Balanced')}</div>
                        </div>
                      </div>

                      {/* Gemini 2.0 Flash Lite */}
                      <div
                        className="model-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Retry with Gemini 2.0 Flash Lite for segment', index);
                          onRetryWithModel(index, 'gemini-2.0-flash-lite');
                          setOpenDropdownIndex(null);
                        }}
                        role="button"
                        tabIndex="0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onRetryWithModel(index, 'gemini-2.0-flash-lite');
                            setOpenDropdownIndex(null);
                          }
                        }}
                      >
                        <div className="model-option-icon model-lite">
                          <FiCpu size={14} />
                        </div>
                        <div className="model-option-text">
                          <div className="model-option-name">{t('models.gemini20FlashLite', 'Gemini 2.0 Flash Lite')}</div>
                          <div className="model-option-desc">{t('models.fastestModel', 'Fastest')}</div>
                        </div>
                      </div>

                      {/* Custom Subtitles Option */}
                      <div className="model-option-divider"></div>
                      <div
                        className="model-option custom-subtitles-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Opening custom subtitles modal for segment', index);
                          setOpenDropdownIndex(null);
                          handleOpenRetryModal(index);
                        }}
                        role="button"
                        tabIndex="0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setOpenDropdownIndex(null);
                            handleOpenRetryModal(index);
                          }
                        }}
                      >
                        <div className="model-option-icon model-custom">
                          <FiEdit size={14} />
                        </div>
                        <div className="model-option-text">
                          <div className="model-option-name">{t('segmentRetry.customSubtitles', 'Custom Subtitles')}</div>
                          <div className="model-option-desc">{t('segmentRetry.provideSubtitles', 'Provide your own text')}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Show spinning refresh icon for segments that are currently being retried */}
              {(segment.status === 'retrying' || retryingSegments.includes(index)) && (
                <span className="segment-retrying-indicator" title={t('output.retryingSegment', 'Retrying this segment...')}>
                  <FiRefreshCw size={14} className="spinning" />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ParallelProcessingStatus;
