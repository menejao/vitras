// Copyright (c) 2026 Vitras. Todos os direitos reservados.
// Componente único de prescrição de medicamentos.
// Usado por Medicina, Enfermagem e Odontologia — apenas o contexto clínico muda.
import { useState } from "react";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import { createRecord, verifyCurrentPassword, createPharmacyReceita } from "../../api";
import { printPrescription } from "../../utils/printDoc";
import MedicationAutocomplete from "./MedicationAutocomplete";

export const MEDICATIONS_COMMON = [
  "Acido folico 5mg", "Amlodipino 5mg", "Amlodipino 10mg", "Atenolol 25mg", "Atenolol 50mg",
  "Atorvastatina 20mg", "Atorvastatina 40mg", "Captopril 25mg", "Captopril 50mg", "Carvedilol 6,25mg",
  "Carvedilol 12,5mg", "Enalapril 5mg", "Enalapril 10mg", "Espironolactona 25mg", "Furosemida 40mg",
  "Glibenclamida 5mg", "Glicazida 30mg", "Hidroclorotiazida 25mg", "Insulina NPH", "Insulina Regular",
  "Levotiroxina 25mcg", "Levotiroxina 50mcg", "Levotiroxina 100mcg", "Losartana 50mg", "Losartana 100mg",
  "Metformina 500mg", "Metformina 850mg", "Metformina 1g", "Metoprolol 25mg", "Metoprolol 50mg",
  "Nifedipino 10mg", "Omeprazol 20mg", "Omeprazol 40mg", "Rosuvastatina 10mg", "Rosuvastatina 20mg",
  "Sinvastatina 20mg", "Sinvastatina 40mg", "Sulfato ferroso 40mg", "Valsartana 80mg", "Valsartana 160mg",
  "Outros (digitar)"
];

function getCouncilLabel(user) {
  if (!user) return "";
  if (user.role === "doctor") return user.crm ? `CRM ${user.crm}` : "";
  if (user.role === "dentist") return user.cro ? `CRO ${user.cro}` : "";
  if (user.role === "pharmacist") return user.cff ? `CFF ${user.cff}` : "";
  return user.coren ? `COREN ${user.coren}` : "";
}

// Normalize catalogMeds to {label, value, defaultDosage?, defaultFrequency?}
function normalizeCatalog(catalog) {
  return (catalog || MEDICATIONS_COMMON).map(item => {
    if (typeof item === "string") return { label: item, value: item };
    return {
      label: item.nome,
      value: item.nome,
      defaultDosage: item.dosagem || "",
      defaultFrequency: item.posologia || "",
    };
  });
}

const EMPTY_MED = { name: "", custom: "", dosage: "", frequency: "", duration: "", route: "", notes: "" };

