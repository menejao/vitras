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

// Maps legacy display strings and variant spellings to canonical key.
// Used when loading old agenda entries or normalizing user input.
export function normalizeToSpecialtyKey(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "";
  const exact = SPECIALTY_MAP.find(sp => sp.key === s);
  if (exact) return exact.key;
  const byLabel = SPECIALTY_MAP.find(sp => sp.label.toLowerCase() === s);
  if (byLabel) return byLabel.key;
  const LEGACY = {
    "clínica geral": "medico_familia", "clinica geral": "medico_familia",
    "médico da família": "medico_familia", "medico da familia": "medico_familia",
    "médico": "medico_familia", "medico": "medico_familia",
    "doctor": "medico_familia", "medical": "medico_familia",
    "ginecologia": "medico_familia", "ginecológico": "medico_familia",
    "assistência social": "medico_familia", "assistencia social": "medico_familia",
    "saúde mental": "psicologia", "saude mental": "psicologia",
    "mental": "psicologia",
    "nurse": "enfermagem", "nursing": "enfermagem", "enf": "enfermagem",
    "odonto": "odontologia", "dental": "odontologia", "dentist": "odontologia",
    "pediatr": "pediatria", "child": "pediatria",
    "fisio": "fisioterapia", "physio": "fisioterapia",
    "nutri": "nutricao", "nutrition": "nutricao",
    "vacinação": "vacinacao", "vacin": "vacinacao", "vaccin": "vacinacao",
  };
  for (const [k, v] of Object.entries(LEGACY)) {
    if (s.includes(k)) return v;
  }
  return s;
}
