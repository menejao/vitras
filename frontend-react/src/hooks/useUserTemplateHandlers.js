import { useState } from "react";
import {
  createProtocolTemplate, deleteProtocolTemplate, deleteUser,
  getUserUsage, updateProtocolTemplate, updateUser,
} from "../api";
import { isAdmin, canManage, isManager } from "../utils/roles";

export function useUserTemplateHandlers({
  token,
  user,
  handleApiError,
  setBusy,
  setError,
  loadAll,
}) {
  const [editingUser, setEditingUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ role: "acs", name: "", email: "", password: "", councilNumber: "", councilUf: "" });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ category: "", label: "", visits: 0, consultations: 0, vaccines: 0, deadlinesVisits: 0, deadlinesConsultations: 0, deadlinesVaccines: 0, vaccineList: "" });
  const [pendingUserDelete, setPendingUserDelete] = useState(null);
  const [pendingTemplateDelete, setPendingTemplateDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");

  const canManageUser = isAdmin(user) || canManage(user);

  function openEditUser(u) {
    return () => {
      if (!u) return;
      setEditingUser(u);
      setUserForm({
        role: u?.role || "acs",
        name: String(u?.name || ""),
        email: String(u?.email || ""),
        password: "",
        councilNumber: String(u?.councilNumber || ""),
        councilUf: String(u?.councilUf || ""),
      });
      setShowUserModal(true);
    };
  }

  async function submitUser(e) {
    e.preventDefault();
    if (!token || !isManager(user) || !editingUser) return;
    if (!userForm.name.trim() || !userForm.email.trim()) { setError("Nome e e-mail são obrigatórios."); return; }
    setBusy(true); setError("");
    try {
      const needsCouncil = ["doctor", "dentist", "nurse_manager", "nursing_tech", "pharmacist", "pharmacy_tech"].includes(userForm.role);
      const payload = {
        role: userForm.role,
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        ...(userForm.password.trim() ? { password: userForm.password.trim() } : {}),
        ...(needsCouncil ? { councilNumber: userForm.councilNumber.trim(), councilUf: userForm.councilUf.trim().toUpperCase() } : {}),
      };
      await updateUser(token, editingUser.id, payload);
      setShowUserModal(false);
      await loadAll();
    } catch (e) {
      if (!(await handleApiError(e))) setError(e.message || "Erro ao salvar usuário");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(u) {
    if (!token || !isManager(user) || !u?.id) return;
    if (u.id === user.id) { setError("Não é possível excluir sua própria conta."); return; }
    setBusy(true); setError("");
    try {
      const usage = await getUserUsage(token, u.id);
      if (!usage?.canDelete) throw new Error(`Vínculos ativos impedem a exclusão (pacientes=${usage.assignedPatients || 0}, tarefas=${usage.openTasksAssigned || 0}).`);
      setPendingUserDelete(u);
      setDeleteReason("");
    } catch (e) {
      setError(e.message || "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  }

  function openEditTemplate(t) {
    return () => {
      setEditingTemplate(t);
      setTemplateForm(t ? {
        category: String(t?.category || ""),
        label: String(t?.label || ""),
        visits: Number(t?.targets?.visits || 0),
        consultations: Number(t?.targets?.consultations || 0),
        vaccines: Number(t?.targets?.vaccines || 0),
        deadlinesVisits: Number(t?.deadlines?.visits || 0),
        deadlinesConsultations: Number(t?.deadlines?.consultations || 0),
        deadlinesVaccines: Number(t?.deadlines?.vaccines || 0),
        vaccineList: Array.isArray(t?.vaccines) ? t.vaccines.join(", ") : "",
      } : { category: "", label: "", visits: 0, consultations: 0, vaccines: 0, deadlinesVisits: 0, deadlinesConsultations: 0, deadlinesVaccines: 0, vaccineList: "" });
      setShowTemplateModal(true);
    };
  }

  async function submitTemplate(e) {
    e.preventDefault();
    if (!token || !canManageUser) return;
    const category = String(templateForm.category || "").trim().toLowerCase();
    const label = String(templateForm.label || "").trim();
    if (!category || !label) { setError("Categoria e nome são obrigatórios."); return; }
    const payload = {
      category, label,
      targets: { visits: Number(templateForm.visits || 0), consultations: Number(templateForm.consultations || 0), vaccines: Number(templateForm.vaccines || 0) },
      deadlines: { visits: Number(templateForm.deadlinesVisits || 0), consultations: Number(templateForm.deadlinesConsultations || 0), vaccines: Number(templateForm.deadlinesVaccines || 0) },
      vaccines: String(templateForm.vaccineList || "").split(",").map(v => v.trim()).filter(Boolean),
    };
    setBusy(true); setError("");
    try {
      if (editingTemplate?.category) {
        await updateProtocolTemplate(token, editingTemplate.category, payload);
      } else {
        await createProtocolTemplate(token, payload);
      }
      setShowTemplateModal(false);
      await loadAll();
    } catch (e) {
      if (!(await handleApiError(e))) setError(e.message || "Erro ao salvar protocolo");
    } finally {
      setBusy(false);
    }
  }

  function removeTemplate(t) {
    if (!token || !canManageUser || !t?.category) return;
    setPendingTemplateDelete(t);
    setDeleteReason("");
  }

  async function confirmUserDelete() {
    if (!token || !pendingUserDelete?.id) return;
    if (String(deleteReason || "").trim().length < 8) { setError("Justificativa obrigatória com ao menos 8 caracteres."); return; }
    setBusy(true); setError("");
    try {
      await deleteUser(token, pendingUserDelete.id, { reason: String(deleteReason || "").trim() });
      setPendingUserDelete(null);
      setDeleteReason("");
      await loadAll();
    } catch (e) {
      setError(e.message || "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  }

  async function confirmTemplateDelete() {
    if (!token || !pendingTemplateDelete?.category) return;
    if (String(deleteReason || "").trim().length < 8) { setError("Justificativa obrigatória com ao menos 8 caracteres."); return; }
    setBusy(true); setError("");
    try {
      await deleteProtocolTemplate(token, pendingTemplateDelete.category, { reason: String(deleteReason || "").trim() });
      setPendingTemplateDelete(null);
      setDeleteReason("");
      await loadAll();
    } catch (e) {
      setError(e.message || "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  }

  return {
    editingUser, showUserModal, setShowUserModal, userForm, setUserForm,
    editingTemplate, showTemplateModal, setShowTemplateModal, templateForm, setTemplateForm,
    pendingUserDelete, setPendingUserDelete,
    pendingTemplateDelete, setPendingTemplateDelete,
    deleteReason, setDeleteReason,
    canManageUser,
    openEditUser, submitUser, removeUser,
    openEditTemplate, submitTemplate, removeTemplate,
    confirmUserDelete, confirmTemplateDelete,
  };
}
