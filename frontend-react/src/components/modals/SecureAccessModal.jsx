import { useMemo, useState } from "react";
import Modal from "../ui/Modal";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { roleLabel } from "../../utils/roles";

function SecureAccessModal({
  mode = "impersonation",
  user,
  users = [],
  busy = false,
  error = "",
  onClose,
  onSubmit
}) {
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");

  const selectableUsers = useMemo(() => {
    const actorId = String(user?.id || "");
    return (Array.isArray(users) ? users : [])
      .filter((item) => String(item?.id || "") && String(item?.id || "") !== actorId)
      .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "pt-BR"));
  }, [user, users]);

  const isImpersonation = mode === "impersonation";
  const title = isImpersonation ? "Assumir contexto de usuário" : "Ativar break-glass";
  const hint = isImpersonation
    ? "A sessão continua sendo sua. O sistema muda apenas o escopo visual e de leitura auditada."
    : "Uso temporário, com rastreabilidade reforçada. Informe motivo operacional claro.";

  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button
            onClick={() => onSubmit({
              targetUserId: targetUserId.trim(),
              reason: reason.trim()
            })}
            disabled={busy || !reason.trim() || (isImpersonation && !targetUserId)}
          >
            {busy ? "Processando..." : isImpersonation ? "Assumir contexto" : "Ativar break-glass"}
          </Button>
        </>
      )}
    >
      <div>
        <p className="muted">{hint}</p>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {isImpersonation ? (
          <Select
            label="Usuário de destino"
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
          >
            <option value="">Selecione um usuário</option>
            {selectableUsers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {roleLabel(item.role)}{item.teamName ? ` · ${item.teamName}` : ""}
              </option>
            ))}
          </Select>
        ) : null}
        <Textarea
          label="Motivo"
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint="Esse motivo será gravado na auditoria."
        />
      </div>
    </Modal>
  );
}

export default SecureAccessModal;
