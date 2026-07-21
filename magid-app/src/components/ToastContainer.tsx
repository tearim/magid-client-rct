import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useMagidStore } from '../store/magidStore';
import copyIcon from '../assets/icons/copy.svg?raw';
import pinIcon from '../assets/icons/pin.svg?raw';
import clockIcon from '../assets/icons/clock.svg?raw';
import styles from './ToastContainer.module.css';

const DEFAULT_DISMISS_MS = 4500;
const SNOOZE_MS = 30000;
// Must match the .toastClosing animation duration in ToastContainer.module.css —
// the fade-out is driven from here (not a fixed CSS delay) since the actual
// dismiss time now varies (default / snoozed / pinned).
const CLOSE_ANIM_MS = 400;

function ToastItem({ id, message }: { id: string; message: string }) {
  const dismissToast = useMagidStore((s) => s.dismissToast);
  const [copied, setCopied] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeAnimTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheduleDismiss = useCallback((delayMs: number) => {
    clearTimeout(timerRef.current);
    clearTimeout(closeAnimTimerRef.current);
    setClosing(false);
    closeAnimTimerRef.current = setTimeout(() => setClosing(true), Math.max(delayMs - CLOSE_ANIM_MS, 0));
    timerRef.current = setTimeout(() => dismissToast(id), delayMs);
  }, [id, dismissToast]);

  const cancelDismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(closeAnimTimerRef.current);
    setClosing(false);
  }, []);

  useEffect(() => {
    scheduleDismiss(DEFAULT_DISMISS_MS);
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(closeAnimTimerRef.current);
    };
  }, [scheduleDismiss]);

  const handleTogglePin = (e: MouseEvent) => {
    e.stopPropagation();
    setPinned((wasPinned) => {
      if (wasPinned) scheduleDismiss(DEFAULT_DISMISS_MS);
      else cancelDismiss();
      return !wasPinned;
    });
  };

  const handleSnooze = (e: MouseEvent) => {
    e.stopPropagation();
    scheduleDismiss(SNOOZE_MS);
  };

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className={`${styles.toast} ${closing ? styles.toastClosing : ''}`}
      onClick={() => { if (!pinned) dismissToast(id); }}
    >
      {message}
      <div className={styles.toastActions}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={handleSnooze}
          disabled={pinned}
          title={pinned ? 'Already pinned open' : 'Keep open for 30s'}
          aria-label="Keep open for 30 seconds"
        >
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: clockIcon }} />
        </button>
        <button
          type="button"
          className={`${styles.iconBtn} ${pinned ? styles.iconBtnActive : ''}`}
          onClick={handleTogglePin}
          aria-pressed={pinned}
          title={pinned ? 'Unpin' : 'Pin (keep open indefinitely)'}
          aria-label={pinned ? 'Unpin toast' : 'Pin toast open indefinitely'}
        >
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: pinIcon }} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy error message'}
          aria-label={copied ? 'Copied' : 'Copy error message'}
        >
          {copied
            ? <span aria-hidden="true" className={styles.copiedGlyph}>✓</span>
            : <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: copyIcon }} />}
        </button>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useMagidStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} />
      ))}
    </div>
  );
}
