export const SPECIALTY_MAP = [
  { key: "medico_familia",   label: "Médico da Família" },
  { key: "enfermagem",       label: "Enfermagem" },
  { key: "odontologia",      label: "Odontologia" },
  { key: "pediatria",        label: "Pediatria" },
  { key: "psicologia",       label: "Psicologia" },
  { key: "fisioterapia",     label: "Fisioterapia" },
  { key: "nutricao",         label: "Nutrição" },
  { key: "vacinacao",        label: "Vacinação" },
  { key: "curativo",         label: "Curativo" },
];

export const SPECIALTY_LABELS = Object.fromEntries(SPECIALTY_MAP.map(s => [s.key, s.label]));

export function specialtyLabel(key) {
  return SPECIALTY_LABELS[String(key || "").toLowerCase()] || key || "";
}
