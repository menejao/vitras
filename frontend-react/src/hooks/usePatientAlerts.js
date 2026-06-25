import { useMemo } from "react";
import { deriveProtocolAlerts } from "../utils/clinical";
import { parseLocalDate } from "../utils/dates";

export function usePatientAlerts({ selectedPatient, patientProtocolSummary, history, isEquipeRosaUser }) {
  // rosaAdjustedSummary: kept for structural compatibility (no vaccine override)
  const rosaAdjustedSummary = patientProtocolSummary || null;

  const sortedSpecialAlerts = useMemo(() => {
    try {
      if (rosaAdjustedSummary?.alertsRestricted) return [];
      const rank = { high: 0, medium: 1, low: 2 };

      // Use backend-supplied alerts as the single source of truth.
      // deriveProtocolAlerts returns specMapped (individual clinical alerts) +
      // schedule aggregate items (visits, consultations, vaccines).
      let alerts = deriveProtocolAlerts(rosaAdjustedSummary);

      if (selectedPatient) {
        const cat   = String(selectedPatient.careCategory || "").toLowerCase();
        const ageMs = selectedPatient.birthDate
          ? (Date.now() - (parseLocalDate(selectedPatient.birthDate) || new Date()).getTime())
          : null;
        const ageMon = ageMs !== null ? ageMs / (1000 * 60 * 60 * 24 * 30.44) : null;

        // Gestante: pré-natal + odontológica — supplemental clinical alerts not in backend
        if (cat === "pregnant") {
          const gi = selectedPatient._gestationalAge;
          const weeks = gi ? gi.weeks : null;
          if (weeks !== null) {
            const consultsDone   = Number(rosaAdjustedSummary?.completed?.consultations ?? 0);
            const consultsTarget = Number(rosaAdjustedSummary?.targets?.consultations ?? 0);
            const PREN_MIN = [[38,6],[34,5],[30,4],[26,3],[20,2],[12,1],[0,0]];
            const minRequired = (PREN_MIN.find(([w]) => weeks >= w) || [0,0])[1];

            const alreadyHasConsultAlert = alerts.some(a =>
              String(a.id || "").includes("pren") ||
              String(a.id || "").includes("consult") ||
              String(a.title || "").toLowerCase().includes("pré-natal")
            );

            if (!alreadyHasConsultAlert) {
              if (consultsDone < minRequired) {
                const deficit = minRequired - consultsDone;
                alerts.push({
                  id: "pren-risco",
                  title: `Pré-natal: déficit de ${deficit} consulta(s)`,
                  detail: `IG ${weeks}s — mínimo esperado: ${minRequired} · realizadas: ${consultsDone}. Risco de perda de indicador municipal.`,
                  severity: "high",
                  category: "risk",
                });
              } else if (consultsTarget > consultsDone) {
                const remaining = consultsTarget - consultsDone;
                const weeksLeft = Math.max(0, 40 - weeks);
                alerts.push({
                  id: "pren-pendente",
                  title: `Pré-natal: ${remaining} consulta(s) pendente(s)`,
                  detail: `IG ${weeks}s · ${consultsDone}/${consultsTarget} realizadas · ~${weeksLeft}s restantes de gestação.`,
                  severity: weeksLeft <= 4 ? "medium" : "low",
                });
              }
            }

            const hasDentalVisit = (history || []).some(h =>
              String(h.type || "").toLowerCase() === "consultation" &&
              (String(h.title || "").toLowerCase().includes("odonto") ||
               String(h.title || "").toLowerCase().includes("dent"))
            );
            const alreadyHasOdontoAlert = alerts.some(a => String(a.id || "").includes("odonto"));
            if (!hasDentalVisit && !alreadyHasOdontoAlert) {
              alerts.push({
                id: "pren-odonto",
                title: "Consulta odontológica não realizada",
                detail: `IG ${weeks}s — exigência do pré-natal. ${weeks >= 28 ? "Prazo crítico: agendar com urgência." : "Agendar ainda nesta gestação."}`,
                severity: weeks >= 28 ? "high" : weeks >= 16 ? "medium" : "low",
                category: "risk",
              });
            }
          }
        }

        // Child: puerpério visit alerts — supplemental, not duplicating backend vaccine logic
        if (cat === "child_followup" && selectedPatient.birthDate) {
          const agedays = Math.floor((Date.now() - (parseLocalDate(selectedPatient.birthDate) || new Date()).getTime()) / 86400000);
          const visitsCompleted = Number(rosaAdjustedSummary?.completed?.visits ?? 0);
          const lost1st = agedays >= 31 && visitsCompleted === 0;
          const lost2nd = agedays >= 181 && visitsCompleted < 2;

          const alreadyHasVisitAlert = alerts.some(a => {
            const t = String(a.title || "").toLowerCase();
            return t.includes("puer") || t.includes("1ª visita") || t.includes("2ª visita");
          });

          if (!alreadyHasVisitAlert) {
            if (!lost1st && visitsCompleted === 0) {
              const daysLeft = Math.max(30 - agedays, 0);
              alerts.push({ id: "puer-1a-visita", title: "1ª visita ACS pendente", detail: `Realizar até os 30 dias de vida. Restam ${daysLeft} dia(s).`, severity: daysLeft <= 5 ? "high" : "medium" });
            }
            if (!lost2nd && visitsCompleted < 2 && agedays >= 31) {
              const daysLeft = Math.max(180 - agedays, 0);
              alerts.push({ id: "puer-2a-visita", title: "2ª visita ACS pendente", detail: `Realizar do 2º ao 6º mês de vida. Restam ${daysLeft} dia(s).`, severity: daysLeft <= 15 ? "high" : "medium" });
            }
          }
        }
      }

      return [...alerts].sort((a, b) => {
        const ra = rank[String(a?.severity || "").toLowerCase()] ?? 3;
        const rb = rank[String(b?.severity || "").toLowerCase()] ?? 3;
        return ra !== rb ? ra - rb : String(a?.title || "").localeCompare(String(b?.title || ""), "pt-BR");
      });
    } catch (e) {
      console.error("sortedSpecialAlerts error:", e);
      return [];
    }
  }, [rosaAdjustedSummary, selectedPatient, history]);

  return { rosaAdjustedSummary, sortedSpecialAlerts };
}
