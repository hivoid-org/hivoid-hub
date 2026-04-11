import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Reusable Modal component with responsive design
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Close handler
 * @param {string} title - Modal title
 * @param {string} subtitle - Optional subtitle
 * @param {React.ReactNode} icon - Optional header icon
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
 * @param {React.ReactNode} children - Modal content
 * @param {React.ReactNode} footer - Footer content (buttons)
 */
export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  subtitle,
  icon,
  size = 'md',
  children, 
  footer 
}) {
  const overlayPressStartedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      overlayPressStartedRef.current = false;
    }
  }, [isOpen]);

  const handleOverlayPointerDown = (e) => {
    overlayPressStartedRef.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    const isDirectOverlayClick = e.target === e.currentTarget;
    if (!isDirectOverlayClick || !overlayPressStartedRef.current) return;
    overlayPressStartedRef.current = false;
    onClose();
  };

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'modal-size-sm',
    md: 'modal-size-md',
    lg: 'modal-size-lg',
    xl: 'modal-size-xl'
  };

  const modalContent = (
    <div
      className="modal-overlay"
      onPointerDown={handleOverlayPointerDown}
      onClick={handleOverlayClick}
    >
      <div 
        className={`modal-container ${sizeClasses[size] || ''}`} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-content">
            {icon && (
              <div className="modal-header-icon">
                {icon}
              </div>
            )}
            <div className="modal-header-text">
              <h2 className="modal-title">{title}</h2>
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="modal-close-btn"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body hide-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
