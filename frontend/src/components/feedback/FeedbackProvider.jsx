import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Copy, Info, X } from 'lucide-react';

const FeedbackContext = createContext(null);

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

function buildId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [copyDialog, setCopyDialog] = useState(null);
  const toastTimersRef = useRef({});

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = toastTimersRef.current[id];
    if (timer) {
      clearTimeout(timer);
      delete toastTimersRef.current[id];
    }
  }, []);

  const notify = useCallback((message, options = {}) => {
    const id = buildId();
    const toast = {
      id,
      title: options.title || '',
      message,
      type: options.type || 'info',
      duration: options.duration ?? 3200,
    };

    setToasts((prev) => [...prev, toast]);

    if (toast.duration > 0) {
      toastTimersRef.current[id] = setTimeout(() => {
        dismissToast(id);
      }, toast.duration);
    }

    return id;
  }, [dismissToast]);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        title: options.title || 'Please confirm',
        message: options.message || '',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        danger: Boolean(options.danger),
        resolve,
      });
    });
  }, []);

  const showCopyDialog = useCallback((options = {}) => {
    setCopyDialog({
      title: options.title || 'Copy value',
      message: options.message || 'Clipboard is unavailable. Copy this value manually.',
      value: options.value || '',
    });
  }, []);

  const closeConfirm = useCallback((result) => {
    if (confirmDialog?.resolve) {
      confirmDialog.resolve(result);
    }
    setConfirmDialog(null);
  }, [confirmDialog]);

  const closeCopyDialog = useCallback(() => {
    setCopyDialog(null);
  }, []);

  const copyFromDialog = useCallback(async () => {
    if (!copyDialog?.value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(copyDialog.value);
      notify('Copied to clipboard.', { type: 'success', duration: 1800 });
    } catch {
      notify('Clipboard access is blocked. Please copy manually.', { type: 'warning', duration: 2800 });
    }
  }, [copyDialog, notify]);

  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach((timer) => clearTimeout(timer));
      toastTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const hasOverlay = Boolean(confirmDialog || copyDialog);
    document.body.classList.toggle('feedback-modal-open', hasOverlay);
    return () => document.body.classList.remove('feedback-modal-open');
  }, [confirmDialog, copyDialog]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') {
        return;
      }
      if (confirmDialog) {
        closeConfirm(false);
      }
      if (copyDialog) {
        closeCopyDialog();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDialog, copyDialog, closeConfirm, closeCopyDialog]);

  const value = useMemo(() => ({
    notify,
    confirm,
    showCopyDialog,
  }), [notify, confirm, showCopyDialog]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="feedback-toast-region" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const Icon = TOAST_ICONS[toast.type] || Info;
          return (
            <div key={toast.id} className={`feedback-toast feedback-toast-${toast.type}`} role="status">
              <div className="feedback-toast-icon">
                <Icon size={18} />
              </div>
              <div className="feedback-toast-content">
                {toast.title && <div className="feedback-toast-title">{toast.title}</div>}
                <div className="feedback-toast-message">{toast.message}</div>
              </div>
              <button
                type="button"
                className="feedback-toast-close"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {confirmDialog && (
        <div className="feedback-dialog-overlay" onClick={() => closeConfirm(false)}>
          <div className="feedback-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-dialog-header">
              <h3>{confirmDialog.title}</h3>
            </div>
            {confirmDialog.message && (
              <p className="feedback-dialog-text">{confirmDialog.message}</p>
            )}
            <div className="feedback-dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => closeConfirm(false)}>
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                className={`btn ${confirmDialog.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => closeConfirm(true)}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {copyDialog && (
        <div className="feedback-dialog-overlay" onClick={closeCopyDialog}>
          <div className="feedback-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-dialog-header">
              <h3>{copyDialog.title}</h3>
            </div>
            <p className="feedback-dialog-text">{copyDialog.message}</p>
            <div className="feedback-copy-box">
              <div className="feedback-copy-value mono">{copyDialog.value}</div>
              <button type="button" className="btn btn-secondary" onClick={copyFromDialog}>
                <Copy size={16} /> Copy
              </button>
            </div>
            <div className="feedback-dialog-actions">
              <button type="button" className="btn btn-primary" onClick={closeCopyDialog}>Close</button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return ctx;
}
