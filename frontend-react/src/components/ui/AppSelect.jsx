import { Children, useEffect, useId, useRef, useState } from "react";

function flatOptions(children) {
  const opts = [];
  Children.forEach(children, child => {
    if (!child || typeof child !== "object") return;
    if (child.type === "option") {
      const val = child.props.value !== undefined ? String(child.props.value) : String(child.props.children ?? "");
      const lbl = child.props.children != null ? String(child.props.children) : val;
      opts.push({ value: val, label: lbl, disabled: !!child.props.disabled });
    } else if (child.type === "optgroup") {
      Children.forEach(child.props.children, gc => {
        if (!gc || typeof gc !== "object" || gc.type !== "option") return;
        const val = gc.props.value !== undefined ? String(gc.props.value) : String(gc.props.children ?? "");
        const lbl = gc.props.children != null ? String(gc.props.children) : val;
        opts.push({ value: val, label: lbl, disabled: !!gc.props.disabled, group: child.props.label });
      });
    }
  });
  return opts;
}

export default function AppSelect({
  label, hint, error, className = "", inputClassName = "",
  children, value, onChange, disabled, placeholder, name,
  ...rest
}) {
  const [open, setOpen]     = useState(false);
  const [focused, setFocused] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const id      = useId();

  const options      = flatOptions(children);
  const strVal       = value !== undefined && value !== null ? String(value) : "";
  const current      = options.find(o => o.value === strVal) || null;
  const showEmpty    = !current;

  function close() { setOpen(false); setFocused(-1); }

  function select(opt) {
    if (opt.disabled) return;
    onChange?.({ target: { name, value: opt.value } });
    close();
  }

  function toggle() {
    if (disabled) return;
    setOpen(o => {
      if (!o) {
        const idx = options.findIndex(op => op.value === strVal);
        setFocused(idx >= 0 ? idx : 0);
      }
      return !o;
    });
  }

  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleKey(e) {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
        const idx = options.findIndex(op => op.value === strVal);
        setFocused(idx >= 0 ? idx : 0);
      }
      return;
    }
    switch (e.key) {
      case "Escape":    e.preventDefault(); close(); break;
      case "ArrowDown": e.preventDefault(); setFocused(f => Math.min(f + 1, options.length - 1)); break;
      case "ArrowUp":   e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focused >= 0 && focused < options.length) select(options[focused]);
        break;
      case "Home":      e.preventDefault(); setFocused(0); break;
      case "End":       e.preventDefault(); setFocused(options.length - 1); break;
      case "Tab":       close(); break;
      default:
        if (e.key.length === 1) {
          const ch = e.key.toLowerCase();
          let idx = options.findIndex((o, i) => i > focused && o.label.toLowerCase().startsWith(ch));
          if (idx < 0) idx = options.findIndex(o => o.label.toLowerCase().startsWith(ch));
          if (idx >= 0) setFocused(idx);
        }
    }
  }

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[focused];
    item?.scrollIntoView({ block: "nearest" });
  }, [focused, open]);

  const triggerCls = [
    "input asel__trigger",
    error    ? "input--error"    : "",
    disabled ? "input--disabled" : "",
    open     ? "asel__trigger--open" : "",
    inputClassName,
  ].filter(Boolean).join(" ");

  return (
    <div className={["field", className].filter(Boolean).join(" ")} ref={wrapRef}>
      {label ? <span className="field__label">{label}</span> : null}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        className={triggerCls}
        onClick={toggle}
        onKeyDown={handleKey}
      >
        <span className={showEmpty ? "asel__placeholder" : "asel__value"}>
          {current?.label ?? placeholder ?? " "}
        </span>
        <span className={`asel__chevron${open ? " asel__chevron--open" : ""}`} aria-hidden="true">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>

      {open && (
        <ul id={id} role="listbox" ref={listRef} className="asel__dropdown">
          {options.length === 0 ? (
            <li className="asel__empty">Nenhuma opção</li>
          ) : options.map((opt, i) => (
            <li
              key={`${opt.value}-${i}`}
              role="option"
              aria-selected={opt.value === strVal}
              aria-disabled={opt.disabled || undefined}
              className={[
                "asel__option",
                opt.value === strVal   ? "asel__option--selected" : "",
                i === focused          ? "asel__option--focused"  : "",
                opt.disabled           ? "asel__option--disabled" : "",
              ].filter(Boolean).join(" ")}
              onMouseDown={e => { e.preventDefault(); select(opt); }}
              onMouseEnter={() => setFocused(i)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}

      {name && (
        <input type="hidden" name={name} value={strVal} />
      )}
      {error  ? <span className="field__error">{error}</span>  : null}
      {!error && hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}
