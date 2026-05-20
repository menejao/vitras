export function parseLocalDate(s) {
  if (!s) return null;
  const str = String(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

export function parseDateSafe(t) { return parseLocalDate(t); }

export function getEasterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getBrazilHolidays(year) {
  const easter = getEasterDate(year);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const fmt = d => d.toISOString().slice(0, 10);
  return new Set([
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-11-20`,
    `${year}-12-25`,
    fmt(addDays(easter, -48)),
    fmt(addDays(easter, -47)),
    fmt(addDays(easter, -2)),
    fmt(easter),
    fmt(addDays(easter, 60)),
  ]);
}

const _holidayCache = {};
export function isHoliday(dateStr) {
  if (!dateStr) return false;
  const year = Number(dateStr.slice(0, 4));
  if (!_holidayCache[year]) _holidayCache[year] = getBrazilHolidays(year);
  return _holidayCache[year].has(dateStr);
}

export function isWeekend(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

export function isUnavailableDay(dateStr) {
  return isWeekend(dateStr) || isHoliday(dateStr);
}

export function nextBusinessDay(dateStr) {
  let d = new Date(dateStr + "T12:00:00");
  while (isUnavailableDay(d.toISOString().slice(0, 10))) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export function unavailableReason(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  if (d.getDay() === 0) return "Domingo — unidade fechada";
  if (d.getDay() === 6) return "Sábado — unidade fechada";
  if (isHoliday(dateStr)) return "Feriado nacional — unidade fechada";
  return null;
}

export function googleCalendarUrl({ title, date, description, location }) {
  const fmt = d => d.replace(/-/g, "");
  const start = fmt(date);
  const end = fmt(new Date(new Date(date).getTime() + 86400000).toISOString().slice(0, 10));
  const params = new URLSearchParams({
    action: "TEMPLATE", text: title,
    dates: `${start}/${end}`,
    details: description || "",
    location: location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