// origin: "medicina" | "odontologia" | "enfermagem"
export default function PrescriptionModal({ patient, user, token, onClose, origin = "medicina" }) {
  const today = new Date().toISOString().slice(0, 10);

  const [meds, setMeds] = useState([{ ...EMPTY_MED }]);
  const [validity, setValidity] = useState("30");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("form"); // "form" | "password" | "saved" | "pharmacy_error"
  const [password, setPassword] = useState("");
  const [savedMeds, setSavedMeds] = useState(null);
  const [pharmacyErrMsg, setPharmacyErrMsg] = useState("");

  function addMed() { setMeds(s => [...s, { ...EMPTY_MED }]); }
  function removeMed(i) { setMeds(s => s.filter((_, idx) => idx !== i)); }

  function updateMedName(idx, medObj) {
    setMeds(s => s.map((m, i) => {
      if (i !== idx) return m;
      if (!medObj) return { ...m, name: "", dosage: "", frequency: "", route: "" };
      return {
        ...m,
        name: medObj.nome || medObj.value || "",
        dosage: medObj.dosagemPadrao || medObj.defaultDosage || "",
        frequency: medObj.posologia || medObj.defaultFrequency || "",
        route: medObj.via || m.route || "",
      };
    }));
  }

  function updateMed(i, k, v) { setMeds(s => s.map((m, idx) => idx === i ? { ...m, [k]: v } : m)); }

  function requestConfirm(e) {
    e.preventDefault();
    const valid = meds.filter(med => med.name && med.name.trim());
    if (!valid.length) { setErr("Adicione ao menos um medicamento."); return; }
    if (valid.find(med => !med.dosage.trim() || !med.frequency.trim())) {
      setErr("Preencha dose e frequência para todos os medicamentos."); return;
    }
    setErr(""); setStep("password");
  }

  async function confirmAndSave(e) {
    e.preventDefault();
    if (!password) { setErr("Informe sua senha para confirmar."); return; }
    setBusy(true); setErr("");
    try {
      const verify = await verifyCurrentPassword(token, password);
      if (!verify?.ok) { setErr("Senha incorreta. Tente novamente."); setBusy(false); return; }

      const valid = meds.filter(med => med.name && med.name.trim());
      const title = valid.map(med => med.name.trim()).join(", ");
      const originLabel = origin === "odontologia" ? "ODONTOLOGICA" : origin === "enfermagem" ? "ENFERMAGEM" : "MEDICA";
      const details = [
        `PRESCRICAO ${originLabel} - emitida em ${new Date().toLocaleDateString("pt-BR")}`,
        `Validade: ${validity} dias`,
        `Profissional: ${user?.name || ""}${getCouncilLabel(user) ? ` (${getCouncilLabel(user)})` : ""}`,
        `Paciente: ${patient.name}`, "",
        ...valid.map((med, idx) => {
          return `${idx + 1}. ${med.name.trim()} ${med.dosage}${med.route ? ` - Via: ${med.route}` : ""}\n   Frequencia: ${med.frequency}${med.duration ? ` por ${med.duration}` : ""}${med.notes ? `\n   Observacao: ${med.notes}` : ""}`;
        }),
      ].join("\n");

      await createRecord(token, patient.id, { type: "prescription", date: today, title: `Prescricao: ${title}`, details });

      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + parseInt(validity, 10));
      setSavedMeds(valid);
      try {
        await createPharmacyReceita(token, {
          patientId: patient.id,
          patientName: patient.name,
          prescriberId: user.id || user.username || "unknown",
          prescritorRegistro: getCouncilLabel(user) || "",
          dtReceita: today,
          validade: `${validity} dias`,
          validUntil: validUntilDate.toISOString().slice(0, 10),
          itens: valid.map(med => ({
            nome: med.name.trim(),
            dosagem: med.dosage,
            posologia: `${med.frequency}${med.duration ? ` por ${med.duration}` : ""}${med.route ? ` - Via: ${med.route}` : ""}`,
            qtdPrescrita: 1,
          })),
          obs: "",
          origem: origin,
        });
        setStep("saved");
      } catch (pharmacyErr) {
        console.error("[PrescriptionModal] createPharmacyReceita failed:", pharmacyErr);
        setPharmacyErrMsg(pharmacyErr?.message || "Erro ao registrar na Farmácia.");
        setStep("pharmacy_error");
      }
    } catch (error) {
      console.error("[PrescriptionModal] confirmAndSave failed:", error);
      setErr(error?.message || "Erro ao salvar a prescrição.");
    } finally { setBusy(false); }
  }

  function handlePrint() {
    printPrescription({
      patient,
      medications: (savedMeds || []).map(med => ({
        name: med.name.trim(),
        dosage: med.dosage,
        instructions: [med.route ? `Via ${med.route}` : "", `${med.frequency}${med.duration ? ` por ${med.duration}` : ""}`, med.notes].filter(Boolean).join(" · "),
      })),
      validity,
      professional: user,
    });
  }

  if (step === "pharmacy_error") {
    return (
      <Modal title="Prescrição com falha na Farmácia" onClose={() => onClose(true)} className="modal--lg"
        actions={<>
          <Button variant="secondary" type="button" onClick={() => onClose(true)}>Fechar</Button>
          <Button type="button" onClick={handlePrint}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}><rect x="3" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 9V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4" stroke="currentColor" strokeWidth="1.3"/><path d="M5 4V2h6v2" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="7" r=".75" fill="currentColor"/></svg>
            Imprimir prescrição
          </Button>
        </>}>
        <div className="aclin-modal-stack">
          <Alert tone="warning">Prescrição registrada com falha parcial.</Alert>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--fs-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success, #059669)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Registrada no prontuário
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--danger, #dc2626)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              <span>NÃO disponível na Farmácia — {pharmacyErrMsg}</span>
            </div>
          </div>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>O documento pode ser impresso. Contate o suporte se o erro persistir.</p>
        </div>
      </Modal>
    );
  }

  if (step === "saved") {
    return (
      <Modal title="Prescrição de medicamentos" onClose={() => onClose(true)} className="modal--lg"
        actions={<>
          <Button variant="secondary" type="button" onClick={() => onClose(true)}>Fechar</Button>
          <Button type="button" onClick={handlePrint}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}><rect x="3" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 9V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4" stroke="currentColor" strokeWidth="1.3"/><path d="M5 4V2h6v2" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="7" r=".75" fill="currentColor"/></svg>
            Imprimir prescrição
          </Button>
        </>}>
        <div className="aclin-modal-stack">
          <Alert tone="success">Prescrição registrada com sucesso.</Alert>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>Clique em <strong>Imprimir prescrição</strong> para gerar o documento imprimível.</p>
        </div>
      </Modal>
    );
  }

  if (step === "password") {
    return (
      <Modal title="Confirmar identidade" onClose={() => { setStep("form"); setPassword(""); setErr(""); }} className="modal--sm"
        actions={<>
          <Button variant="secondary" type="button" onClick={() => { setStep("form"); setPassword(""); setErr(""); }}>Voltar</Button>
          <Button type="button" onClick={confirmAndSave} disabled={busy}>{busy ? "Verificando..." : "Confirmar e emitir"}</Button>
        </>}>
        <div className="aclin-modal-stack">
          <div className="aclin-pw-confirm">
            <div className="aclin-pw-confirm__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/></svg>
            </div>
            <p className="aclin-pw-confirm__text">Prescrições exigem confirmação de identidade. Informe sua senha para prosseguir.</p>
          </div>
          <Input label="Sua senha" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" autoFocus onKeyDown={e => e.key === "Enter" && confirmAndSave(e)} />
          {err && <Alert tone="danger">{err}</Alert>}
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Prescrição de medicamentos" onClose={() => onClose(false)} className="modal--lg"
      actions={<>
        <Button variant="secondary" type="button" onClick={() => onClose(false)}>Cancelar</Button>
        <Button type="button" onClick={requestConfirm} disabled={busy}>Revisar e confirmar</Button>
      </>}>
      <div className="aclin-modal-stack">
        {meds.map((med, idx) => (
          <div key={idx} className="aclin-med-item">
            <div className="aclin-med-item__header">
              <span className="aclin-exam-item__num">{idx + 1}</span>
              <MedicationAutocomplete
                context={origin}
                value={med.name ? { nome: med.name } : null}
                onChange={medObj => updateMedName(idx, medObj)}
                placeholder="Digite nome ou princípio ativo…"
                disabled={busy}
              />
              {meds.length > 1 && (
                <Button type="button" className="aclin-remove-btn" onClick={() => removeMed(idx)} aria-label="Remover medicamento" variant="ghost" size="sm">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </Button>
              )}
            </div>

            <div className="aclin-med-fields">
              <Input label="Dose *" value={med.dosage} onChange={e => updateMed(idx, "dosage", e.target.value)} placeholder="Ex: 500mg" />
              <Input label="Frequência / Posologia *" value={med.frequency} onChange={e => updateMed(idx, "frequency", e.target.value)} placeholder="Ex: 1x ao dia" />
              <Select label="Via" value={med.route} onChange={e => updateMed(idx, "route", e.target.value)}>
                <option value="">—</option>
                <option value="Oral">Oral</option>
                <option value="Sublingual">Sublingual</option>
                <option value="Inalatória">Inalatória</option>
                <option value="Tópica">Tópica</option>
                <option value="Intramuscular">Intramuscular</option>
                <option value="Subcutânea">Subcutânea</option>
                <option value="Intravenosa">Intravenosa</option>
                <option value="Retal">Retal</option>
                <option value="Ocular">Ocular</option>
              </Select>
              <Input label="Duração" value={med.duration} onChange={e => updateMed(idx, "duration", e.target.value)} placeholder="Ex: 7 dias, uso contínuo…" />
            </div>
            <Textarea label="Observação" rows={2} value={med.notes} onChange={e => updateMed(idx, "notes", e.target.value)} placeholder="Tomar em jejum, com alimentos…" className="patients-textarea" />
          </div>
        ))}
        <Button type="button" className="aclin-add-btn" onClick={addMed} variant="secondary" size="sm">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Adicionar medicamento
        </Button>
        <div className="aclin-divider" />
        <div className="aclin-validity-row">
          <span className="aclin-field-label">Validade da receita</span>
          <Select value={validity} onChange={e => setValidity(e.target.value)} className="aclin-validity-select">
            <option value="10">10 dias</option>
            <option value="30">30 dias</option>
            <option value="60">60 dias</option>
            <option value="90">90 dias</option>
            <option value="180">180 dias</option>
          </Select>
        </div>
        {err && <Alert tone="danger">{err}</Alert>}
      </div>
    </Modal>
  );
}
