export const AGENDA_PROCEDURE_SUBTYPES = [
  { value: "preventivo",    label: "Preventivo / Papanicolau" },
  { value: "glicemia",      label: "Glicemia capilar" },
  { value: "pressao",       label: "Aferição de pressão arterial" },
  { value: "teste_gravidez",label: "Teste de gravidez" },
  { value: "teste_hiv",     label: "Teste rápido HIV" },
  { value: "teste_sifilis", label: "Teste rápido sífilis" },
  { value: "teste_hepatite",label: "Teste rápido hepatite B/C" },
  { value: "curativo",      label: "Curativo / Enfermagem" },
  { value: "coleta_lab",    label: "Coleta de exames laboratoriais" },
  { value: "vacina",        label: "Vacinação" },
  { value: "outro_proc",    label: "Outro procedimento" },
];

export const AGENDA_STATUS_LABELS = {
  scheduled: "Agendado",
  arrived: "Chegou",
  attending: "Em atend.",
  done: "Concluído",
  absent: "Faltou",
};

export const AGENDA_TYPE_LABELS = {
  consultation: "Consulta",
  return: "Retorno",
  procedure: "Procedimento",
  other: "Outro",
};

export const AGENDA_HOURS = [
  "06:30",
  "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30",
  "17:00","17:30","18:00","18:30","19:00","19:30","20:00"
];

export function describeAgendaType(type) {
  return AGENDA_TYPE_LABELS[String(type || "").trim().toLowerCase()] || AGENDA_TYPE_LABELS.consultation;
}
