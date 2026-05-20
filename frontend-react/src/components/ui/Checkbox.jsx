function Checkbox({ label, hint, className = "", ...props }) {
  return (
    <label className={["field field--checkbox", className].filter(Boolean).join(" ")}>
      <span className="checkbox">
        <input type="checkbox" {...props} />
        {label ? <span className="checkbox__label">{label}</span> : null}
      </span>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export default Checkbox;
