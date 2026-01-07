import React from 'react';
import { Button } from './ui/button';
import { AlertTriangle, Maximize2 } from 'lucide-react';

interface FullscreenBlockerOverlayProps {
  visible: boolean;
  onEnableFullscreen: () => Promise<boolean>;
}

export function FullscreenBlockerOverlay({
  visible,
  onEnableFullscreen,
}: FullscreenBlockerOverlayProps) {
  if (!visible) return null;

  const handleReEnterFullscreen = async () => {
    const success = await onEnableFullscreen();
    if (!success) {
      alert('Unable to enter fullscreen. Please allow fullscreen permission and try again.');
    }
  };

  return (
    <div
      className="overlay"
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        className="overlay-box"
        style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Fullscreen Required
          </h2>
          <p className="text-gray-600 text-base">
            Please return to fullscreen to continue the exam.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            The exam cannot continue until fullscreen mode is restored. This is required for exam integrity.
          </p>
          
          <Button
            onClick={handleReEnterFullscreen}
            className="w-full py-6 text-lg font-semibold flex items-center justify-center space-x-2"
            style={{
              backgroundColor: '#4444FF',
              padding: '1.5rem',
              fontSize: '1.125rem',
              fontWeight: '600',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3333EE';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#4444FF';
            }}
          >
            <Maximize2 className="w-5 h-5" />
            <span>Re-enter Fullscreen</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

