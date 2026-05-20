import { useState } from "react";
import {
  createAppointment, createRecord, createTask,
  deleteAppointment, deleteRecord,
  sendMessage, updateTaskStatus,
} from "../api";
import { isAcs } from "../utils/roles";
import { inferVaccineDoseTitle } from "../pages/VaccinesPage";

export function usePatientActivity({
  token,
  user,
  selectedPatientId,
  patients,
  users,
  setDemandMonthly,
  handleApiError,
  setError,
  loadAll,
  loadSelectedPatientData,
}) {
  const [recordForm, setRecordForm] = useState({
    type: "consultation", title: "Consulta médica", date: "", details: "",
    consultKind: "medica", consultDoctor: "", consultSpecialty: "",
  });
  const [recordVaccines, setRecordVaccines] = useState([]);
  const [appointmentForm, setAppointmentForm] = useState({ date: "", demandType: "scheduled", summary: "", conduct: "", nextStep: "" });
  const [taskForm, setTaskForm] = useState({ title: "", notes: "", dueDate: "", assigneeId: "" });
  const [messageText, setMessageText] = useState("");

  async function submitRecord(e) {
    e.preventDefault();
    if (!selectedPatientId) return;
    const type = isAcs(user) ? "visit" : recordForm.type;
    const title = isAcs(user) ? "Visita ACS" : recordForm.title;
    if (!type || !recordForm.date || (type !== "vaccine" && !title)) { setError("Preencha tipo, data e título."); return; }
    if (type === "vaccine" && !recordVaccines.length) { setError("Selecione ao menos uma vacina."); return; }
    if (type === "visit") {
      const patient = patients.find(p => p.id === selectedPatientId);
      if (!String(patient?.assignedAcsId || "").trim()) {
        setError("Não é possível registrar visita sem ACS responsável vinculado ao paciente.");
        return;
      }
    }
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    const buildDetails = (extraTitle, conduct, nextStep, demandType, details) => [
      extraTitle ? `Tipo: ${extraTitle}` : "",
      demandType ? `Demanda: ${demandType === "scheduled" ? "Programada" : demandType === "spontaneous" ? "Espontânea" : "Retroativo"}` : "",
      conduct ? `Conduta: ${conduct}` : "",
      nextStep ? `Próximo passo: ${nextStep}` : "",
      details ? `Obs: ${details}` : "",
    ].filter(Boolean).join("\n");
    try {
      const council = user?.councilNumber
        ? `${user.role === "doctor" ? "CRM" : user.role === "dentist" ? "CRO" : ["pharmacist", "pharmacy_tech"].includes(user.role) ? "CFF" : "COREN"} ${user.councilNumber}/${user.councilUf || ""}` : "";
      const basePayload = {
        date: recordForm.date, time: timeStr,
        professionalName: user?.name || "", professionalCouncil: council, immutable: true,
      };
      if (type === "vaccine") {
        for (const vaccine of recordVaccines) {
          const patient = patients.find(p => p.id === selectedPatientId);
          const resolvedTitle = patient?.birthDate
            ? inferVaccineDoseTitle(vaccine, recordForm.date, patient.birthDate)
            : vaccine;
          await createRecord(token, selectedPatientId, { ...basePayload, type: "vaccine", title: resolvedTitle, details: buildDetails("", "", "", "", recordForm.details) });
        }
      } else {
        await createRecord(token, selectedPatientId, { ...basePayload, type, title, details: buildDetails(type === "consultation" ? title : "", recordForm.conduct || "", recordForm.nextStep || "", recordForm.demandType || "", recordForm.details) });
        if (type === "consultation") {
          await createAppointment(token, selectedPatientId, {
            date: recordForm.date, demandType: recordForm.demandType || "scheduled", summary: title,
            conduct: recordForm.conduct || "", nextStep: recordForm.nextStep || "",
            doctorName: recordForm.consultDoctor || "", specialty: recordForm.consultSpecialty || "", consultKind: recordForm.consultKind || "medica",
          }).catch(() => {});
        }
      }
      if (type === "consultation") {
        const dType = recordForm.demandType || "scheduled";
        if (dType !== "retroactive") {
          const n = new Date(); const ym = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
          if (String(recordForm.date || "").startsWith(ym)) {
            setDemandMonthly(prev => {
              const cur = prev || { totals: { total: 0, scheduled: 0, spontaneous: 0 } };
              return { totals: { total: (cur.totals?.total || 0) + 1, scheduled: (cur.totals?.scheduled || 0) + (dType === "scheduled" ? 1 : 0), spontaneous: (cur.totals?.spontaneous || 0) + (dType === "spontaneous" ? 1 : 0) } };
            });
          }
        }
      }
      setRecordForm({
        type: isAcs(user) ? "visit" : "consultation",
        title: isAcs(user) ? "Visita ACS" : user?.role === "doctor" ? "Consulta médica" : user?.role === "dentist" ? "Consulta odontológica" : "Consulta de enfermagem",
        date: "", details: "", conduct: "", nextStep: "", demandType: "scheduled", consultKind: "medica", consultDoctor: "", consultSpecialty: "",
      });
      setRecordVaccines([]);
      await loadSelectedPatientData(selectedPatientId);
      await loadAll();
    } catch (e) { if (!(await handleApiError(e))) setError(e.message || "Erro ao criar registro"); }
  }

  async function submitAppointment(e) {
    e.preventDefault();
    if (!selectedPatientId) return;
    if (!appointmentForm.date || !appointmentForm.summary) { setError("Preencha data e resumo."); return; }
    try {
      await createAppointment(token, selectedPatientId, appointmentForm);
      const title = String(user?.role || "") === "doctor" ? "Consulta médica" : "Consulta de enfermagem";
      const details = [appointmentForm.summary, appointmentForm.conduct, appointmentForm.nextStep].filter(v => String(v || "").trim()).join(" | ");
      await createRecord(token, selectedPatientId, { type: "consultation", title, date: appointmentForm.date, details });
      setAppointmentForm({ date: "", demandType: "scheduled", summary: "", conduct: "", nextStep: "" });
      await loadSelectedPatientData(selectedPatientId);
      await loadAll();
    } catch (e) { if (!(await handleApiError(e))) setError(e.message || "Erro ao registrar atendimento"); }
  }

  async function submitTask(e) {
    e.preventDefault();
    if (!selectedPatientId) return;
    if (!taskForm.title) { setError("Título obrigatório."); return; }
    try {
      await createTask(token, { patientId: selectedPatientId, assigneeId: taskForm.assigneeId || "", title: taskForm.title, notes: taskForm.notes, dueDate: taskForm.dueDate });
      const assignee = users.find(u => u.id === taskForm.assigneeId);
      await createRecord(token, selectedPatientId, {
        type: "task", date: new Date().toISOString().slice(0, 10), time: new Date().toTimeString().slice(0, 5),
        title: `Tarefa: ${taskForm.title}`,
        details: [taskForm.notes ? `Descrição: ${taskForm.notes}` : "", taskForm.dueDate ? `Prazo: ${new Date(taskForm.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}` : "", assignee ? `Responsável: ${assignee.name}` : ""].filter(Boolean).join("\n"),
        professionalName: user?.name || "", internalOnly: true,
      }).catch(() => {});
      setTaskForm({ title: "", notes: "", dueDate: "", assigneeId: "" });
      await loadSelectedPatientData(selectedPatientId);
      await loadAll();
    } catch (e) { if (!(await handleApiError(e))) setError(e.message || "Erro ao criar tarefa"); }
  }

  async function submitMessage(e) {
    e.preventDefault();
    if (!selectedPatientId || !messageText.trim()) return;
    try {
      await sendMessage(token, selectedPatientId, messageText.trim());
      await createRecord(token, selectedPatientId, {
        type: "message", date: new Date().toISOString().slice(0, 10), time: new Date().toTimeString().slice(0, 5),
        title: "Comunicação interna da equipe",
        details: messageText.trim(),
        professionalName: user?.name || "", internalOnly: true,
      }).catch(() => {});
      setMessageText("");
      await loadSelectedPatientData(selectedPatientId);
    } catch (e) { if (!(await handleApiError(e))) setError(e.message || "Erro ao enviar mensagem"); }
  }

  async function handleDeleteRecord(recordId, reason) {
    await deleteRecord(token, selectedPatientId, recordId, { reason });
    await loadSelectedPatientData(selectedPatientId);
    await loadAll();
  }

  async function handleDeleteAppointment(apptId, reason) {
    await deleteAppointment(token, selectedPatientId, apptId, { reason });
    await loadSelectedPatientData(selectedPatientId);
  }

  async function handleStatusChange(taskId, status) {
    await updateTaskStatus(token, taskId, status);
    await loadSelectedPatientData(selectedPatientId);
    await loadAll();
  }

  return {
    recordForm, setRecordForm,
    recordVaccines, setRecordVaccines,
    appointmentForm, setAppointmentForm,
    taskForm, setTaskForm,
    messageText, setMessageText,
    submitRecord, submitAppointment, submitTask, submitMessage,
    handleDeleteRecord, handleDeleteAppointment, handleStatusChange,
  };
}
