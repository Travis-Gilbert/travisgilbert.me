'use client';

import { useState } from 'react';
import type { FixPattern } from '@/lib/theseus-types';
import { feedbackLabelColor } from './codeColors';

interface Props {
  pattern: FixPattern;
  onSubmit: () => Promise<boolean>;
}

type SubmitState = 'idle' | 'pending' | 'submitted' | 'failed';

export default function PatternCard({ pattern, onSubmit }: Props) {
  const [state, setState] = useState<SubmitState>('idle');

  async function handleSubmit() {
    if (state !== 'idle' && state !== 'failed') return;
    setState('pending');
    try {
      const ok = await onSubmit();
      setState(ok ? 'submitted' : 'failed');
    } catch {
      setState('failed');
    }
  }

  const buttonLabel = {
    idle: 'Submit to Theseus',
    pending: 'Submitting...',
    submitted: 'Submitted',
    failed: 'Retry submission',
  }[state];

  return (
    <article className="ce-pattern-card">
      <h3 className="ce-pattern-card-title">{pattern.title}</h3>

      <p className="ce-pattern-card-problem">{pattern.problem}</p>

      <div className="ce-pattern-card-section ce-pattern-card-cause">
        <div className="ce-pattern-card-section-label">Root cause</div>
        <p className="ce-pattern-card-section-text">{pattern.root_cause}</p>
      </div>

      <div className="ce-pattern-card-section ce-pattern-card-fix">
        <div className="ce-pattern-card-section-label">Fix</div>
        <p className="ce-pattern-card-section-text">{pattern.fix_summary}</p>
      </div>

      <div className="ce-pattern-card-meta">
        <span
          className="ce-pattern-card-label"
          style={{ color: feedbackLabelColor(pattern.feedback_label) }}
        >
          {pattern.feedback_label}
        </span>
        {pattern.files_involved.length > 0 && (
          <div className="ce-pattern-card-files">
            {pattern.files_involved.map((f) => (
              <span key={f} className="ce-pattern-card-file">
                {f.split('/').pop()}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className={`ce-pattern-card-submit ce-pattern-card-submit-${state}`}
        onClick={handleSubmit}
        disabled={state === 'pending' || state === 'submitted'}
      >
        {buttonLabel}
      </button>
    </article>
  );
}
