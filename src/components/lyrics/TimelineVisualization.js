import React, { useEffect, useCallback, useRef } from 'react';

const TimelineVisualization = ({ 
  lyrics, 
  currentTime, 
  duration, 
  onTimelineClick,
  zoom,
  panOffset,
  setPanOffset
}) => {
  const timelineRef = useRef(null);
  const lastTimeRef = useRef(0);
  const isPanning = useRef(false);
  const lastPanX = useRef(0);
  const justPanned = useRef(false);
  const animationFrameRef = useRef(null);
  const currentZoomRef = useRef(zoom);

  // Calculate visible time range first, since drawTimeline depends on it
  const getVisibleTimeRange = useCallback(() => {
    const maxLyricTime = lyrics.length > 0 
      ? Math.max(...lyrics.map(lyric => lyric.end))
      : duration;
    const timelineEnd = Math.max(maxLyricTime, duration) * 1.05;
    
    const visibleDuration = timelineEnd / currentZoomRef.current;
    const start = panOffset;
    const end = Math.min(timelineEnd, start + visibleDuration);
    
    // Update currentZoomRef to match external zoom prop
    currentZoomRef.current = zoom;
    
    return { start, end, total: timelineEnd };
  }, [lyrics, duration, panOffset, zoom]);

  // Draw the timeline visualization with optimizations
  const drawTimeline = useCallback(() => {
    const canvas = timelineRef.current;
    if (!canvas || !duration) return;
    
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for non-transparent canvas
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    // Set canvas dimensions with proper DPR handling
    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = displayWidth * dpr;
    const scaledHeight = displayHeight * dpr;
    
    // Only resize canvas if dimensions have changed
    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.scale(dpr, dpr);
    }
    
    // Get computed colors from the container element for theme support
    const computedStyle = getComputedStyle(canvas.parentElement);
    const bgColor = computedStyle.backgroundColor;
    const borderColor = computedStyle.borderColor;
    const textColor = computedStyle.color;
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    
    // Draw background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    const { start: visibleStart, end: visibleEnd, total: timelineEnd } = getVisibleTimeRange();
    const visibleDuration = visibleEnd - visibleStart;
    
    // Function to convert time to x coordinate
    const timeToX = (time) => ((time - visibleStart) / visibleDuration) * displayWidth;
    
    // Calculate proper spacing for time markers based on zoom level
    const timeStep = Math.max(1, Math.ceil(visibleDuration / 15));
    const firstMarker = Math.floor(visibleStart / timeStep) * timeStep;
    
    // Batch time markers drawing
    ctx.beginPath();
    ctx.fillStyle = borderColor;
    
    for (let time = firstMarker; time <= visibleEnd; time += timeStep) {
      const x = timeToX(time);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, displayHeight);
    }
    ctx.stroke();
    
    // Draw time labels
    ctx.font = '10px Arial';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;
    
    for (let time = firstMarker; time <= visibleEnd; time += timeStep) {
      const x = timeToX(time);
      ctx.fillText(`${Math.round(time)}s`, x + 3, 2);
    }
    
    // Optimize lyric segments rendering
    const minSegmentWidth = 2; // Minimum width to render a segment
    const visibleLyrics = lyrics.filter(lyric => {
      if (lyric.end < visibleStart || lyric.start > visibleEnd) return false;
      const startX = timeToX(lyric.start);
      const endX = timeToX(lyric.end);
      return (endX - startX) >= minSegmentWidth;
    });
    
    // Batch render segments
    visibleLyrics.forEach((lyric, index) => {
      const startX = timeToX(lyric.start);
      const endX = timeToX(lyric.end);
      const segmentWidth = endX - startX;
      
      const hue = (index * 30) % 360;
      const isDark = computedStyle.backgroundColor.includes('rgb(30, 30, 30)');
      const lightness = isDark ? '40%' : '60%';
      const alpha = isDark ? '0.8' : '0.7';
      
      ctx.fillStyle = `hsla(${hue}, 70%, ${lightness}, ${alpha})`;
      ctx.fillRect(startX, displayHeight * 0.3, segmentWidth, displayHeight * 0.7);
      
      ctx.strokeStyle = `hsla(${hue}, 70%, ${isDark ? '50%' : '40%'}, 0.9)`;
      ctx.strokeRect(startX, displayHeight * 0.3, segmentWidth, displayHeight * 0.7);
    });
    
    // Draw current time indicator
    if (currentTime >= visibleStart && currentTime <= visibleEnd) {
      const currentX = timeToX(currentTime);
      
      // Use path for better performance
      ctx.beginPath();
      ctx.fillStyle = primaryColor;
      
      // Draw playhead triangle
      ctx.moveTo(currentX - 6, 0);
      ctx.lineTo(currentX + 6, 0);
      ctx.lineTo(currentX, 6);
      ctx.closePath();
      ctx.fill();
      
      // Draw indicator line
      ctx.fillRect(currentX - 1, 0, 3, displayHeight);
    }
  }, [lyrics, currentTime, duration, getVisibleTimeRange]);

  // Throttle zoom animation
  const animateZoom = useCallback((targetZoom) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startZoom = currentZoomRef.current;
    const zoomDiff = targetZoom - startZoom;
    const startTime = performance.now();
    const animDuration = 200; // Reduced animation duration for better performance

    const { start: oldStart, end: oldEnd, total: timelineEnd } = getVisibleTimeRange();
    const oldVisibleDuration = oldEnd - oldStart;
    const oldViewCenter = oldStart + (oldVisibleDuration / 2);

    let lastDrawTime = 0;
    const minDrawInterval = 1000 / 60; // Cap at 60fps

    const animate = (time) => {
      if (time - lastDrawTime < minDrawInterval) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      
      lastDrawTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / animDuration, 1);
      
      // Ease out cubic function for smooth deceleration
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      currentZoomRef.current = startZoom + (zoomDiff * easeOutCubic);
      
      // Calculate new visible duration at current zoom level
      const newVisibleDuration = timelineEnd / currentZoomRef.current;
      
      // Calculate new pan offset to maintain the same view center
      const newStart = oldViewCenter - (newVisibleDuration / 2);
      const boundedStart = Math.min(Math.max(0, newStart), timelineEnd - newVisibleDuration);
      
      setPanOffset(boundedStart);
      drawTimeline();

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        currentZoomRef.current = targetZoom;
        drawTimeline();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [getVisibleTimeRange, setPanOffset, drawTimeline]);

  // Update zoom with animation when zoom prop changes
  useEffect(() => {
    if (zoom !== currentZoomRef.current) {
      animateZoom(zoom);
    }
  }, [zoom, animateZoom]);

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Initialize and handle canvas resize
  useEffect(() => {
    if (timelineRef.current) {
      const canvas = timelineRef.current;
      const container = canvas.parentElement;
      
      const resizeCanvas = () => {
        const rect = container.getBoundingClientRect();
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = '50px';
        drawTimeline();
      };
      
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();
      
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, [drawTimeline]);
  
  // Handle timeline updates
  useEffect(() => {
    if (timelineRef.current && lyrics.length > 0) {
      lastTimeRef.current = currentTime;
      drawTimeline();
    }
  }, [lyrics, currentTime, duration, zoom, panOffset, drawTimeline]);

  // Handle mouse down for panning
  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left click only
      e.preventDefault(); // Prevent text selection
      isPanning.current = true;
      justPanned.current = false; // Reset the panned state
      lastPanX.current = e.clientX;
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  // Handle mouse move for panning
  const handleMouseMove = (e) => {
    if (!isPanning.current) return;
    
    e.preventDefault();
    const { start: visibleStart, end: visibleEnd, total: timelineEnd } = getVisibleTimeRange();
    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - lastPanX.current;
    const timeDelta = (deltaX / rect.width) * (visibleEnd - visibleStart);
    
    if (Math.abs(deltaX) > 2) { // If we've moved more than 2 pixels
      justPanned.current = true; // Mark that we've panned
    }
    
    // Calculate new pan offset
    const newPanOffset = Math.max(0, panOffset - timeDelta);
    
    // Only update if we're not at the boundaries or if we're moving away from them
    const isAtStart = panOffset <= 0;
    const isAtEnd = visibleEnd >= timelineEnd;
    
    if ((!isAtStart || deltaX < 0) && (!isAtEnd || deltaX > 0)) {
      // Additional boundary check for the end
      if (isAtEnd && deltaX > 0) {
        // If at the end, only allow panning left
        if (timeDelta > 0) {
          setPanOffset(newPanOffset);
        }
      } else {
        setPanOffset(newPanOffset);
      }
      lastPanX.current = e.clientX;
    }
  };

  // Handle mouse up to end panning
  const handleMouseUp = (e) => {
    if (isPanning.current) {
      e.preventDefault();
      e.stopPropagation();
      isPanning.current = false;
      if (timelineRef.current) {
        timelineRef.current.style.cursor = 'grab';
      }

      // Clear the panned state after a short delay
      setTimeout(() => {
        justPanned.current = false;
      }, 100);
    }
  };

  // Handle timeline click with zoom consideration
  const handleTimelineClick = (e) => {
    // Prevent seeking if we just finished panning
    if (!timelineRef.current || !duration || !onTimelineClick || justPanned.current) {
      return;
    }
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const { start: visibleStart, end: visibleEnd, total: timelineEnd } = getVisibleTimeRange();
    const visibleDuration = visibleEnd - visibleStart;
    
    const newTime = visibleStart + (clickX / rect.width) * visibleDuration;
    
    if (newTime >= 0 && newTime <= duration) {
      // Calculate new pan offset while maintaining current zoom level
      const totalVisibleDuration = timelineEnd / currentZoomRef.current;
      const halfVisibleDuration = totalVisibleDuration / 2;
      const newPanOffset = Math.max(0, Math.min(newTime - halfVisibleDuration, timelineEnd - totalVisibleDuration));
      
      // Update pan offset first, then trigger the time change
      setPanOffset(newPanOffset);
      requestAnimationFrame(() => {
        onTimelineClick(Math.min(duration, newTime));
      });
    }
  };

  return (
    <div className="timeline-container">
      <canvas 
        ref={timelineRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleTimelineClick}
        className="subtitle-timeline"
        style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
      />
    </div>
  );
};

export default TimelineVisualization;