import { useState } from "react";
import { updateMe } from "../api";

export function useProfile({ token, user, setUser, persistCookieSession }) {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", password: "", confirmPassword: "", currentPassword: "", councilNumber: "", councilUf: "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");

  function openProfile() {
    setProfileError("");
    setProfileForm({
      name: user?.name || "",
      email: user?.email || "",
      password: "",
      confirmPassword: "",
      currentPassword: "",
      councilNumber: user?.councilNumber || "",
      councilUf: user?.councilUf || "",
    });
    setShowProfileModal(true);
  }

  async function submitProfile(e) {
    e.preventDefault();
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      setProfileError("Nome e e-mail são obrigatórios.");
      return;
    }
    const changingPassword = Boolean(profileForm.password.trim());
    if (changingPassword) {
      if (profileForm.password.trim() !== (profileForm.confirmPassword || "").trim()) {
        setProfileError("As senhas não coincidem.");
        return;
      }
      if (!profileForm.currentPassword.trim()) {
        setProfileError("Informe sua senha atual para alterar a senha.");
        return;
      }
    }
    setProfileBusy(true);
    setProfileError("");
    try {
      const payload = {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        ...(changingPassword ? {
          password: profileForm.password.trim(),
          currentPassword: profileForm.currentPassword.trim(),
        } : {}),
        ...(["nurse_manager", "doctor", "dentist", "nursing_tech", "pharmacist", "pharmacy_tech"].includes(user?.role) && profileForm.councilNumber
          ? { councilNumber: profileForm.councilNumber.trim(), councilUf: profileForm.councilUf.trim().toUpperCase() }
          : {}),
      };
      const updated = await updateMe(token, payload);
      const newUser = { ...user, ...payload, ...(updated?.user || updated || {}) };
      setUser(newUser);
      persistCookieSession(newUser);
      setShowProfileModal(false);
    } catch (err) {
      setProfileError(err.message || "Erro ao salvar perfil.");
    } finally {
      setProfileBusy(false);
    }
  }

  return {
    showProfileModal, setShowProfileModal,
    profileForm, setProfileForm,
    profileBusy, profileError,
    openProfile, submitProfile,
  };
}
