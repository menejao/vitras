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
  "07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"
];

export function describeAgendaType(type) {
  return AGENDA_TYPE_LABELS[String(type || "").trim().toLowerCase()] || AGENDA_TYPE_LABELS.consultation;
}
