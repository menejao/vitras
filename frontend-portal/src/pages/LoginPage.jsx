import { useState } from "react";

export default function LoginPage({ onLogin }) {
  const [cpf,    setCpf]    = useState("");
  const [senha,  setSenha]  = useState("");
  const [busy,   setBusy]   = useState(false);
  const [erro,   setErro]   = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) { setErro("CPF inválido. Informe 11 dígitos."); return; }
    if (!senha.trim())         { setErro("Informe sua senha."); return; }
    setBusy(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      onLogin({
        nome:     "Maria Silva",
        cpf:      digits,
        unitId:   "test-unit",
        token:    "portal-mock-token",
      });
    } catch {
      setErro("Não foi possível entrar. Verifique CPF e senha.");
    } finally {
      setBusy(false);
    }
  }

  function fmtCpf(raw) {
    const d = raw.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
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

        {erro && (
          <div className="alert alert--error" role="alert">{erro}</div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="login-cpf">CPF</label>
          <input
            id="login-cpf"
            className="field__input"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={fmtCpf(cpf)}
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

        <p style={{ textAlign: "center", fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          Novo no VITRAS? Procure sua UBS para se cadastrar.
        </p>
      </form>
    </div>
  );
}
