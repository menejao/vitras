import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService.js";
import { isValidCpf, formatCpf, rawCpf } from "../services/citizenIdentityService.js";

const IS_DEV = import.meta.env.DEV;
const DEMO_CPF  = "000.000.001-91";
const DEMO_PASS = "Demo@123";

const LogoMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5 L12 19 L19 5" />
  </svg>
);

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
    <main className="portal-auth">

      {/* ── Esquerda: institucional ── */}
      <section className="portal-auth__left">

        {/* Brand */}
        <div className="portal-auth__brand">
          <div className="portal-auth__logo-mark">
            <LogoMark />
          </div>
          <div>
            <div className="portal-auth__logo-name">VITRAS</div>
            <div className="portal-auth__logo-tag">Portal do Cidadão</div>
          </div>
        </div>

        {/* Hero */}
        <div className="portal-auth__hero">
          <span className="portal-auth-eyebrow">Atenção Primária à Saúde</span>
          <h1>Sua saúde na palma da mão.</h1>
          <p>Portal digital para acessar serviços da Atenção Primária à Saúde com segurança, praticidade e cuidado.</p>
        </div>

        {/* Cards de valor */}
        <div className="portal-auth-kpi-grid">
          <div className="portal-auth-info-card">
            <strong className="portal-auth-info-card__title">Consultas</strong>
            <span className="portal-auth-info-card__desc">Agende e acompanhe seus atendimentos.</span>
          </div>
          <div className="portal-auth-info-card">
            <strong className="portal-auth-info-card__title">UBS</strong>
            <span className="portal-auth-info-card__desc">Veja sua unidade de referência e avisos.</span>
          </div>
          <div className="portal-auth-info-card">
            <strong className="portal-auth-info-card__title">Saúde</strong>
            <span className="portal-auth-info-card__desc">Acompanhe vacinas, exames e medicamentos.</span>
          </div>
        </div>

      </section>

      {/* ── Direita: formulário ── */}
      <section className="portal-auth__right">
        <div className="portal-auth__right-inner">

          {/* Brand mobile (visível apenas ≤768px) */}
          <div className="portal-auth__brand-mobile">
            <div className="portal-auth__logo-mark">
              <LogoMark />
            </div>
            <div>
              <div className="portal-auth__logo-name">VITRAS</div>
              <div className="portal-auth__logo-tag">Portal do Cidadão</div>
            </div>
          </div>

          {/* Card de login */}
          <div className="portal-auth-card">
            <div className="portal-auth-card__header">
              <h2>Entrar no Portal</h2>
              <p>Acesse com seu CPF e senha.</p>
            </div>

            <form className="portal-auth-form" onSubmit={handleSubmit}>

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
                {busy ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite", display: "inline-block", verticalAlign: "middle", marginRight: 6 }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="50 30" strokeLinecap="round" />
                    </svg>
                    Entrando…
                  </>
                ) : "Entrar"}
              </button>

              <div className="portal-auth-links">
                <button
                  type="button"
                  className="portal-auth-link"
                  onClick={() => navigate("/primeiro-acesso")}
                  disabled={busy}
                >
                  Criar meu acesso
                </button>
                <span className="portal-auth-link portal-auth-link--hint">
                  Ainda sem cadastro? Procure sua UBS.
                </span>
              </div>

              {/* Zona demo — somente dev */}
              {IS_DEV && (
                <div className="portal-auth-demo-zone">
                  <button
                    type="button"
                    className="portal-auth-demo-btn"
                    onClick={handleDemoLogin}
                    disabled={busy}
                  >
                    Entrar com conta demo
                  </button>
                  <span className="portal-auth-demo-hint">CPF 000.000.001-91 · Demo@123</span>
                </div>
              )}

            </form>
          </div>

        </div>
      </section>

    </main>
  );
}
