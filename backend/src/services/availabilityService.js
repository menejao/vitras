const DEFAULT_START = "07:00";
const DEFAULT_END = "17:30";
const SLOT_MINUTES = 30;
const WORK_DAYS = [1, 2, 3, 4, 5]; // Mon–Fri

function generateSlots(start, end, step) {
  const slots = [];
  let [h, m] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  while (h * 60 + m + step <= eh * 60 + em) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += step;
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
  }
  return slots;
}

function isWorkDay(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return WORK_DAYS.includes(d.getDay());
}

export function getAvailableSlots(db, { date, specialtyKey, doctorId }) {
  if (!date || !isWorkDay(date)) return [];

  const allSlots = generateSlots(DEFAULT_START, DEFAULT_END, SLOT_MINUTES);

  const booked = (db.agendaEntries || [])
    .filter(e =>
      String(e.date || "") === date &&
      e.status !== "cancelled" &&
      (!doctorId || String(e.doctorId || "") === String(doctorId))
    )
    .map(e => String(e.time || ""));

  return allSlots.filter(slot => !booked.includes(slot));
}

export function isSlotAvailable(db, { date, time, doctorId }) {
  if (!date || !time || !isWorkDay(date)) return false;
  const slots = getAvailableSlots(db, { date, doctorId });
  return slots.includes(time);
}
