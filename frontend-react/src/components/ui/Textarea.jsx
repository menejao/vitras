function Textarea({ label, hint, error, className = "", rows = 4, ...props }) {
  return (
    <label className={["field", className].filter(Boolean).join(" ")}>
      {label ? <span className="field__label">{label}</span> : null}
      <textarea className={["input", error ? "input--error" : ""].filter(Boolean).join(" ")} rows={rows} {...props} />
      {error ? <span className="field__error">{error}</span> : null}
      {!error && hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export default Textarea;
