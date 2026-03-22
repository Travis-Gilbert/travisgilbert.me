'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createCapturedObject, syncCapture, isUrl } from '@/lib/commonplace-capture';
import { COMPONENT_TOOLBOX } from '@/lib/commonplace-components';
import { useCapture } from '@/lib/providers/capture-provider';

type Section = 'capture' | 'toolbox' | null;

export default function CaptureFAB() {
  const { notifyCaptured } = useCapture();
  const [section, setSection] = useState<Section>(null);
  const [captureMode, setCaptureMode] = useState<'url' | 'text' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const isOpen = section !== null;

  /* ── Close on outside click ── */
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  /* ── Close on Escape ── */
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  /* ── Keyboard shortcuts (C and T when no input focused) ── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSection('capture');
        setCaptureMode(null);
      }
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSection('toolbox');
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  /* ── Focus input when capture mode changes ── */
  useEffect(() => {
    if (captureMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [captureMode]);

  function close() {
    setSection(null);
    setCaptureMode(null);
    setInputValue('');
  }

  const handleSubmit = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const obj = createCapturedObject({
      text: trimmed,
      captureMethod: isUrl(trimmed) ? 'pasted' : 'typed',
    });

    close();
    await syncCapture(obj);
    notifyCaptured();
  }, [inputValue, notifyCaptured]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = file.name;
    const obj = createCapturedObject({
      text,
      objectType: 'source',
      captureMethod: 'dropped',
    });

    close();
    await syncCapture(obj);
    notifyCaptured();
  }, [notifyCaptured]);

  return (
    <div ref={containerRef} className="commonplace-theme" style={{ position: 'fixed', bottom: 40, right: 16, zIndex: 30 }}>
      {/* Popover */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: 52,
          right: 0,
          width: 200,
          background: 'var(--cp-surface)',
          border: '1px solid var(--cp-chrome-line)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
        }}>
          {/* Capture section */}
          {(section === 'capture' || section === null) && (
            <div style={{ padding: '8px 0' }}>
              <div style={{
                padding: '0 10px 4px',
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--cp-text-faint)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Capture
              </div>

              {captureMode === 'url' ? (
                <div style={{ padding: '4px 10px' }}>
                  <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="url"
                    placeholder="Paste URL..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: 11,
                      fontFamily: 'var(--cp-font-mono)',
                      background: 'var(--cp-chrome)',
                      border: '1px solid var(--cp-chrome-line)',
                      borderRadius: 4,
                      color: 'var(--cp-text)',
                      outline: 'none',
                    }}
                  />
                </div>
              ) : captureMode === 'text' ? (
                <div style={{ padding: '4px 10px' }}>
                  <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    placeholder="Quick note..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
                    }}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: 11,
                      fontFamily: 'var(--cp-font-body)',
                      background: 'var(--cp-chrome)',
                      border: '1px solid var(--cp-chrome-line)',
                      borderRadius: 4,
                      color: 'var(--cp-text)',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              ) : (
                <>
                  <PopoverItem label="Paste URL" onClick={() => { setCaptureMode('url'); setSection('capture'); }} />
                  <PopoverItem label="Quick text" onClick={() => { setCaptureMode('text'); setSection('capture'); }} />
                  <label style={{ display: 'block' }}>
                    <PopoverItem label="Upload file" onClick={() => {}} />
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--cp-chrome-line)', margin: '0 10px' }} />

          {/* Toolbox section */}
          {(section === 'toolbox' || section === null) && (
            <div style={{ padding: '8px 0' }}>
              <div style={{
                padding: '0 10px 4px',
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--cp-text-faint)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Toolbox
              </div>
              {COMPONENT_TOOLBOX.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/commonplace-component', item.id);
                    e.dataTransfer.effectAllowed = 'copy';
                    close();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 10px',
                    cursor: 'grab',
                    fontSize: 11,
                    fontFamily: 'var(--cp-font-body)',
                    color: 'var(--cp-text-muted)',
                    transition: 'background-color 100ms',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--cp-chrome-raise)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: item.color,
                    flexShrink: 0,
                  }} />
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAB button */}
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            close();
          } else {
            setSection(null);
            setCaptureMode(null);
            setInputValue('');
            // Open with both sections visible
            setSection('capture');
          }
        }}
        aria-label="Capture or add component"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--cp-red)',
          border: 'none',
          color: '#fff',
          fontSize: 20,
          fontWeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'transform 150ms, box-shadow 150ms',
          transform: isOpen ? 'rotate(45deg)' : 'none',
        }}
      >
        +
      </button>
    </div>
  );
}

function PopoverItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '5px 10px',
        fontSize: 11,
        fontFamily: 'var(--cp-font-body)',
        color: 'var(--cp-text-muted)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 100ms',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cp-chrome-raise)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {label}
    </button>
  );
}
