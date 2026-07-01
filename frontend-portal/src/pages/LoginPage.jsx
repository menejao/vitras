import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService.js";
import { isValidCpf, formatCpf, rawCpf } from "../services/citizenIdentityService.js";

const IS_DEV = import.meta.env.DEV;
const DEMO_CPF  = "000.000.001-91";
const DEMO_PASS = "Demo@123";

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();

  const [cpf,   setCpf]   = useState("");
  const [senha, setSenha] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [erro,  setErro]  = useState("");

  async function handleSubmit(e, overrideCpf, overrideSenha) {
    if (e) e.preventDefault();
    setErro("");
    const digits = rawCpf(overrideCpf ?? cpf);
    const pw     = overrideSenha ?? senha;
    if (!isValidCpf(digits)) { setErro("CPF inválido. Verifique e tente novamente."); return; }
    if (!pw.trim())           { setErro("Informe sua senha."); return; }
    setBusy(true);
    try {
      const result = await login(digits, pw);
      onLogin({ ...result.cidadao, token: result.token });
    } catch (err) {
      setErro(err.message || "CPF ou senha incorretos.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDemoLogin() {
    setCpf(DEMO_CPF);
    setSenha(DEMO_PASS);
    await handleSubmit(null, rawCpf(DEMO_CPF), DEMO_PASS);
  }

  return (
    <div className="portal-login-shell">
      {/* Hero institucional */}
      <div className="portal-login-art">
        <div className="portal-login-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5 L12 19 L19 5" />
          </svg>
        </div>
        <div className="portal-login-title">VITRAS</div>
        <div className="portal-login-subtitle">Sua saúde na palma da mão.</div>
      </div>

      {/* Card de login */}
      <form className="portal-login-form" onSubmit={handleSubmit}>
        <div className="portal-login-form__title">Entrar</div>

        {erro && (
          <div className="alert alert--error" role="alert">
            {erro}
          </div>
        )}

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
            disabled={busy}
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
            disabled={busy}
          />
        </div>

        <button
          type="submit"
          className={"btn btn--primary btn--full" + (busy ? " btn--loading" : "")}
          disabled={busy}
        >
          {busy ? "" : "Entrar"}
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", marginTop: 8 }}>
          <button
            type="button"
            className="btn btn--ghost btn--full"
            onClick={() => navigate("/primeiro-acesso")}
            disabled={busy}
          >
            Criar meu acesso (primeiro acesso)
          </button>
          <p style={{ textAlign: "center", fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: 0 }}>
            Ainda sem cadastro? Procure sua UBS.
          </p>
        </div>

        {/* Acesso demo — visível apenas em desenvolvimento */}
        {IS_DEV && (
          <div className="portal-login-demo-zone">
            <button
              type="button"
              className="portal-login-demo-btn"
              onClick={handleDemoLogin}
              disabled={busy}
            >
              Entrar com conta demo
            </button>
            <span className="portal-login-demo-hint">CPF 000.000.001-91 · Demo@123</span>
          </div>
        )}
      </form>
    </div>
  );
}
