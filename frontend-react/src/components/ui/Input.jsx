import { forwardRef, useState } from "react";
import AppDatePicker from "./AppDatePicker";

const EyeIcon = ({ open }) => open ? (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const Input = forwardRef(function Input({ label, hint, error, inputClassName = "", className = "", type, ...props }, ref) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";

  if (type === "date") {
    return (
      <AppDatePicker
        label={label}
        hint={hint}
        error={error}
        className={className}
        {...props}
      />
    );
  }

  return (
    <label className={["field", className].filter(Boolean).join(" ")}>
      {label ? <span className="field__label">{label}</span> : null}
      <span className={["input", error ? "input--error" : "", inputClassName].filter(Boolean).join(" ")}>
        <input ref={ref} type={isPassword ? (showPw ? "text" : "password") : type} {...props} />
        {isPassword && (
          <button
            type="button"
            className="input__pw-toggle"
            tabIndex={-1}
            aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPw(v => !v)}
          >
            <EyeIcon open={showPw} />
          </button>
        )}
      </span>
      {error ? <span className="field__error">{error}</span> : null}
      {!error && hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
});

export default Input;
