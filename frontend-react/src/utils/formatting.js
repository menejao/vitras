export function onlyDigits(v) { return String(v || "").replace(/\D/g, ""); }

export function formatCpf(v) {
  const d = onlyDigits(v).slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2")
          .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function formatPhone(v) {
  const d = onlyDigits(v).slice(0, 11);
  return d.length <= 10
    ? d.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2")
    : d.replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatCep(v) {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function formatCns(v) { return onlyDigits(v).slice(0, 15); }

// LGPD-friendly CPF display: shows first 3 and last 2 digits only.
// maskCpf("11122233344") → "111.***.***-44"
// Use in all patient lists, cards, and autocomplete results — never in data-entry inputs.
export function maskCpf(raw) {
  const d = onlyDigits(String(raw || ""));
  if (!d) return "";
  if (d.length < 4) return "*".repeat(d.length);
  const first = d.slice(0, 3);
  const last  = d.length >= 11 ? d.slice(9, 11) : d.slice(-Math.min(2, d.length - 3));
  return `${first}.***.***-${last}`;
}

export function formatCouncil(v) {
  const d = onlyDigits(v).slice(0, 6);
  if (d.length <= 3) return d;
  if (d.length === 5) return d.slice(0, 2) + "." + d.slice(2);
  if (d.length === 6) return d.slice(0, 3) + "." + d.slice(3);
  return d.slice(0, 2) + "." + d.slice(2);
}

export function initials(name) {
  return String(name || "?").trim().split(" ").slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?";
}

export function fmtDate(v) {
  if (!v) return "-";
  try {
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
    }
    return new Date(v).toLocaleDateString("pt-BR");
  } catch { return String(v); }
}

export function displayText(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

export function toBoundedInt(v, min, max) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : Math.min(max, Math.max(min, n));
}
