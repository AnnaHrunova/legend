import { MessageSquare, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { track } from '../../analytics/analytics';
import type { FeedbackContext } from '../../analytics/feedbackContexts';

type FeedbackButtonProps = {
  context: FeedbackContext;
  label?: string;
  variant?: 'inline' | 'floating' | 'icon';
  ticketId?: string;
  viewId?: string;
  topicId?: string;
  projectId?: string;
  timeBucket?: string;
  platform?: string;
  source?: string;
  reviewSource?: string;
  severity?: string;
  dateRange?: string;
  granularity?: string;
  focusMode?: string;
  focusId?: string;
  componentLabel?: string;
};

const placeholder = 'What is missing, confusing, or annoying here? Please do not include personal data.';

export function FeedbackButton({
  context,
  label = 'Feedback',
  variant = 'inline',
  ticketId,
  viewId,
  topicId,
  projectId,
  timeBucket,
  platform,
  source,
  reviewSource,
  severity,
  dateRange,
  granularity,
  focusMode,
  focusId,
  componentLabel,
}: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => textareaRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSubmitted(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    setSubmitted(false);
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;

    track('feedback_submitted', {
      text: trimmed,
      context,
      path: window.location.pathname,
      ...(document.title ? { pageTitle: document.title } : {}),
      ...(componentLabel ? { componentLabel } : {}),
      ...(ticketId ? { ticketId } : {}),
      ...(viewId ? { viewId } : {}),
      ...(topicId ? { topicId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(timeBucket ? { timeBucket } : {}),
      ...(platform ? { platform } : {}),
      ...(source ? { source } : {}),
      ...(reviewSource ? { reviewSource } : {}),
      ...(severity ? { severity } : {}),
      ...(dateRange ? { dateRange } : {}),
      ...(granularity ? { granularity } : {}),
      ...(focusMode ? { focusMode } : {}),
      ...(focusId ? { focusId } : {}),
    });

    setText('');
    setSubmitted(true);
    window.setTimeout(() => close(), 900);
  }

  return (
    <>
      <button
        type="button"
        className={`feedback-trigger feedback-${variant}`}
        onClick={() => {
          if (context.startsWith('platform_')) {
            track('platform_health_feedback_opened', { context });
          }
          setIsOpen(true);
        }}
        aria-label={label}
        title={label}
      >
        <MessageSquare size={variant === 'floating' ? 16 : 14} />
        {variant !== 'icon' && <span>{label}</span>}
      </button>

      {isOpen && (
        <div className="feedback-backdrop" onMouseDown={close}>
          <section
            className="feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="feedback-modal-header">
              <div>
                <h2 id={titleId}>Leave feedback</h2>
                <span>About: {componentLabel ?? context}</span>
              </div>
              <button type="button" onClick={close} aria-label="Close feedback">
                <X size={16} />
              </button>
            </div>

            {submitted ? (
              <div className="feedback-thanks">Thanks. Feedback sent.</div>
            ) : (
              <>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={placeholder}
                />
                <div className="feedback-actions">
                  <button type="button" onClick={close}>
                    Cancel
                  </button>
                  <button type="button" className="primary-button" onClick={submit} disabled={!text.trim()}>
                    Submit
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
