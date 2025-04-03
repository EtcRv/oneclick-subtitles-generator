import React, { useState, useRef } from 'react';

const LyricItem = ({ 
  lyric, 
  index, 
  isCurrentLyric, 
  currentTime,
  allowEditing,
  isDragging,
  onLyricClick,
  onMouseDown,
  getLastDragEnd,
  onDelete,
  onTextEdit
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(lyric.text);
  const textInputRef = useRef(null);

  const handleEditClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditText(lyric.text);
    setTimeout(() => textInputRef.current?.focus(), 0);
  };

  const handleTextSubmit = () => {
    if (editText.trim() !== lyric.text) {
      onTextEdit(index, editText.trim());
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(lyric.text);
    }
  };

  return (
    <div
      data-lyric-index={index}
      className={`lyric-item ${isCurrentLyric ? 'current' : ''}`}
      onClick={(e) => {
        if (Date.now() - getLastDragEnd() < 100) {
          return;
        }
        onLyricClick(lyric.start);
      }}
    >
      <div className="lyric-content">
        {allowEditing && (
          <div className="lyric-controls">
            <button
              className="edit-lyric-btn"
              onClick={handleEditClick}
              title="Edit lyric text"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              className="delete-lyric-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(index);
              }}
              title="Delete lyric"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        )}
        
        <div className="lyric-text" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <input
              ref={textInputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleTextSubmit}
              onKeyDown={handleKeyPress}
              className="lyric-text-input"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span onClick={(e) => {
              if (!isEditing) {
                onLyricClick(lyric.start);
              }
            }}>{lyric.text}</span>
          )}
        </div>
        
        {allowEditing && (
          <div className="timing-controls">
            <span
              className={`time-control start-time ${isDragging(index, 'start') ? 'dragging' : ''}`}
              onMouseDown={(e) => onMouseDown(e, index, 'start')}
            >
              {lyric.start.toFixed(2)}s
            </span>
            
            <span className="time-separator">-</span>
            
            <span
              className={`time-control end-time ${isDragging(index, 'end') ? 'dragging' : ''}`}
              onMouseDown={(e) => onMouseDown(e, index, 'end')}
            >
              {lyric.end.toFixed(2)}s
            </span>
          </div>
        )}
      </div>
      
      {isCurrentLyric && (
        <div 
          className="progress-indicator"
          style={{
            width: `${Math.min(100, Math.max(0, ((currentTime - lyric.start) / (lyric.end - lyric.start)) * 100))}%`
          }}
        />
      )}
    </div>
  );
};

export default LyricItem;