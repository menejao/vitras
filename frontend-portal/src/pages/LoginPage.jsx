import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService.js";
import { isValidCpf, formatCpf, rawCpf } from "../services/citizenIdentityService.js";

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();

  const [cpf,   setCpf]   = useState("");
  const [senha, setSenha] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [erro,  setErro]  = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    const digits = rawCpf(cpf);
    if (!isValidCpf(digits)) { setErro("CPF inválido. Verifique e tente novamente."); return; }
    if (!senha.trim())        { setErro("Informe sua senha."); return; }
    setBusy(true);
    try {
      const result = await login(digits, senha);
      onLogin({ ...result.cidadao, token: result.token });
    } catch (err) {
      setErro(err.message || "CPF ou senha incorretos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portal-login-shell">
      <div className="portal-login-art">
        <div className="portal-login-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5 L12 19 L19 5" />
          </svg>
        </div>
        <div className="portal-login-title">VITRAS</div>
        <div className="portal-login-subtitle">Sua saúde na palma da mão.</div>
      </div>

      <form className="portal-login-form" onSubmit={handleSubmit}>
        <div className="portal-login-form__title">Entrar</div>

        {erro && <div className="alert alert--error" role="alert" style={{ marginBottom: 16 }}>{erro}</div>}

        <div className="field">
          <label className="field__label" htmlFor="login-cpf">CPF</label>
          <input
            id="login-cpf"
            className="field__input"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={formatCpf(cpf)}
            onChange={e => setCpf(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-senha">Senha</label>
          <input
            id="login-senha"
            type="password"
            className="field__input"
            placeholder="••••••••"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className={"btn btn--primary btn--full" + (busy ? " btn--loading" : "")}
          disabled={busy}
        >
          {busy ? "" : "Entrar"}
        </button>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="btn btn--ghost btn--full"
            onClick={() => navigate("/primeiro-acesso")}
          >
            Criar meu acesso (primeiro acesso)
          </button>
          <p style={{ textAlign: "center", fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: 0 }}>
            Ainda sem cadastro? Procure sua UBS.
          </p>
        </div>
      </form>
    </div>
  );
}
