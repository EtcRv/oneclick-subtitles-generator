import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/LyricsDisplay.css';
import TimelineVisualization from './lyrics/TimelineVisualization';
import LyricItem from './lyrics/LyricItem';
import LyricsHeader from './lyrics/LyricsHeader';
import { useLyricsEditor } from '../hooks/useLyricsEditor';
import { VariableSizeList as List } from 'react-window';

// Virtualized row renderer for lyrics
const VirtualizedLyricRow = ({ index, style, data }) => {
  const {
    lyrics,
    currentIndex,
    currentTime,
    allowEditing,
    isDragging,
    onLyricClick,
    onMouseDown,
    getLastDragEnd,
    onDelete,
    onTextEdit,
    onInsert,
    onMerge,
    timeFormat
  } = data;

  const lyric = lyrics[index];
  const hasNextLyric = index < lyrics.length - 1;

  return (
    <div style={style}>
      <LyricItem
        key={index}
        lyric={lyric}
        index={index}
        isCurrentLyric={index === currentIndex}
        currentTime={currentTime}
        allowEditing={allowEditing}
        isDragging={isDragging}
        onLyricClick={onLyricClick}
        onMouseDown={onMouseDown}
        getLastDragEnd={getLastDragEnd}
        onDelete={onDelete}
        onTextEdit={onTextEdit}
        onInsert={onInsert}
        onMerge={onMerge}
        hasNextLyric={hasNextLyric}
        timeFormat={timeFormat}
      />
    </div>
  );
};

const LyricsDisplay = ({
  matchedLyrics,
  currentTime,
  onLyricClick,
  duration,
  onUpdateLyrics,
  allowEditing = false,
  seekTime = null,
  timeFormat = 'seconds'
}) => {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [centerTimelineAt, setCenterTimelineAt] = useState(null);
  const rowHeights = useRef({});

  // Function to calculate row height based on text content
  const getRowHeight = index => {
    // If we already calculated this height, return it
    if (rowHeights.current[index] !== undefined) {
      return rowHeights.current[index];
    }

    const lyric = matchedLyrics[index];
    if (!lyric) return 50; // Default height

    // Calculate height based on text length
    const text = lyric.text || '';
    const lineCount = text.split('\n').length; // Count actual line breaks
    const estimatedLines = Math.ceil(text.length / 40); // Estimate based on characters per line
    const lines = Math.max(lineCount, estimatedLines);

    // Base height + additional height per line
    const height = 50 + (lines > 1 ? (lines - 1) * 20 : 0);

    // Cache the calculated height
    rowHeights.current[index] = height;
    return height;
  };

  // Reset row heights when lyrics change
  useEffect(() => {
    rowHeights.current = {};
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [matchedLyrics]);

  const {
    lyrics,
    isSticky,
    setIsSticky,
    isAtOriginalState,
    canUndo,
    handleUndo,
    handleReset,
    startDrag,
    handleDrag,
    endDrag,
    isDragging,
    getLastDragEnd,
    handleDeleteLyric,
    handleTextEdit,
    handleInsertLyric,
    handleMergeLyrics
  } = useLyricsEditor(matchedLyrics, onUpdateLyrics);

  // Find current lyric index based on time
  const currentIndex = lyrics.findIndex((lyric, index) => {
    const nextLyric = lyrics[index + 1];
    return currentTime >= lyric.start &&
      (nextLyric ? currentTime < nextLyric.start : currentTime <= lyric.end);
  });

  // Reference to the virtualized list
  const listRef = useRef(null);

  // Auto-scroll to the current lyric with accurate positioning
  useEffect(() => {
    if (currentIndex >= 0 && listRef.current) {
      // Scroll to the current index in the virtualized list
      listRef.current.scrollToItem(currentIndex, 'center');
    }
  }, [currentIndex]);

  // Watch for seekTime changes to center the timeline
  useEffect(() => {
    if (seekTime !== null) {
      // Center the timeline on the seek time
      setCenterTimelineAt(seekTime);

      console.log(`Centering timeline on video seek: ${seekTime}s`);
    }
  }, [seekTime]);

  // Setup drag event handlers with performance optimizations
  const handleMouseDown = (e, index, field) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(index, field, e.clientX, lyrics[index][field]);

    // Use passive event listeners for better performance
    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp, { passive: false });

    // Add a class to the body to indicate dragging is in progress
    document.body.classList.add('lyrics-dragging');
  };

  // Use a throttled mouse move handler
  const lastMoveTimeRef = useRef(0);
  const handleMouseMove = (e) => {
    e.preventDefault();

    // Throttle mousemove events
    const now = performance.now();
    if (now - lastMoveTimeRef.current < 16) { // ~60fps
      return;
    }
    lastMoveTimeRef.current = now;

    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
      handleDrag(e.clientX, duration);
    });
  };

  const handleMouseUp = (e) => {
    e.preventDefault();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.classList.remove('lyrics-dragging');
    endDrag();
  };

  return (
    <div className={`lyrics-display ${Object.keys(isDragging()).length > 0 ? 'dragging-active' : ''}`}>
      <LyricsHeader
        allowEditing={allowEditing}
        isSticky={isSticky}
        setIsSticky={setIsSticky}
        canUndo={canUndo}
        isAtOriginalState={isAtOriginalState}
        onUndo={handleUndo}
        onReset={handleReset}
        zoom={zoom}
        setZoom={setZoom}
        panOffset={panOffset}
        setPanOffset={setPanOffset}
      />

      <TimelineVisualization
        lyrics={lyrics}
        currentTime={currentTime}
        duration={duration}
        onTimelineClick={onLyricClick}
        zoom={zoom}
        panOffset={panOffset}
        setPanOffset={setPanOffset}
        centerOnTime={centerTimelineAt}
        timeFormat={timeFormat}
      />

      <div className="lyrics-container-wrapper">
        {lyrics.length > 0 && (
          <List
            ref={listRef}
            className="lyrics-container"
            height={300} // Reduced height for more compact view
            width="100%"
            itemCount={lyrics.length}
            itemSize={getRowHeight} // Dynamic row heights based on content
            overscanCount={5} // Number of items to render outside of the visible area
            itemData={{
              lyrics,
              currentIndex,
              currentTime,
              allowEditing,
              isDragging,
              onLyricClick: (time) => {
                // Center the timeline on the clicked lyric
                setCenterTimelineAt(time);
                // Reset the center time in the next frame to allow future clicks to work
                requestAnimationFrame(() => {
                  setCenterTimelineAt(null);
                });
                // Call the original onLyricClick function
                onLyricClick(time);
              },
              onMouseDown: handleMouseDown,
              getLastDragEnd,
              onDelete: handleDeleteLyric,
              onTextEdit: handleTextEdit,
              onInsert: handleInsertLyric,
              onMerge: handleMergeLyrics,
              timeFormat
            }}
          >
            {VirtualizedLyricRow}
          </List>
        )}
      </div>

      {allowEditing && (
        <div className="help-text">
          <p>{t('lyrics.timingInstructions')}</p>
        </div>
      )}
    </div>
  );
};

export default LyricsDisplay;