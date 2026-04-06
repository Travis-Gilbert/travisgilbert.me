'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceState, VoiceManager } from '@/lib/voice/VoiceManager';

export interface VoiceControlsProps {
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onAmplitude?: (amplitude: number) => void;
  onStateChange?: (state: VoiceState) => void;
}

export function VoiceControls({
  onInterimTranscript,
  onFinalTranscript,
  onAmplitude,
  onStateChange,
}: VoiceControlsProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const managerRef = useRef<VoiceManager | null>(null);

  // Keep callback refs stable so VoiceManager never stales
  const callbacksRef = useRef({
    onInterimTranscript,
    onFinalTranscript,
    onAmplitude,
    onStateChange,
  });
  callbacksRef.current = {
    onInterimTranscript,
    onFinalTranscript,
    onAmplitude,
    onStateChange,
  };

  const getManager = useCallback(async (): Promise<VoiceManager> => {
    if (managerRef.current) return managerRef.current;

    // Dynamic import so the module only loads on first interaction
    const { VoiceManager: VM } = await import('@/lib/voice/VoiceManager');
    const manager = new VM({
      onStateChange: (s: VoiceState) => {
        setState(s);
        callbacksRef.current.onStateChange?.(s);
      },
      onInterimTranscript: (text: string) => {
        callbacksRef.current.onInterimTranscript?.(text);
      },
      onFinalTranscript: (text: string) => {
        callbacksRef.current.onFinalTranscript?.(text);
      },
      onAmplitude: (amplitude: number) => {
        callbacksRef.current.onAmplitude?.(amplitude);
      },
      onError: (error: Error) => {
        console.error('[VoiceControls]', error.message);
      },
    });
    managerRef.current = manager;
    return manager;
  }, []);

  const handleClick = useCallback(async () => {
    const manager = await getManager();
    if (manager.getState() === 'listening') {
      manager.stopListening();
    } else {
      if (manager.getState() === 'speaking') {
        manager.stopSpeaking();
      }
      await manager.startListening();
    }
  }, [getManager]);

  useEffect(() => {
    return () => {
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, []);

  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isListening ? 'Stop listening' : 'Start voice input'}
      className="voice-controls-btn"
      data-state={state}
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: '1.5px solid',
        borderColor: isSpeaking
          ? 'var(--vie-amber, #C49A4A)'
          : 'var(--vie-teal, #2D5F6B)',
        background: 'var(--vie-bg, #0f1012)',
        color: isListening
          ? 'var(--vie-teal-light, #4A8A96)'
          : 'var(--vie-text-muted, #9a958d)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        pointerEvents: 'auto',
        padding: 0,
        outline: 'none',
        transition: 'border-color 0.2s, color 0.2s, box-shadow 0.2s',
        boxShadow: isSpeaking
          ? '0 0 8px var(--vie-amber, #C49A4A)'
          : 'none',
      }}
    >
      {/* Pulsing ring when listening */}
      {isListening && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '2px solid var(--vie-teal, #2D5F6B)',
            animation: 'voice-pulse 1.5s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Microphone SVG icon */}
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="1" width="6" height="14" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="21" x2="12" y2="17" />
        <line x1="8" y1="21" x2="16" y2="21" />
      </svg>

    </button>
  );
}
