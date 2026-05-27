import { useState } from "react";
import { API_URL, requestAccess } from "../api";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Alert from "../components/ui/Alert";
import KPI from "../components/ui/KPI";
import { Tabs, Tab } from "../components/ui/Tabs";
import { BrandMark } from "../components/brand/BrandMark";

const VITRAS_SUBTITLE = "Plataforma integrada para gestão da saúde pública";

const CARGO_OPTIONS = [
  { value: "", label: "Selecionar cargo / função..." },
  { value: "doctor", label: "Médico(a)" },
  { value: "nurse_manager", label: "Enfermeiro(a)" },
  { value: "nursing_tech", label: "Técnico(a) de Enfermagem" },
  { value: "dentist", label: "Dentista" },
  { value: "pharmacist", label: "Farmacêutico(a)" },
  { value: "pharmacy_tech", label: "Técnico(a) de Farmácia" },
  { value: "receptionist", label: "Recepção / Administrativo" },
  { value: "acs", label: "ACS - Agente Comunitário de Saúde" },
  { value: "gestor", label: "Gestor(a)" },
  { value: "coordinator", label: "Coordenador(a)" },
];

async function requestPasswordReset(email) {
  const res = await fetch(`${API_URL}/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Erro ao solicitar redefinição.");
  return data;
}

async function confirmPasswordReset(token, newPassword) {
  const res = await fetch(`${API_URL}/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token.trim(), newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Erro ao redefinir senha.");
  return data;
}

function ResetPasswordForm() {
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleRequest(event) {
    event.preventDefault();
    if (!email.trim()) return setErr("Informe e-mail institucional.");
    setBusy(true);
    setErr("");
    try {
      const data = await requestPasswordReset(email);
      setMsg(data.message || "Verifique seu e-mail para continuar.");
      if (data.resetToken) {
        setToken(data.resetToken);
        setStep("confirm");
      }
    } catch (error) {
      setErr(error.message || "Erro de conexão.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(event) {
    event.preventDefault();
    if (!token.trim()) return setErr("Informe token válido.");
    if (newPw.length < 8) return setErr("Senha deve ter pelo menos 8 caracteres.");
    if (newPw !== newPw2) return setErr("Senhas não coincidem.");
    setBusy(true);
    setErr("");
    try {
      await confirmPasswordReset(token, newPw);
      setMsg("Senha redefinida com sucesso. Faça login com a nova senha.");
      setStep("done");
    } catch (error) {
      setErr(error.message || "Falha ao redefinir senha.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <div className="auth-reset-done">
        <div className="auth-reset-done__icon">OK</div>
        <h3>Credencial atualizada</h3>
        <p>{msg}</p>
      </div>
    );
  }

  return (
    <form className="auth-form auth-form--stacked" onSubmit={step === "request" ? handleRequest : handleConfirm}>
      <p className="auth-form__intro">
        {step === "request"
          ? "Informe seu e-mail institucional para receber o link de redefinição."
          : "Defina nova senha forte. Sessões existentes serão encerradas após a troca."}
      </p>
      {step === "request" ? (
        <Input label="E-mail institucional" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@dominio.local" autoFocus autoComplete="email" />
      ) : (
        <>
          <Input label="Token de redefinição" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o token recebido" />
          <Input label="Nova senha" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} hint="Mínimo 8 caracteres, com maiúscula, número e símbolo." placeholder="********" />
          <Input label="Confirmar senha" type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} placeholder="********" />
        </>
      )}
      {err ? <Alert tone="danger">{err}</Alert> : null}
      {msg && step === "request" ? <Alert tone="success">{msg}</Alert> : null}
      <Button type="submit" variant="primary" size="lg" disabled={busy}>
        {busy ? (step === "request" ? "Enviando..." : "Redefinindo...") : (step === "request" ? "Solicitar redefinição" : "Redefinir senha")}
      </Button>
    </form>
  );
}

function AccessRequestForm() {
  const [form, setForm] = useState({ name: "", email: "", jobTitle: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.jobTitle) {
      return setErr("Nome, e-mail e cargo são obrigatórios.");
    }
    setBusy(true);
    setErr("");
    try {
      await requestAccess(form);
      setDone(true);
    } catch (error) {
      setErr(error.message || "Erro ao registrar solicitação.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth-reset-done">
        <div className="auth-reset-done__icon">OK</div>
        <h3>Solicitação enviada</h3>
        <p>Registrada para análise administrativa. Você receberá um e-mail com instruções após a aprovação.</p>
      </div>
    );
  }

  return (
    <form className="auth-form auth-form--stacked" onSubmit={handleSubmit}>
      <p className="auth-form__intro">
        O acesso é concedido após aprovação administrativa. Nenhuma conta ativa é criada neste momento.
      </p>
      <Input
        label="Nome completo"
        value={form.name}
        onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
        placeholder="Nome e sobrenome"
        autoComplete="name"
        autoFocus
      />
      <Input
        label="E-mail institucional"
        type="email"
        value={form.email}
        onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
        placeholder="usuario@dominio.local"
        autoComplete="email"
      />
      <Select
        label="Cargo / função"
        value={form.jobTitle}
        onChange={(e) => setForm((current) => ({ ...current, jobTitle: e.target.value }))}
      >
        {CARGO_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
      {err ? <Alert tone="danger">{err}</Alert> : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={busy || !form.name.trim() || !form.email.trim() || !form.jobTitle}
      >
        {busy ? "Enviando..." : "Enviar solicitação"}
      </Button>
    </form>
  );
}

function AuthScreen({ onLogin, onVerifyTwoFactor, loginChallenge, onCancelTwoFactor, error, busy }) {
  const [authTab, setAuthTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const cardTitles = {
    login: "Entrar na plataforma",
    request: "Solicitar acesso",
    reset: "Recuperar credencial",
  };

  const cardSubtitles = {
    login: loginChallenge ? "Informe o código 2FA para concluir o acesso institucional." : VITRAS_SUBTITLE,
    request: "Solicitações são revisadas pela equipe administrativa antes da aprovação.",
    reset: "Fluxo seguro de redefinição de senha via e-mail institucional.",
  };

  return (
    <main className="auth">
      <section className="auth__left">
        <div className="auth__brand">
          <div className="auth-brand-lockup">
            <div className="auth-brand-lockup__icon"><BrandMark variant="solid" size={40} /></div>
            <div className="auth-brand-lockup__copy">
              <strong>Vitras</strong>
              <span>{VITRAS_SUBTITLE}</span>
            </div>
          </div>
        </div>

        <div className="auth__hero">
          <span className="auth-eyebrow">Acesso à plataforma</span>
          <h1>Infraestrutura institucional para gestão integrada da saúde pública.</h1>
          <p>Acesso seguro, rastreabilidade completa e módulos operacionais para equipes autorizadas.</p>
        </div>

        <div className="auth-kpi-grid">
          <KPI className="auth-info-card">
            <strong className="auth-info-card__title">Segurança</strong>
            <span className="auth-info-card__desc">MFA e controle de acesso</span>
          </KPI>
          <KPI className="auth-info-card">
            <strong className="auth-info-card__title">Conformidade</strong>
            <span className="auth-info-card__desc">LGPD e rastreabilidade</span>
          </KPI>
          <KPI className="auth-info-card">
            <strong className="auth-info-card__title">Multi-tenant</strong>
            <span className="auth-info-card__desc">Módulos por organização</span>
          </KPI>
        </div>
      </section>

      <section className="auth__right">
        <div className="auth__right-inner">
          <Card className="auth-card">
            <div className="auth-card__header">
              <h2>{cardTitles[authTab]}</h2>
              <p>{cardSubtitles[authTab]}</p>
            </div>

            <Tabs className="auth-tabs">
              <Tab active={authTab === "login"} onClick={() => setAuthTab("login")}>Entrar</Tab>
              <Tab active={authTab === "request"} onClick={() => setAuthTab("request")}>Solicitar acesso</Tab>
              <Tab active={authTab === "reset"} onClick={() => setAuthTab("reset")}>Recuperar senha</Tab>
            </Tabs>

            {authTab === "login" ? (
              loginChallenge ? (
                <form className="auth-form auth-form--stacked" onSubmit={(event) => { event.preventDefault(); onVerifyTwoFactor(twoFactorCode); }}>
                  <Alert tone="info">
                    Código solicitado para <strong>{loginChallenge.email}</strong>.
                  </Alert>
                  <Input
                    label="Código 2FA"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D+/g, "").slice(0, 6))}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                  {error ? <Alert tone="danger">{error}</Alert> : null}
                  <Button type="submit" variant="primary" size="lg" disabled={busy || twoFactorCode.length !== 6}>
                    {busy ? "Validando..." : "Validar código"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    disabled={busy}
                    onClick={() => {
                      setTwoFactorCode("");
                      onCancelTwoFactor?.();
                    }}
                  >
                    Voltar
                  </Button>
                </form>
              ) : (
                <form className="auth-form auth-form--stacked" onSubmit={(event) => { event.preventDefault(); onLogin(email, password); }}>
                  <Input label="E-mail institucional" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@dominio.local" autoComplete="email" autoFocus />
                  <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" autoComplete="current-password" />
                  {error ? <Alert tone="danger">{error}</Alert> : null}
                  <Button type="submit" variant="primary" size="lg" disabled={busy}>
                    {busy ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite", display: "inline-block", verticalAlign: "middle", marginRight: "6px" }}>
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="50 30" strokeLinecap="round" />
                        </svg>
                        Entrando...
                      </>
                    ) : "Entrar"}
                  </Button>
                </form>
              )
            ) : authTab === "request" ? (
              <AccessRequestForm />
            ) : (
              <ResetPasswordForm />
            )}
          </Card>

          <p className="auth-page-footer">
            <a href="/activate" className="auth-footer-link">Primeiro acesso administrativo -&gt;</a>
          </p>
        </div>
      </section>
    </main>
  );
}

export default AuthScreen;
