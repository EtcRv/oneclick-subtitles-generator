import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startYoutubeVideoDownload,
  checkDownloadStatus,
  extractYoutubeVideoId
} from '../../utils/videoDownloader';
import { renderSubtitlesToVideo, downloadVideo } from '../../utils/videoUtils';
import { convertTimeStringToSeconds } from '../../utils/vttUtils';
import { extractAndDownloadAudio } from '../../utils/fileUtils';
import SubtitleSettings from '../SubtitleSettings';
// Narration settings now integrated into the translation section
import '../../styles/VideoPreview.css';
import '../../styles/narration/index.css';
import { SERVER_URL } from '../../config';

const VideoPreview = ({ currentTime, setCurrentTime, setDuration, videoSource, onSeek, translatedSubtitles, subtitlesArray, onVideoUrlReady, onReferenceAudioChange }) => {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const seekLockRef = useRef(false);
  const lastTimeUpdateRef = useRef(0); // Track last time update to throttle updates
  const lastPlayStateRef = useRef(false); // Track last play state to avoid redundant updates
  const [isFullscreen, setIsFullscreen] = useState(false); // Track fullscreen state
  const [videoUrl, setVideoUrl] = useState('');
  const [optimizedVideoUrl, setOptimizedVideoUrl] = useState('');
  const [optimizedVideoInfo, setOptimizedVideoInfo] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAudioDownloading, setIsAudioDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoId, setVideoId] = useState(null);
  const [downloadCheckInterval, setDownloadCheckInterval] = useState(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isRefreshingNarration, setIsRefreshingNarration] = useState(false); // Track narration refresh state
  // Native track subtitles disabled - using only custom subtitle display
  const [useOptimizedPreview, setUseOptimizedPreview] = useState(() => {
    return localStorage.getItem('use_optimized_preview') !== 'false';
  });

  // State for custom subtitle display
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');

  // Native track subtitles disabled - using only custom subtitle display

  const [subtitleSettings, setSubtitleSettings] = useState(() => {
    // Try to load settings from localStorage
    const savedSettings = localStorage.getItem('subtitle_settings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (e) {
        console.error('Error parsing saved subtitle settings:', e);
      }
    }

    // Default settings if nothing is saved
    return {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24',
      fontWeight: '400',
      position: '90', // Now a percentage value from 0 (top) to 100 (bottom)
      boxWidth: '80',
      backgroundColor: '#000000',
      opacity: '0.7',
      textColor: '#ffffff',
      showTranslatedSubtitles: false
    };
  });
  // We track play state in lastPlayStateRef instead of using state to avoid unnecessary re-renders

  // Process the video URL (download if it's YouTube)
  const processVideoUrl = useCallback(async (url) => {
    console.log('Processing video URL:', url);

    // Reset states
    setError('');
    setIsLoaded(false);

    // Check if it's a YouTube URL
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        setIsDownloading(true);
        setDownloadProgress(0);

        // Store the URL for future use
        localStorage.setItem('current_video_url', url);

        // Extract video ID (used by the download process internally)
        extractYoutubeVideoId(url);

        // Start the download process but don't wait for it to complete
        const id = startYoutubeVideoDownload(url);
        setVideoId(id);

        // Check initial status - it might already be complete if cached
        const initialStatus = checkDownloadStatus(id);
        if (initialStatus.status === 'completed') {
          setVideoUrl(initialStatus.url);
          setIsDownloading(false);
        }
      } catch (err) {
        console.error('Error starting YouTube video download:', err);
        setError(t('preview.videoError', `Error loading video: ${err.message}`));
        setIsDownloading(false);
      }
    } else {
      // Not a YouTube URL, use directly
      setVideoUrl(url);
    }
  }, [t, setError, setIsLoaded, setIsDownloading, setDownloadProgress, setVideoId, setVideoUrl]);

  // Initialize video source
  useEffect(() => {
    const loadVideo = async () => {
      // Reset video state when source changes
      setIsLoaded(false);
      setVideoUrl('');
      setOptimizedVideoUrl('');
      setError('');
      setOptimizedVideoInfo(null); // Reset optimized video info

      // Clear narration data when video source changes
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('VideoPreview: Clearing narration data for new video source');
      }
      window.originalNarrations = [];
      window.translatedNarrations = [];
      localStorage.removeItem('originalNarrations');
      localStorage.removeItem('translatedNarrations');

      // Dispatch event to notify other components that narrations have been cleared
      const event = new CustomEvent('narrations-updated', {
        detail: {
          source: 'original',
          narrations: []
        }
      });
      window.dispatchEvent(event);

      const translatedEvent = new CustomEvent('narrations-updated', {
        detail: {
          source: 'translated',
          narrations: []
        }
      });
      window.dispatchEvent(translatedEvent);

      if (!videoSource) {
        // Don't show error message - SRT-only mode will be activated in App.js
        return;
      }

      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('VideoPreview: Loading new video source:', videoSource);
      }

      // If it's a blob URL (from file upload), use it directly
      if (videoSource.startsWith('blob:')) {
        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {
          console.log('Loading file URL:', videoSource);
        }
        setVideoUrl(videoSource);

        // Check if we have an optimized version in localStorage
        try {
          const splitResult = JSON.parse(localStorage.getItem('split_result') || '{}');

          // Verify the optimized video exists and matches the current video source
          if (splitResult.optimized && splitResult.optimized.video &&
              splitResult.originalMedia && // Make sure we have original media info
              // Check if this split result is for the current video
              // by comparing the timestamp in the URL or filename
              videoSource.includes(splitResult.originalMedia.split('/').pop().split('.')[0])) {

            // Only log in development mode
            if (process.env.NODE_ENV === 'development') {
              console.log('Found matching optimized video:', splitResult.optimized);
            }
            setOptimizedVideoUrl(`${SERVER_URL}${splitResult.optimized.video}`);

            // Store the optimization info
            setOptimizedVideoInfo({
              resolution: splitResult.optimized.resolution || '360p',
              fps: splitResult.optimized.fps || 15,
              width: splitResult.optimized.width,
              height: splitResult.optimized.height
            });
          } else {
            // Only log in development mode
            if (process.env.NODE_ENV === 'development') {
              console.log('No matching optimized video found for current source');
            }
            setOptimizedVideoUrl('');
            setOptimizedVideoInfo(null);
          }
        } catch (error) {
          console.error('Error parsing split result from localStorage:', error);
          setOptimizedVideoUrl('');
          setOptimizedVideoInfo(null);
        }
        return;
      }

      // If it's a YouTube URL, handle download
      if (videoSource.includes('youtube.com') || videoSource.includes('youtu.be')) {
        await processVideoUrl(videoSource);
        return;
      }

      // For any other URL, try to use it directly
      setVideoUrl(videoSource);
    };

    loadVideo();
  }, [videoSource, t, processVideoUrl]);

  // Notify parent component when videoUrl changes
  useEffect(() => {
    // Determine which URL to use based on the useOptimizedPreview setting
    const urlToUse = useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl;

    if (urlToUse && onVideoUrlReady) {
      onVideoUrlReady(urlToUse);
    }
  }, [videoUrl, optimizedVideoUrl, useOptimizedPreview, onVideoUrlReady]);

  // Check download status at interval if we have a videoId
  useEffect(() => {
    if (!videoId) return;

    // Clear any existing interval
    if (downloadCheckInterval) {
      clearInterval(downloadCheckInterval);
    }

    // Set up a new interval to check download status
    const interval = setInterval(() => {
      const status = checkDownloadStatus(videoId);
      setDownloadProgress(status.progress);

      if (status.status === 'completed') {
        setVideoUrl(status.url);
        setIsDownloading(false);
        clearInterval(interval);
      } else if (status.status === 'error') {
        setError(t('preview.videoError', `Error loading video: ${status.error}`));
        setIsDownloading(false);
        clearInterval(interval);
      }
    }, 1000);

    setDownloadCheckInterval(interval);

    // Clean up on unmount
    return () => clearInterval(interval);
  }, [videoId, t, downloadCheckInterval]);

  // processVideoUrl is now defined inside the useEffect above

  // Clean up interval on component unmount
  useEffect(() => {
    return () => {
      if (downloadCheckInterval) {
        clearInterval(downloadCheckInterval);
      }
    };
  }, [downloadCheckInterval]);

  // Handle native video element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Validate the video URL
    if (!videoUrl) {
      console.log('Empty video URL provided');
      setError(t('preview.videoError', 'No video URL provided.'));
      return;
    }

    // Event handlers
    const handleMetadataLoaded = () => {
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('Video metadata loaded successfully for:', videoUrl);
      }
      setIsLoaded(true);
      setDuration(videoElement.duration);
      setError(''); // Clear any previous errors
    };

    const handleError = (e) => {
      // Get more detailed information about the error
      let errorDetails = '';
      if (videoElement.error) {
        const errorCode = videoElement.error.code;
        switch (errorCode) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorDetails = 'Video playback was aborted.';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorDetails = 'Network error. Check your internet connection.';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorDetails = 'Video decoding error. The file might be corrupted.';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorDetails = 'Video format or MIME type is not supported by your browser.';
            break;
          default:
            errorDetails = `Unknown error (code: ${errorCode}).`;
        }
      }

      console.error('Video element error:', e, errorDetails);
      setError(t('preview.videoError', `Error loading video: ${errorDetails}`));
      setIsLoaded(false);
    };

    const handleTimeUpdate = () => {
      // Only update currentTime if we're not in a seek operation
      if (!seekLockRef.current) {
        // Throttle time updates to reduce unnecessary re-renders
        // Only update if more than 100ms has passed since the last update
        const now = performance.now();
        if (now - lastTimeUpdateRef.current > 100) {
          const currentVideoTime = videoElement.currentTime;
          setCurrentTime(currentVideoTime);
          lastTimeUpdateRef.current = now;

          // Determine which subtitle array to use based on settings
          const useTranslated = subtitleSettings.showTranslatedSubtitles && translatedSubtitles && translatedSubtitles.length > 0;
          const subtitlesToUse = useTranslated ? translatedSubtitles : subtitlesArray;

          // Find the current subtitle based on the video's current time
          if (subtitlesToUse && subtitlesToUse.length > 0) {
            const currentSub = subtitlesToUse.find(sub => {
              // Handle both numeric and string time formats
              const startTime = typeof sub.start === 'number' ? sub.start :
                               (typeof sub.startTime === 'string' ? convertTimeStringToSeconds(sub.startTime) :
                               convertTimeStringToSeconds(sub.start));
              const endTime = typeof sub.end === 'number' ? sub.end :
                             (typeof sub.endTime === 'string' ? convertTimeStringToSeconds(sub.endTime) :
                             convertTimeStringToSeconds(sub.end));
              return currentVideoTime >= startTime && currentVideoTime <= endTime;
            });

            // Update the current subtitle text
            if (currentSub) {
              setCurrentSubtitleText(currentSub.text);
              // Only log in development mode and throttle to avoid excessive logging
              if (process.env.NODE_ENV === 'development') {
                // Store the last logged subtitle to avoid logging the same one repeatedly
                if (!window._lastLoggedSubtitle || window._lastLoggedSubtitle !== currentSub.text) {
                  console.log(`Showing ${useTranslated ? 'translated' : 'original'} subtitle: ${currentSub.text}`);
                  window._lastLoggedSubtitle = currentSub.text;
                }
              }

              // Update fullscreen subtitle if in fullscreen mode
              const container = document.getElementById('fullscreen-subtitle-overlay');
              if (container) {
                // Clear existing content
                container.innerHTML = '';

                // Create subtitle element
                const subtitle = document.createElement('div');
                subtitle.id = 'fullscreen-subtitle';

                // Handle newlines by splitting the text and adding <br> tags
                const lines = currentSub.text.split('\n');
                lines.forEach((line, index) => {
                  if (index > 0) {
                    subtitle.appendChild(document.createElement('br'));
                  }
                  subtitle.appendChild(document.createTextNode(line));
                });

                // Apply styles
                subtitle.style.display = 'inline-block';
                subtitle.style.backgroundColor = `rgba(${parseInt(subtitleSettings.backgroundColor.slice(1, 3), 16)},
                                               ${parseInt(subtitleSettings.backgroundColor.slice(3, 5), 16)},
                                               ${parseInt(subtitleSettings.backgroundColor.slice(5, 7), 16)},
                                               ${subtitleSettings.opacity || '0.7'})`;
                subtitle.style.color = subtitleSettings.textColor || '#ffffff';
                subtitle.style.padding = `${subtitleSettings.backgroundPadding || '10'}px`;
                subtitle.style.borderRadius = `${subtitleSettings.backgroundRadius || '4'}px`;
                subtitle.style.fontFamily = subtitleSettings.fontFamily || 'Arial, sans-serif';
                subtitle.style.fontSize = `${subtitleSettings.fontSize || '24'}px`;
                subtitle.style.fontWeight = subtitleSettings.fontWeight || '400';
                subtitle.style.lineHeight = subtitleSettings.lineSpacing || '1.4';
                subtitle.style.letterSpacing = `${subtitleSettings.letterSpacing || '0'}px`;
                subtitle.style.textTransform = subtitleSettings.textTransform || 'none';
                subtitle.style.textShadow = subtitleSettings.textShadow === true || subtitleSettings.textShadow === 'true' ?
                                          '1px 1px 2px rgba(0, 0, 0, 0.8)' : 'none';
                subtitle.style.maxWidth = '100%';
                subtitle.style.overflowWrap = 'break-word';

                // Add to container
                container.appendChild(subtitle);
              }
            } else {
              setCurrentSubtitleText('');

              // Clear fullscreen subtitle if in fullscreen mode
              const container = document.getElementById('fullscreen-subtitle-overlay');
              if (container) {
                container.innerHTML = '';
              }
            }
          }
        }
      }

      // Update play state in ref to avoid unnecessary re-renders
      const currentlyPlaying = !videoElement.paused;
      if (currentlyPlaying !== lastPlayStateRef.current) {
        lastPlayStateRef.current = currentlyPlaying;
      }
    };

    const handlePlayPauseEvent = () => {
      // Update play state in ref to avoid unnecessary re-renders
      const currentlyPlaying = !videoElement.paused;
      if (currentlyPlaying !== lastPlayStateRef.current) {
        lastPlayStateRef.current = currentlyPlaying;
      }
    };

    const handleSeeking = () => {
      seekLockRef.current = true;
    };

    const handleSeeked = () => {
      // Update the current time immediately when seeking is complete
      setCurrentTime(videoElement.currentTime);
      lastTimeUpdateRef.current = performance.now();

      // Notify parent component about the seek operation
      if (onSeek) {
        onSeek(videoElement.currentTime);
      }

      // Release the seek lock immediately
      seekLockRef.current = false;
    };

    // Add event listeners
    videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('play', handlePlayPauseEvent);
    videoElement.addEventListener('pause', handlePlayPauseEvent);
    videoElement.addEventListener('seeking', handleSeeking);
    videoElement.addEventListener('seeked', handleSeeked);

    // Clean up
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('play', handlePlayPauseEvent);
      videoElement.removeEventListener('pause', handlePlayPauseEvent);
      videoElement.removeEventListener('seeking', handleSeeking);
      videoElement.removeEventListener('seeked', handleSeeked);
    };
  }, [videoUrl, setCurrentTime, setDuration, t, onSeek, subtitlesArray, translatedSubtitles, subtitleSettings]);

  // Native track subtitles disabled - using only custom subtitle display

  // Listen for aligned narration generation events
  useEffect(() => {
    // Function to handle aligned narration status updates
    const handleAlignedNarrationStatus = (event) => {
      if (event.detail) {
        const { status, message, isStillGenerating } = event.detail;

        // If the status is 'complete' and isStillGenerating is false, the narration regeneration is fully done
        if (status === 'complete' && !isStillGenerating) {
          console.log('Aligned narration regeneration complete and no longer generating');
          setIsRefreshingNarration(false);
        }

        // If the status is 'error' and isStillGenerating is false, there was an error during regeneration
        if (status === 'error' && !isStillGenerating) {
          console.error('Error during aligned narration regeneration:', message);
          setIsRefreshingNarration(false);
        }

        // If isStillGenerating is true, keep the overlay visible
        if (isStillGenerating) {
          console.log('Aligned narration generation still in progress, keeping overlay visible');
        }
      }
    };

    // Function to handle aligned narration generation state changes
    const handleAlignedNarrationGeneratingState = (event) => {
      if (event.detail) {
        const { isGenerating } = event.detail;

        // If isGenerating is false, the narration generation is complete
        if (!isGenerating && !isRefreshingNarration) {
          return; // No need to update if we're not refreshing
        }

        if (!isGenerating) {
          console.log('Aligned narration generation state changed to not generating');
          setIsRefreshingNarration(false);
        }
      }
    };

    // Add event listeners
    window.addEventListener('aligned-narration-status', handleAlignedNarrationStatus);
    window.addEventListener('aligned-narration-generating-state', handleAlignedNarrationGeneratingState);

    // Clean up event listeners
    return () => {
      window.removeEventListener('aligned-narration-status', handleAlignedNarrationStatus);
      window.removeEventListener('aligned-narration-generating-state', handleAlignedNarrationGeneratingState);
    };
  }, [isRefreshingNarration]);

  // Listen for aligned narration generation events
  useEffect(() => {
    // Function to handle aligned narration status updates
    const handleAlignedNarrationStatus = (event) => {
      if (event.detail) {
        const { status, message } = event.detail;

        // If the status is 'complete', the narration regeneration is done
        if (status === 'complete') {
          console.log('Aligned narration regeneration complete');
          setIsRefreshingNarration(false);
        }

        // If the status is 'error', there was an error during regeneration
        if (status === 'error') {
          console.error('Error during aligned narration regeneration:', message);
          setIsRefreshingNarration(false);
        }
      }
    };

    // Add event listener for aligned narration status updates
    window.addEventListener('aligned-narration-status', handleAlignedNarrationStatus);

    // Clean up event listener
    return () => {
      window.removeEventListener('aligned-narration-status', handleAlignedNarrationStatus);
    };
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Function to create and inject fullscreen subtitle container
    const createFullscreenSubtitleContainer = () => {
      // Check if container already exists
      let container = document.getElementById('fullscreen-subtitle-overlay');
      if (!container) {
        container = document.createElement('div');
        container.id = 'fullscreen-subtitle-overlay';
        container.style.position = 'fixed';
        container.style.left = '0';
        container.style.right = '0';
        container.style.bottom = '10%';
        container.style.width = `${subtitleSettings.boxWidth || '80'}%`;
        container.style.margin = '0 auto';
        container.style.textAlign = 'center';
        container.style.zIndex = '9999';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
      }
      return container;
    };

    // Function to handle fullscreen change events
    const handleFullscreenChange = () => {
      const isDocFullscreen = !!document.fullscreenElement ||
                             !!document.webkitFullscreenElement ||
                             !!document.mozFullScreenElement ||
                             !!document.msFullscreenElement;

      // Check if our video is the fullscreen element
      const isVideoFullscreen = isDocFullscreen &&
                              (document.fullscreenElement === videoElement ||
                               document.webkitFullscreenElement === videoElement ||
                               document.mozFullScreenElement === videoElement ||
                               document.msFullscreenElement === videoElement);

      setIsFullscreen(isVideoFullscreen);
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('Fullscreen state changed:', isVideoFullscreen);
      }

      // If entering fullscreen, create the subtitle container
      if (isVideoFullscreen) {
        createFullscreenSubtitleContainer();
      } else {
        // If exiting fullscreen, remove the subtitle container
        const container = document.getElementById('fullscreen-subtitle-overlay');
        if (container) {
          document.body.removeChild(container);
        }
      }
    };

    // Add event listeners for all browser variants
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Clean up
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Seek to time when currentTime changes externally (from LyricsDisplay)
  useEffect(() => {
    if (!isLoaded) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Only seek if the difference is significant to avoid loops
    // Increased threshold to 0.2 seconds to further reduce unnecessary seeks
    if (Math.abs(videoElement.currentTime - currentTime) > 0.2) {
      // Set the seek lock to prevent timeupdate from overriding our seek
      seekLockRef.current = true;

      // Store the playing state
      const wasPlaying = !videoElement.paused;
      lastPlayStateRef.current = wasPlaying;

      // Set the new time without pausing first
      // This reduces the play/pause flickering
      videoElement.currentTime = currentTime;

      // Update the last time update reference
      lastTimeUpdateRef.current = performance.now();

      // Release the seek lock after a very short delay
      setTimeout(() => {
        seekLockRef.current = false;
      }, 50);
    }
  }, [currentTime, isLoaded]);

  // Handle downloading video with subtitles
  const handleDownloadWithSubtitles = async () => {
    if (!videoUrl || !subtitlesArray || subtitlesArray.length === 0) {
      setError(t('videoPreview.noSubtitlesToRender', 'No subtitles to render'));
      return;
    }

    setIsRenderingVideo(true);
    setRenderProgress(0);
    setError('');

    try {
      const renderedVideoUrl = await renderSubtitlesToVideo(
        videoUrl,
        subtitlesArray,
        subtitleSettings,
        (progress) => setRenderProgress(progress)
      );

      // Get video title or use default
      const videoTitle = videoSource?.title || 'video-with-subtitles';
      downloadVideo(renderedVideoUrl, `${videoTitle}.webm`);
    } catch (err) {
      console.error('Error rendering subtitles:', err);
      setError(t('videoPreview.renderError', 'Error rendering subtitles: {{error}}', { error: err.message }));
    } finally {
      setIsRenderingVideo(false);
    }
  };

  // Handle downloading video with translated subtitles
  const handleDownloadWithTranslatedSubtitles = async () => {
    if (!videoUrl || !translatedSubtitles || translatedSubtitles.length === 0) {
      setError(t('videoPreview.noTranslatedSubtitles', 'No translated subtitles available'));
      return;
    }

    setIsRenderingVideo(true);
    setRenderProgress(0);
    setError('');

    try {
      // Convert translatedSubtitles to the format expected by renderSubtitlesToVideo
      // Use original subtitle timings when available
      const formattedSubtitles = translatedSubtitles.map(sub => {
        // If this subtitle has an originalId, find the corresponding original subtitle
        if (sub.originalId && subtitlesArray) {
          const originalSub = subtitlesArray.find(s => s.id === sub.originalId);
          if (originalSub) {
            // Use the original subtitle's timing
            return {
              id: sub.id,
              start: originalSub.start,
              end: originalSub.end,
              text: sub.text
            };
          }
        }

        // If the subtitle already has start/end properties, use them
        if (sub.start !== undefined && sub.end !== undefined) {
          return sub;
        }

        // Otherwise, convert from startTime/endTime format
        return {
          id: sub.id,
          start: typeof sub.startTime === 'string' ? convertTimeStringToSeconds(sub.startTime) : 0,
          end: typeof sub.endTime === 'string' ? convertTimeStringToSeconds(sub.endTime) : 0,
          text: sub.text
        };
      });

      const renderedVideoUrl = await renderSubtitlesToVideo(
        videoUrl,
        formattedSubtitles,
        subtitleSettings,
        (progress) => setRenderProgress(progress)
      );

      // Get video title or use default
      const videoTitle = videoSource?.title || 'video-with-translated-subtitles';
      downloadVideo(renderedVideoUrl, `${videoTitle}.webm`);
    } catch (err) {
      console.error('Error rendering translated subtitles:', err);
      setError(t('videoPreview.renderError', 'Error rendering subtitles: {{error}}', { error: err.message }));
    } finally {
      setIsRenderingVideo(false);
    }
  };

  return (
    <div className="video-preview">
      {/* Narration Settings moved to unified component in translation section */}

      <div className="video-preview-header">
        <h3>{t('output.videoPreview', 'Video Preview with Subtitles')}</h3>
        <SubtitleSettings
          settings={subtitleSettings}
          onSettingsChange={setSubtitleSettings}
          onDownloadWithSubtitles={handleDownloadWithSubtitles}
          onDownloadWithTranslatedSubtitles={handleDownloadWithTranslatedSubtitles}
          hasTranslation={translatedSubtitles && translatedSubtitles.length > 0}
          translatedSubtitles={translatedSubtitles}
          targetLanguage={translatedSubtitles && translatedSubtitles.length > 0 && translatedSubtitles[0].language}
          videoRef={videoRef}
          originalNarrations={window.originalNarrations || (() => {
            try {
              const stored = localStorage.getItem('originalNarrations');
              return stored ? JSON.parse(stored) : [];
            } catch (e) {
              console.error('Error parsing originalNarrations from localStorage:', e);
              return [];
            }
          })()}
          translatedNarrations={window.translatedNarrations || (() => {
            try {
              const stored = localStorage.getItem('translatedNarrations');
              return stored ? JSON.parse(stored) : [];
            } catch (e) {
              console.error('Error parsing translatedNarrations from localStorage:', e);
              return [];
            }
          })()}
          {...(() => {
            // Store subtitles data in window for access by other components
            if (subtitlesArray && subtitlesArray.length > 0) {
              window.subtitlesData = subtitlesArray;
              // Only log in development mode
              if (process.env.NODE_ENV === 'development' && !window._loggedSubtitlesData) {
                console.log('VideoPreview - Storing subtitles data in window');
                window._loggedSubtitlesData = true;
              }
            }
            // Store original subtitles (same as subtitlesArray in this context)
            if (subtitlesArray && subtitlesArray.length > 0) {
              window.originalSubtitles = subtitlesArray;
              // Only log in development mode
              if (process.env.NODE_ENV === 'development' && !window._loggedOriginalSubtitles) {
                console.log('VideoPreview - Storing original subtitles in window');
                window._loggedOriginalSubtitles = true;
              }
            }
            // Store translated subtitles if available
            if (translatedSubtitles && translatedSubtitles.length > 0) {
              window.translatedSubtitles = translatedSubtitles;
              // Only log in development mode
              if (process.env.NODE_ENV === 'development' && !window._loggedTranslatedSubtitles) {
                console.log('VideoPreview - Storing translated subtitles in window');
                window._loggedTranslatedSubtitles = true;
              }
            }
            return {};
          })()}
          getAudioUrl={(filename) => `${SERVER_URL}/narration/audio/${filename || 'test.wav'}`}
        />
      </div>

      {isRenderingVideo && (
        <div className="rendering-overlay">
          <div className="rendering-progress">
            <div className="progress-bar" style={{ width: `${renderProgress * 100}%` }}></div>
          </div>
          <div className="rendering-text">
            {t('videoPreview.rendering', 'Rendering video with subtitles...')} ({Math.round(renderProgress * 100)}%)
          </div>
        </div>
      )}

      <div className="video-container">
        {error && <div className="error">{error}</div>}

        {isDownloading ? (
          <div className="video-downloading">
            <div className="download-progress">
              <div className="progress-bar" style={{ width: `${downloadProgress}%` }}></div>
            </div>
            <div className="download-text">
              {t('preview.downloading', 'Downloading video...')} ({downloadProgress}%)
            </div>
          </div>
        ) : (
          videoUrl ? (
            <div className="native-video-container">
              {/* Video quality toggle - only show when optimized video is available */}
              {optimizedVideoUrl && (
                <div className="video-quality-toggle" title={t('preview.videoQualityToggle', 'Toggle between original and optimized video quality')}>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={useOptimizedPreview}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setUseOptimizedPreview(newValue);
                        localStorage.setItem('use_optimized_preview', newValue.toString());
                      }}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-label">
                    {useOptimizedPreview ? t('preview.optimizedQuality', 'Optimized Quality') : t('preview.originalQuality', 'Original Quality')}
                  </span>
                  {useOptimizedPreview && optimizedVideoInfo && (
                    <span className="quality-info">
                      {optimizedVideoInfo.resolution}, {optimizedVideoInfo.fps}fps
                    </span>
                  )}
                </div>
              )}

              {/* Refresh Narration button - only show when video is loaded */}
              {isLoaded && (
                <div className="refresh-narration-button">
                  <button
                    onClick={() => {
                      // Pause the video if it's playing
                      if (videoRef.current && !videoRef.current.paused) {
                        videoRef.current.pause();
                      }

                      // Set refreshing state to show loading overlay
                      setIsRefreshingNarration(true);

                      // Force reset the aligned narration cache and regenerate
                      if (typeof window.resetAlignedNarration === 'function') {
                        console.log('Manually refreshing aligned narration');
                        window.resetAlignedNarration();

                        // Dispatch a custom event to trigger regeneration
                        window.dispatchEvent(new CustomEvent('subtitle-timing-changed', {
                          detail: {
                            action: 'manual-refresh',
                            timestamp: Date.now()
                          }
                        }));

                        // Dispatch an event to notify other components that we're manually refreshing narration
                        window.dispatchEvent(new CustomEvent('manual-refresh-narration-started', {
                          detail: {
                            timestamp: Date.now()
                          }
                        }));

                        // Set a timeout to automatically clear the refreshing state after 60 seconds
                        // This is a fallback in case the aligned-narration-status event is not fired
                        setTimeout(() => {
                          if (setIsRefreshingNarration) {
                            console.log('Fallback timeout: clearing refreshing narration state');
                            setIsRefreshingNarration(false);
                          }
                        }, 60000); // Increased to 60 seconds to account for longer generation times
                      }
                    }}
                    disabled={isRefreshingNarration}
                  >
                    {isRefreshingNarration ? (
                      // Show loading spinner when refreshing
                      <>
                        <svg className="spinner" width="24" height="24" viewBox="0 0 24 24">
                          <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                        </svg>
                        <span className="button-text">{t('preview.refreshingNarration', 'Refreshing Narration...')}</span>
                      </>
                    ) : (
                      // Show refresh icon when not refreshing
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                        </svg>
                        <span className="button-text">{t('preview.refreshNarration', 'Refresh Narration')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Download audio button - only show when video is loaded */}
              {isLoaded && (
                <div className="download-audio-button">
                  <button
                    disabled={isAudioDownloading}
                    className={isAudioDownloading ? 'downloading' : ''}
                    onClick={async () => {
                      if (isAudioDownloading) return; // Prevent multiple clicks

                      // Get video title or use default
                      const videoTitle = videoSource?.title || 'audio';
                      // Use the current video URL (optimized or original)
                      const currentVideoUrl = useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl;

                      // Show loading state
                      setError('');
                      setIsAudioDownloading(true);

                      console.log('Current video URL:', currentVideoUrl);

                      // Extract and download audio - our utility function now handles blob URLs properly
                      const success = await extractAndDownloadAudio(currentVideoUrl, videoTitle);

                      // Reset loading state
                      setIsAudioDownloading(false);

                      // Show error if failed
                      if (!success) {
                        setError(t('preview.audioExtractionError', 'Failed to extract audio from video. Please try again.'));

                        // Clear error after 5 seconds
                        setTimeout(() => {
                          setError('');
                        }, 5000);
                      }
                    }}
                  >
                    {isAudioDownloading ? (
                      // Material Design loading spinner
                      <svg className="spinner" width="24" height="24" viewBox="0 0 24 24">
                        <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                      </svg>
                    ) : (
                      // Material Design download icon
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                      </svg>
                    )}
                    <span className="button-text">{isAudioDownloading ? t('preview.downloadingAudio', 'Downloading audio...') : t('preview.downloadAudio', 'Download Audio')}</span>
                  </button>
                </div>
              )}
              <div className="video-wrapper" style={{ position: 'relative' }}>
                <video
                  ref={videoRef}
                  controls
                  className="video-player"
                  playsInline
                  src={useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl}
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.error('Video error:', e);
                    // If optimized video fails to load, fall back to original video
                    if (useOptimizedPreview && optimizedVideoUrl && e.target.src === optimizedVideoUrl) {
                      console.log('Optimized video failed to load, falling back to original video');
                      e.target.src = videoUrl;
                      e.target.load();
                    }
                  }}
                >
                  <source
                    src={useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl}
                    type="video/mp4"
                    onError={(e) => {
                      console.error('Source error:', e);
                      // If optimized video fails to load, fall back to original video
                      if (useOptimizedPreview && optimizedVideoUrl && e.target.src === optimizedVideoUrl) {
                        console.log('Optimized video source failed to load, falling back to original video');
                        e.target.src = videoUrl;
                      }
                    }}
                  />

                  {/* Native track subtitles disabled - using only custom subtitle display */}

                  {t('preview.videoNotSupported', 'Your browser does not support the video tag.')}
                </video>

                {/* Loading overlay for narration refresh */}
                {isRefreshingNarration && (
                  <div className="narration-refresh-overlay">
                    <div className="narration-refresh-content">
                      <svg className="spinner-large" width="48" height="48" viewBox="0 0 24 24">
                        <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                      </svg>
                      <div className="narration-refresh-text">
                        {t('preview.refreshingNarration', 'Refreshing narration...')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Apply subtitle styling to the video element */}
              <style>
                {`
                  /* Set CSS variables for custom subtitle styling */
                  :root {
                    --subtitle-position: ${subtitleSettings.position || '90'}%;
                    --subtitle-box-width: ${subtitleSettings.boxWidth || '80'}%;
                    --subtitle-background-radius: ${subtitleSettings.backgroundRadius || '4'}px;
                    --subtitle-background-padding: ${subtitleSettings.backgroundPadding || '10'}px;
                    --subtitle-text-transform: ${subtitleSettings.textTransform || 'none'};
                    --subtitle-letter-spacing: ${subtitleSettings.letterSpacing || '0'}px;
                  }

                  /* Native track subtitles disabled - using only custom subtitle display */

                  /* Video container positioning */
                  .native-video-container {
                    position: relative;
                  }

                  /* Style for custom subtitle display */
                  .custom-subtitle-container {
                    position: absolute;
                    left: 0;
                    right: 0;
                    width: var(--subtitle-box-width);
                    max-width: 100%;
                    margin: 0 auto;
                    text-align: center;
                    z-index: 5;
                    /* Calculate top position based on percentage (0% = top, 100% = bottom) */
                    bottom: calc(100% - var(--subtitle-position));
                    transform: translateY(50%);
                  }

                  .custom-subtitle {
                    display: inline-block;
                    background-color: rgba(${parseInt(subtitleSettings.backgroundColor.slice(1, 3), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(3, 5), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(5, 7), 16)}, ${subtitleSettings.opacity});
                    color: ${subtitleSettings.textColor};
                    font-family: ${subtitleSettings.fontFamily};
                    font-size: ${subtitleSettings.fontSize}px;
                    font-weight: ${subtitleSettings.fontWeight};
                    line-height: ${subtitleSettings.lineSpacing || '1.4'};
                    text-align: ${subtitleSettings.textAlign || 'center'};
                    text-transform: var(--subtitle-text-transform);
                    letter-spacing: var(--subtitle-letter-spacing);
                    padding: ${subtitleSettings.backgroundPadding || '10'}px;
                    border-radius: ${subtitleSettings.backgroundRadius || '4'}px;
                    text-shadow: ${subtitleSettings.textShadow === true || subtitleSettings.textShadow === 'true' ? '1px 1px 2px rgba(0, 0, 0, 0.8)' : 'none'};
                    max-width: 100%;
                    word-wrap: break-word;
                  }
                `}
              </style>

              {/* Custom subtitle display */}
              <div className="custom-subtitle-container" style={{ width: `${subtitleSettings.boxWidth || '80'}%` }}>
                {currentSubtitleText && (
                  <div className="custom-subtitle">
                    {currentSubtitleText.split('\n').map((line, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && <br />}
                        {line}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-video-message">
              {/* Empty state - SRT-only mode will be activated in App.js */}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default VideoPreview;