export function FieldLabel({ children, required }) {
  return (
    <div className="pap-field__label">
      {children}
      {required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
    </div>
  );
}

export function RadioGroup({ label, name, value, onChange, options, hint, required }) {
  return (
    <div className="pap-field">
      <FieldLabel required={required}>{label}</FieldLabel>
      {hint && <div className="pap-field__hint">{hint}</div>}
      <div className="pap-field__opts">
        {options.map(opt => (
          <label key={opt.value} className={`pap-opt${value === opt.value ? " is-active" : ""}`}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(name, opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export function CheckboxGroup({ label, name, value = [], onChange, options, hint }) {
  function toggle(v) {
    const next = value.includes(v) ? value.filter(x => x !== v) : [...value, v];
    onChange(name, next);
  }
  return (
    <div className="pap-field">
      {label && <FieldLabel>{label}</FieldLabel>}
      {hint && <div className="pap-field__hint">{hint}</div>}
      <div className="pap-field__opts">
        {options.map(opt => (
          <label key={opt.value} className={`pap-opt${value.includes(opt.value) ? " is-active" : ""}`}>
            <input
              type="checkbox"
              checked={value.includes(opt.value)}
              onChange={() => toggle(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
