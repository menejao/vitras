/**
 * ScheduleConfigurationPage — Página operacional de configuração de agenda da UBS.
 *
 * Domínio: gestor local e perfis autorizados (schedule.configuration.read/update).
 * Resolve unitId do usuário autenticado — sem override externo.
 * Reutiliza ScheduleConfigTab como componente de domínio.
 *
 * Não acessível ao support_admin (bloqueado por blockSupportAdminFromClinical no backend).
 * Guard no frontend: hasCapability(user, "schedule.configuration.read").
 */

import { hasCapability } from "../utils/roles";
import ScheduleConfigTab from "./platform/ScheduleConfigTab";
import { useActiveUnit } from "../contexts/ActiveUnitContext";

export default function ScheduleConfigurationPage({ user, token }) {
  if (!hasCapability(user, "schedule.configuration.read")) {
    return (
      <div style={{ padding: "2.5rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔒</div>
        <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)", marginBottom: "0.5rem" }}>
          Sem permissão
        </p>
        <p style={{ fontSize: "0.875rem" }}>
          Seu perfil não tem acesso à configuração de agenda.
        </p>
      </div>
    );
  }

  const { unitId } = useActiveUnit();
  const canEdit = hasCapability(user, "schedule.configuration.update");

  if (!unitId) {
    return (
      <div style={{ padding: "2rem", color: "var(--error, red)" }}>
        Usuário sem UBS vinculada. Contate o administrador.
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header" style={{ padding: "1.5rem 1.5rem 0" }}>
        <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Configuração da Agenda</h2>
        <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Defina horários, capacidade, canais e bloqueios da agenda desta UBS.
        </p>
      </div>
      <ScheduleConfigTab
        token={token}
        unitId={unitId}
        canEdit={canEdit}
      />
    </div>
  );
}
