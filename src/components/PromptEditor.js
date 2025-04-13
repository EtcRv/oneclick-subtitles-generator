import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/PromptEditor.css';

const PromptEditor = ({
  isOpen,
  onClose,
  initialPrompt,
  onSave,
  title,
  description,
  promptType // Optional prop to explicitly set the prompt type
}) => {
  const { t } = useTranslation();

  // Determine the prompt type based on title or explicit promptType prop
  const getPromptType = () => {
    if (promptType) return promptType;

    if (title) {
      if (title.includes('Translation')) return 'translation';
      if (title.includes('Consolidation')) return 'consolidate';
      if (title.includes('Summarization')) return 'summarize';
    }

    // Default to translation if we can't determine
    return 'translation';
  };

  const currentPromptType = getPromptType();

  // Get the default template based on prompt type
  const getDefaultTemplate = (type) => {
    switch (type) {
      case 'translation':
        return `Translate the following subtitles to {targetLanguage}.\n\n{subtitlesText}`;
      case 'consolidate':
        return `I have a collection of subtitles from a video or audio. Please convert these into a coherent document.\n\nHere are the subtitles:\n\n{subtitlesText}`;
      case 'summarize':
        return `I have a collection of subtitles from a video or audio. Please create a concise summary.\n\nHere are the subtitles:\n\n{subtitlesText}`;
      default:
        return `Translate the following subtitles to {targetLanguage}.\n\n{subtitlesText}`;
    }
  };

  // Get the base template (first line) based on prompt type
  const getBaseTemplate = (type) => {
    switch (type) {
      case 'translation':
        return `Translate the following subtitles to {targetLanguage}.`;
      case 'consolidate':
        return `I have a collection of subtitles from a video or audio. Please convert these into a coherent document.`;
      case 'summarize':
        return `I have a collection of subtitles from a video or audio. Please create a concise summary.`;
      default:
        return `Translate the following subtitles to {targetLanguage}.`;
    }
  };

  // Extract just the custom instructions from the full prompt
  const extractCustomInstructions = (fullPrompt) => {
    // Get the default template for the current prompt type
    const defaultTemplate = getDefaultTemplate(currentPromptType);
    const baseTemplate = getBaseTemplate(currentPromptType);

    // If it's just the default template, return empty string
    if (fullPrompt.trim() === defaultTemplate.trim()) {
      return '';
    }

    // Otherwise, extract the custom part (everything before {subtitlesText})
    const subtitlesTextIndex = fullPrompt.indexOf('{subtitlesText}');
    if (subtitlesTextIndex > 0) {
      // Get everything before {subtitlesText} except the default text
      const beforeDefault = `${baseTemplate}\n\n`;
      const customPart = fullPrompt.substring(0, subtitlesTextIndex).replace(beforeDefault, '');
      return customPart.trim();
    }

    return '';
  };

  // Combine custom instructions with the default template
  const createFullPrompt = (customInstructions) => {
    const baseTemplate = getBaseTemplate(currentPromptType);

    // If there are custom instructions, add them after the base template
    if (customInstructions && customInstructions.trim()) {
      return `${baseTemplate}\n\n${customInstructions.trim()}\n\n{subtitlesText}`;
    }

    // Otherwise just return the default template
    return `${baseTemplate}\n\n{subtitlesText}`;
  };

  const [customInstructions, setCustomInstructions] = useState(extractCustomInstructions(initialPrompt));
  const modalRef = useRef(null);
  const textareaRef = useRef(null);

  // Focus the textarea when the modal opens and reset custom instructions when prompt type changes
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Reset custom instructions when initialPrompt changes
      setCustomInstructions(extractCustomInstructions(initialPrompt));

      textareaRef.current.focus();
      // Place cursor at the end
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
    }
  }, [isOpen, initialPrompt, currentPromptType, extractCustomInstructions]);

  // No additional effects needed for the simplified prompt editor

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  const handleSave = () => {
    // Convert custom instructions back to full prompt format before saving
    const fullPrompt = createFullPrompt(customInstructions);
    onSave(fullPrompt);
    onClose();
  };

  const handleReset = () => {
    setCustomInstructions('');
  };

  // Simple handler for custom instructions
  const handleChange = (e) => {
    setCustomInstructions(e.target.value);
  };

  // We don't need special handlers for keyDown, cut, or paste anymore
  // since we're only editing custom instructions, not the full prompt with variables

  if (!isOpen) return null;

  return (
    <div className="prompt-editor-overlay">
      <div className="prompt-editor-modal" ref={modalRef}>
        <div className="prompt-editor-header">
          <h3>{title || t('promptEditor.editPrompt', 'Add Custom Instructions')}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="prompt-editor-content">
          <p className="prompt-editor-description">
            {description || t('promptEditor.customizePromptDesc', 'Add your custom instructions below. These will be added to the default prompt.')}
          </p>

          <div className="prompt-editor-default-template">
            <h4>Default Template:</h4>
            <div className="default-template-box">
              {currentPromptType === 'translation' ? (
                <p>Translate the following subtitles to <span className="variable-highlight">{'{targetLanguage}'}</span>.</p>
              ) : currentPromptType === 'consolidate' ? (
                <p>I have a collection of subtitles from a video or audio. Please convert these into a coherent document.</p>
              ) : (
                <p>I have a collection of subtitles from a video or audio. Please create a concise summary.</p>
              )}
              <p className="custom-instructions-placeholder">[Your custom instructions will appear here]</p>
              <p><span className="variable-highlight">{'{subtitlesText}'}</span></p>
            </div>
          </div>

          <div className="prompt-editor-container">
            <label htmlFor="custom-instructions" className="instructions-label">Your Custom Instructions:</label>
            <textarea
              id="custom-instructions"
              ref={textareaRef}
              className="prompt-editor-textarea"
              value={customInstructions}
              onChange={handleChange}
              rows={8}
              placeholder={t('promptEditor.enterPrompt', 'Enter your custom instructions here...')}
            />
          </div>

          <div className="prompt-editor-examples">
            <h4>Examples of Custom Instructions:</h4>
            {title && title.includes('Translation') ? (
              <ul>
                <li>Maintain a formal/informal tone</li>
                <li>Use specific terminology or vocabulary</li>
                <li>Adapt cultural references</li>
                <li>Preserve humor or wordplay when possible</li>
              </ul>
            ) : title && title.includes('Consolidation') ? (
              <ul>
                <li>Organize content by topics or themes</li>
                <li>Maintain chronological order of events</li>
                <li>Preserve technical terminology</li>
                <li>Improve readability while maintaining original meaning</li>
              </ul>
            ) : title && title.includes('Summarization') ? (
              <ul>
                <li>Focus on key points and main ideas</li>
                <li>Highlight important facts and statistics</li>
                <li>Maintain the original tone (formal/informal)</li>
                <li>Include all critical information</li>
              </ul>
            ) : (
              <ul>
                <li>Maintain a formal tone</li>
                <li>Use specific terminology or vocabulary</li>
                <li>Add Japanese translations next to your translated text, wrapped in parentheses</li>
                <li>Preserve important details</li>
              </ul>
            )}
            <p className="prompt-editor-note"><strong>Note:</strong> The system will automatically handle the formatting and structure of the output. You only need to add your custom instructions.</p>
          </div>

          <div className="prompt-editor-actions">
            <button className="secondary-button" onClick={handleReset}>
              {t('promptEditor.reset', 'Clear')}
            </button>
            <button className="primary-button" onClick={handleSave}>
              {t('promptEditor.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptEditor;
