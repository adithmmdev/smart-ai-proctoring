import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

interface UseFullscreenGuardOptions {
  examId: string | number | undefined;
  studentId: string | undefined;
  enabled?: boolean;
}

interface UseFullscreenGuardReturn {
  fullscreenActive: boolean;
  reEnterFullscreen: () => Promise<boolean>;
  enterFullscreen: () => Promise<boolean>;
}

export function useFullscreenGuard({
  examId,
  studentId,
  enabled = true,
}: UseFullscreenGuardOptions): UseFullscreenGuardReturn {
  const [fullscreenActive, setFullscreenActive] = useState(true);
  const isRequestingRef = useRef(false);
  const lastExitTimeRef = useRef<number>(0);

  // Check if fullscreen is currently active
  const checkFullscreen = useCallback(() => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    setFullscreenActive(isCurrentlyFullscreen);
    return isCurrentlyFullscreen;
  }, []);

  // Enter fullscreen function
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
      checkFullscreen();
      return false;
    } finally {
      isRequestingRef.current = false;
    }
  }, [checkFullscreen]);

  // Re-enter fullscreen (alias for enterFullscreen)
  const reEnterFullscreen = enterFullscreen;

  // Send flag to backend when fullscreen exits
  const raiseFlag = useCallback(async (type: string, message?: string) => {
    if (!examId || !studentId) {
      console.warn('Cannot send flag: examId or studentId missing');
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

      const flagData = {
        examId: examId.toString(),
        studentId: studentId,
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
        try {
          await axios.post('http://localhost:3000/api/proctoring/flag', flagData, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (fallbackErr) {
          console.error('Error sending flag to backend:', fallbackErr);
        }
      }

      console.log('Flag sent to backend:', flagData);
    } catch (error: any) {
      console.error('Error sending flag to backend:', error);
    }
  }, [examId, studentId]);

  // Handle ESC key press
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Mark ESC press as suspicious
        raiseFlag('fullscreen-exit', 'ESC key pressed - attempting to exit fullscreen');
        
        // Check fullscreen status
        setTimeout(() => checkFullscreen(), 0);
      }
    };

    // Add multiple event listeners for better coverage
    document.addEventListener('keydown', handleKeyDown, true); // Capture phase
    window.addEventListener('keydown', handleKeyDown, true); // Window level

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, raiseFlag, checkFullscreen]);

  // Handle fullscreen change events
  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = checkFullscreen();

      // If we're not in fullscreen, raise flag
      if (!isCurrentlyFullscreen) {
        raiseFlag('fullscreen-exit', 'Fullscreen exited - user must re-enter to continue');
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
  }, [enabled, checkFullscreen, raiseFlag]);

  // Enter fullscreen when enabled
  useEffect(() => {
    if (enabled && examId && studentId) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (!checkFullscreen()) {
          enterFullscreen();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [enabled, examId, studentId, checkFullscreen, enterFullscreen]);

  // Continuous monitoring - check fullscreen status periodically
  useEffect(() => {
    if (!enabled) return;

    const monitorInterval = setInterval(() => {
      checkFullscreen();
    }, 100); // Check every 100ms

    return () => clearInterval(monitorInterval);
  }, [enabled, checkFullscreen]);

  return {
    fullscreenActive,
    reEnterFullscreen,
    enterFullscreen,
  };
}

