import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

interface UseFullscreenProctoringOptions {
  examId: string | number | undefined;
  userId: string | undefined;
  enabled?: boolean;
  onFullscreenExit?: () => void;
}

interface UseFullscreenProctoringReturn {
  isFullscreen: boolean;
  fullscreenWarnings: number;
  warningsCount: number; // Alias for fullscreenWarnings
  requestFullscreen: () => Promise<boolean>;
  enterFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<void>;
}

export function useFullscreenProctoring({
  examId,
  userId,
  enabled = true,
  onFullscreenExit,
}: UseFullscreenProctoringOptions): UseFullscreenProctoringReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenWarnings, setFullscreenWarnings] = useState(0);
  const isRequestingRef = useRef(false);
  const lastExitTimeRef = useRef<number>(0);
  const exitCountRef = useRef(0);

  // Check if fullscreen is currently active
  const checkFullscreen = useCallback(() => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    setIsFullscreen(isCurrentlyFullscreen);
    return isCurrentlyFullscreen;
  }, []);

  // Enter fullscreen function (exposed as enterFullscreen)
  // This function works regardless of enabled state (for Start Exam button)
  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    if (isRequestingRef.current) return false;

    try {
      isRequestingRef.current = true;
      const element = document.documentElement;

      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
      } else {
        throw new Error('Fullscreen API not supported');
      }

      checkFullscreen();
      return true;
    } catch (error: any) {
      console.error('Error requesting fullscreen:', error);
      // User might have denied fullscreen permission
      return false;
    } finally {
      isRequestingRef.current = false;
    }
  }, [checkFullscreen]);

  // Request fullscreen (alias for enterFullscreen)
  const requestFullscreen = enterFullscreen;

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      checkFullscreen();
    } catch (error: any) {
      console.error('Error exiting fullscreen:', error);
    }
  }, [checkFullscreen]);

  // Send flag to backend
  const raiseFlag = useCallback(async (type: string, message?: string) => {
    if (!examId || !userId) {
      console.warn('Cannot send flag: examId or userId missing');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const flagData = {
        examId: examId.toString(),
        studentId: userId,
        type: type,
        timestamp: Date.now(),
        message: message || type,
      };

      // Try both API endpoints
      try {
        await axios.post('http://localhost:3000/api/v1/proctor/flag', flagData, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        // Fallback to alternative endpoint
        await axios.post('http://localhost:3000/api/proctoring/flag', flagData, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }

      console.log('Flag sent to backend:', flagData);
    } catch (error: any) {
      console.error('Error sending flag to backend:', error);
    }
  }, [examId, userId]);

  // Send flag to backend when fullscreen exits
  const sendFullscreenExitFlag = useCallback(async () => {
    if (!examId || !userId) {
      console.warn('Cannot send fullscreen exit flag: examId or userId missing');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const now = Date.now();
      // Prevent duplicate flags within 1 second
      if (now - lastExitTimeRef.current < 1000) {
        return;
      }
      lastExitTimeRef.current = now;

      exitCountRef.current += 1;
      setFullscreenWarnings(exitCountRef.current);

      await raiseFlag('fullscreen-exit', `Fullscreen exit detected (${exitCountRef.current} time${exitCountRef.current > 1 ? 's' : ''})`);

      // Call optional callback
      if (onFullscreenExit) {
        onFullscreenExit();
      }
    } catch (error: any) {
      console.error('Error sending fullscreen exit flag:', error);
    }
  }, [examId, userId, onFullscreenExit, raiseFlag]);

  // Handle ESC key press - more aggressive approach
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Mark ESC press as suspicious
        raiseFlag('esc-pressed', 'ESC key pressed - attempting to exit fullscreen');
        
        // Immediately re-enter fullscreen (multiple attempts for reliability)
        // Use requestAnimationFrame for immediate execution
        requestAnimationFrame(() => enterFullscreen());
        setTimeout(() => enterFullscreen(), 0);
        setTimeout(() => enterFullscreen(), 10);
        setTimeout(() => enterFullscreen(), 50);
        setTimeout(() => enterFullscreen(), 100);
        setTimeout(() => enterFullscreen(), 200);
      }
    };

    // Add multiple event listeners for better coverage
    document.addEventListener('keydown', handleKeyDown, true); // Capture phase
    window.addEventListener('keydown', handleKeyDown, true); // Window level
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        setTimeout(() => enterFullscreen(), 0);
      }
    }, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, raiseFlag, enterFullscreen]);

  // Handle fullscreen change events - more aggressive re-entry
  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      const wasFullscreen = isFullscreen;
      const isCurrentlyFullscreen = checkFullscreen();

      // If we were in fullscreen and now we're not, user exited
      if (wasFullscreen && !isCurrentlyFullscreen) {
        sendFullscreenExitFlag();

        // Aggressively attempt to re-enter fullscreen immediately
        // Multiple attempts to ensure it works even if browser delays
        // Use requestAnimationFrame for immediate execution
        requestAnimationFrame(() => {
          if (!checkFullscreen()) {
            enterFullscreen();
          }
        });
        setTimeout(() => {
          if (!checkFullscreen()) {
            enterFullscreen();
          }
        }, 0);
        setTimeout(() => {
          if (!checkFullscreen()) {
            enterFullscreen();
          }
        }, 10);
        setTimeout(() => {
          if (!checkFullscreen()) {
            enterFullscreen();
          }
        }, 50);
        setTimeout(() => {
          if (!checkFullscreen()) {
            enterFullscreen();
          }
        }, 100);
        setTimeout(() => {
          if (!checkFullscreen()) {
            enterFullscreen();
          }
        }, 200);
      }
    };

    // Listen to all fullscreen change events
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Initial check
    checkFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [enabled, isFullscreen, checkFullscreen, sendFullscreenExitFlag, requestFullscreen]);

  // Request fullscreen when enabled
  useEffect(() => {
    if (enabled && examId && userId) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (!checkFullscreen()) {
          enterFullscreen();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [enabled, examId, userId, checkFullscreen, enterFullscreen]);

  // Continuous monitoring loop - aggressively re-enter fullscreen if exited
  useEffect(() => {
    if (!enabled) return;

    const monitorInterval = setInterval(() => {
      const isCurrentlyFullscreen = checkFullscreen();
      
      // If we should be in fullscreen but we're not, re-enter immediately
      if (!isCurrentlyFullscreen) {
        console.log('Fullscreen exited - attempting to re-enter...');
        enterFullscreen();
      }
    }, 100); // Check every 100ms

    return () => clearInterval(monitorInterval);
  }, [enabled, checkFullscreen, enterFullscreen]);

  return {
    isFullscreen,
    fullscreenWarnings,
    warningsCount: fullscreenWarnings, // Alias for compatibility
    requestFullscreen,
    enterFullscreen, // Expose enterFullscreen function
    exitFullscreen,
  };
}

// Export as useFullscreenProctor for compatibility
export const useFullscreenProctor = useFullscreenProctoring;

