import { useEffect, useRef, useState } from "react";

const MONTHS_PT  = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEKDAYS   = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekday(y, m) {
  const d = new Date(y, m, 1).getDay(); // 0=Sun
  return (d + 6) % 7; // convert to Mon=0
}

function isoToDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function displayToIso(display) {
  const match = String(display || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const iso = `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  const dt  = new Date(iso + "T12:00:00");
  if (isNaN(dt)) return null;
  return iso;
}

function addMask(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0,2)}/${digits.slice(2)}`;
  return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
}

export default function AppDatePicker({
  label, hint, error, className = "",
  value, onChange, disabled, min, max,
  placeholder = "DD/MM/AAAA",
  ...rest
}) {
  const today       = new Date();
  const todayIso    = today.toISOString().slice(0, 10);
  const selDate     = value ? new Date(value + "T12:00:00") : null;

  const [inputVal, setInputVal]   = useState(() => isoToDisplay(value || ""));
  const [open, setOpen]           = useState(false);
  const [calYear, setCalYear]     = useState(() => selDate ? selDate.getFullYear() : today.getFullYear());
  const [calMonth, setCalMonth]   = useState(() => selDate ? selDate.getMonth()    : today.getMonth());
  const [mode, setMode]           = useState("days"); // "days" | "months" | "years"

  const wrapRef = useRef(null);

  useEffect(() => { setInputVal(isoToDisplay(value || "")); }, [value]);

  useEffect(() => {
    if (!open) { setMode("days"); return; }
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleInputChange(e) {
    setInputVal(addMask(e.target.value));
  }

  function handleInputBlur() {
    const iso = displayToIso(inputVal);
    if (iso) {
      onChange?.({ target: { value: iso } });
      const d = new Date(iso + "T12:00:00");
      setCalYear(d.getFullYear()); setCalMonth(d.getMonth());
    } else if (!inputVal.trim()) {
      onChange?.({ target: { value: "" } });
    }
  }

  function handleInputKey(e) {
    if (e.key === "Enter") { handleInputBlur(); setOpen(false); }
    if (e.key === "Escape") setOpen(false);
  }

  function selectDay(day) {
    const iso = `${calYear}-${String(calMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    onChange?.({ target: { value: iso } });
    setInputVal(isoToDisplay(iso));
    setOpen(false);
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  // Build day grid (Mon-first)
  const totalDays  = daysInMonth(calYear, calMonth);
  const startShift = firstWeekday(calYear, calMonth);
  const cells      = Array(startShift).fill(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const selDay   = selDate && selDate.getFullYear() === calYear && selDate.getMonth() === calMonth ? selDate.getDate()  : null;
  const todayDay = today.getFullYear() === calYear && today.getMonth() === calMonth ? today.getDate() : null;

  const isDisabledIso = (iso) => {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  };
  const isDayDisabled = (day) => {
    if (!day) return true;
    const iso = `${calYear}-${String(calMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return isDisabledIso(iso);
  };

  // Year range for year picker
  const baseYear   = Math.floor(calYear / 12) * 12;
  const yearRange  = Array.from({ length: 12 }, (_, i) => baseYear + i);

  return (
    <div className={["field dp-wrap", className].filter(Boolean).join(" ")} ref={wrapRef}>
      {label ? <span className="field__label">{label}</span> : null}
      <div className={["input dp__trigger", error ? "input--error" : "", disabled ? "input--disabled" : ""].filter(Boolean).join(" ")}>
        <input
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={inputVal}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKey}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          maxLength={10}
          aria-label={label || "Data"}
          {...rest}
        />
        <button
          type="button"
          className="dp__icon-btn"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Abrir calendário"
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 2v2M11 2v2M2 7h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {open && (
        <div className="dp__popover" role="dialog" aria-label="Selecionar data">
          <div className="dp__header">
            {mode === "days" && (
              <>
                <button type="button" className="dp__nav-btn" onClick={prevMonth} aria-label="Mês anterior">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button type="button" className="dp__month-label" onClick={() => setMode("months")}>
                  {MONTHS_PT[calMonth]} <span className="dp__year-accent">{calYear}</span>
                </button>
                <button type="button" className="dp__nav-btn" onClick={nextMonth} aria-label="Próximo mês">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </>
            )}
            {mode === "months" && (
              <>
                <button type="button" className="dp__nav-btn" onClick={() => { setCalYear(y => y - 1); }} aria-label="Ano anterior">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button type="button" className="dp__month-label" onClick={() => setMode("years")}>{calYear}</button>
                <button type="button" className="dp__nav-btn" onClick={() => { setCalYear(y => y + 1); }} aria-label="Próximo ano">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </>
            )}
            {mode === "years" && (
              <>
                <button type="button" className="dp__nav-btn" onClick={() => setCalYear(y => y - 12)}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <span className="dp__month-label">{baseYear} – {baseYear + 11}</span>
                <button type="button" className="dp__nav-btn" onClick={() => setCalYear(y => y + 12)}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </>
            )}
          </div>

          {mode === "days" && (
            <>
              <div className="dp__weekdays">
                {WEEKDAYS.map(d => <span key={d} className="dp__weekday">{d}</span>)}
              </div>
              <div className="dp__grid">
                {cells.map((day, i) => {
                  const isDisabled = isDayDisabled(day);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={[
                        "dp__day",
                        !day             ? "dp__day--empty"    : "",
                        day === selDay   ? "dp__day--selected" : "",
                        day === todayDay && day !== selDay ? "dp__day--today" : "",
                        isDisabled       ? "dp__day--disabled" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => !isDisabled && day && selectDay(day)}
                      tabIndex={day && !isDisabled ? 0 : -1}
                      disabled={!day || isDisabled}
                      aria-label={day ? `${day} de ${MONTHS_PT[calMonth]} de ${calYear}` : undefined}
                      aria-pressed={day === selDay}
                    >
                      {day || ""}
                    </button>
                  );
                })}
              </div>
              {value && (
                <div className="dp__clear">
                  <button type="button" className="dp__clear-btn" onClick={() => { onChange?.({ target: { value: "" } }); setInputVal(""); setOpen(false); }}>
                    Limpar data
                  </button>
                </div>
              )}
            </>
          )}

          {mode === "months" && (
            <div className="dp__month-grid">
              {MONTHS_PT.map((name, i) => (
                <button key={i} type="button"
                  className={["dp__month-btn", i === calMonth ? "dp__month-btn--selected" : ""].filter(Boolean).join(" ")}
                  onClick={() => { setCalMonth(i); setMode("days"); }}>
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {mode === "years" && (
            <div className="dp__month-grid">
              {yearRange.map(y => (
                <button key={y} type="button"
                  className={["dp__month-btn", y === calYear ? "dp__month-btn--selected" : ""].filter(Boolean).join(" ")}
                  onClick={() => { setCalYear(y); setMode("months"); }}>
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error  ? <span className="field__error">{error}</span>  : null}
      {!error && hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}
