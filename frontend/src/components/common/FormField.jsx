import React from 'react';

/**
 * Reusable form field with label
 * @param {string} label - Field label
 * @param {string} hint - Optional hint text below input
 * @param {string} error - Error message
 * @param {boolean} required - Show required indicator
 * @param {number} flex - Flex value for grid layouts
 * @param {React.ReactNode} children - Input element
 */
export function FormField({ label, hint, error, required, flex = 1, children }) {
  return (
    <div className="form-field" style={{ flex }}>
      {label && (
        <label className="form-field-label">
          {label}
          {required && <span className="form-field-required">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="form-field-hint">{hint}</span>}
      {error && <span className="form-field-error">{error}</span>}
    </div>
  );
}

/**
 * Toggle switch component
 */
export function Toggle({ label, checked, onChange, icon: Icon, disabled }) {
  return (
    <div className={`toggle-field ${disabled ? 'toggle-disabled' : ''}`}>
      <div className="toggle-label-wrap">
        {Icon && <Icon size={16} className="toggle-icon" />}
        <span className="toggle-label">{label}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`toggle-switch ${checked ? 'toggle-switch-on' : ''}`}
        onClick={() => !disabled && onChange(!checked)}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

/**
 * Section wrapper for form groups
 */
export function FormSection({ title, icon: Icon, children, style }) {
  return (
    <div className="form-section" style={style}>
      {title && (
        <div className="form-section-title">
          {Icon && <Icon size={14} />}
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export default FormField;
