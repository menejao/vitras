import { useState, useRef, useEffect, useCallback } from "react";
import { searchMedications } from "../../data/medicationCatalog";

/**
 * Autocomplete for medication selection in prescriptions.
 * Props:
 *   value        — selected medication object or null
 *   onChange     — (medication | null) => void
 *   context      — "medicina" | "odontologia" | "enfermagem"
 *   stockIds     — string[] of medication ids available at UBS (optional)
 *   placeholder  — string (optional)
 *   disabled     — bool (optional)
 */
export default function MedicationAutocomplete({
  value,
  onChange,
  context = "medicina",
  stockIds = [],
  placeholder = "Digite nome ou princípio ativo...",
  disabled = false,
}) {
  const [query, setQuery] = useState(value?.nome || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setQuery(value?.nome || "");
  }, [value]);

  const handleInput = useCallback((e) => {
    const q = e.target.value;
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const found = searchMedications(q, context);
    setResults(found);
    setOpen(found.length > 0);
    setFocusedIdx(-1);
    if (value) onChange(null);
  }, [context, value, onChange]);

  const selectMed = useCallback((med) => {
    setQuery(med.nome);
    setResults([]);
    setOpen(false);
    onChange(med);
  }, [onChange]);

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusedIdx >= 0) {
      e.preventDefault();
      selectMed(results[focusedIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleBlur = (e) => {
    if (listRef.current && listRef.current.contains(e.relatedTarget)) return;
    setOpen(false);
    if (!value && query) setQuery("");
  };

  const inStock = (med) => stockIds.includes(med.id);

  return (
    <div className="med-autocomplete" style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        className="aclin-input med-autocomplete__input"
        value={query}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => query.trim().length >= 2 && results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open && (
        <ul
          ref={listRef}
          className="med-autocomplete__list"
          role="listbox"
        >
          {results.map((med, i) => (
            <li
              key={med.id}
              className={`med-autocomplete__item${i === focusedIdx ? " med-autocomplete__item--focused" : ""}`}
              role="option"
              aria-selected={i === focusedIdx}
              onMouseDown={() => selectMed(med)}
            >
              <div className="med-autocomplete__name">{med.nome}</div>
              <div className="med-autocomplete__meta">
                <span className="med-autocomplete__ativo">{med.principioAtivo}</span>
                <span className="med-autocomplete__forma">{med.forma} · {med.via}</span>
                <span className={`med-autocomplete__stock ${inStock(med) ? "med-autocomplete__stock--ok" : "med-autocomplete__stock--out"}`}>
                  {inStock(med) ? "Disponível na UBS" : "Fora do estoque local"}
                </span>
              </div>
              {med.posologia && (
                <div className="med-autocomplete__posologia">{med.posologia}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
