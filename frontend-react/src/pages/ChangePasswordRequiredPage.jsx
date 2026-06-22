import { useState } from "react";
import { API_URL } from "../api";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import { BrandLockup } from "../components/brand/BrandLockup";

async function submitPasswordChange({ currentPassword, newPassword, newPasswordConfirm, token }) {
  if (newPassword !== newPasswordConfirm) {
    throw new Error("As senhas não coincidem.");
  }
  const res = await fetch(`${API_URL}/auth/change-password-required`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: "include",
    body: JSON.stringify({ currentPassword, newPassword })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Erro ao alterar senha.");
  return data;
}

export default function ChangePasswordRequiredPage({ token, onSuccess, onLogout }) {
  const [currentPassword, setCurrentPassword]       = useState("");
  const [newPassword, setNewPassword]               = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await submitPasswordChange({ currentPassword, newPassword, newPasswordConfirm, token });
      onSuccess(data);
    } catch (err) {
      setError(err.message || "Erro desconhecido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <BrandLockup size="md" />
          <h2 style={{ marginTop: "1rem", fontSize: "1.125rem", fontWeight: 600 }}>
            Troca de Senha Obrigatória
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginTop: "0.5rem" }}>
            Este é seu primeiro acesso. Defina uma senha definitiva para continuar.
          </p>
        </div>

        {error && <Alert type="error" style={{ marginBottom: "1rem" }}>{error}</Alert>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>
              Senha temporária (atual)
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>
              Nova senha
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
              Mínimo 8 caracteres, 1 maiúscula, 1 número, 1 símbolo.
            </p>
          </div>

          <div>
            <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "0.25rem" }}>
              Confirmar nova senha
            </label>
            <Input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" disabled={busy} style={{ marginTop: "0.5rem" }}>
            {busy ? "Alterando..." : "Definir nova senha"}
          </Button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            type="button"
            onClick={onLogout}
            style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer" }}
          >
            Sair do sistema
          </button>
        </div>
      </Card>
    </div>
  );
}
