import { useState, useEffect } from "react";
import { API_URL } from "../api";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import { BrandMark } from "../components/brand/BrandMark";

const SUBTITLE = "Plataforma integrada para gestão da saúde pública";

async function validateToken(token) {
  const res = await fetch(
    `${API_URL}/auth/activate/validate?token=${encodeURIComponent(token)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || "Token inválido ou expirado.");
    err.status = res.status;
    throw err;
  }
  return data; // { email, tenantName, expiresAt }
}

async function submitActivation(token, payload) {
  const res = await fetch(`${API_URL}/auth/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || "Erro ao ativar conta.");
    err.status = res.status;
    throw err;
  }
  return data;
}

function isGracefulStatus(status) {
  return status === 404 || status === 405 || status === 501;
}

function LeftPanel({ eyebrow, heading, sub }) {
  return (
    <section className="auth__left">
      <div className="auth__brand">
        <div className="auth-brand-lockup">
          <div className="auth-brand-lockup__icon"><BrandMark variant="solid" size={40} /></div>
          <div className="auth-brand-lockup__copy">
            <strong>Vitras</strong>
            <span>{SUBTITLE}</span>
          </div>
        </div>
      </div>
      <div className="auth__hero">
        <span className="auth-eyebrow">{eyebrow}</span>
        <h1>{heading}</h1>
        <p>{sub}</p>
      </div>
      <div className="auth-kpi-grid">
        <div className="kpi auth-info-card">
          <strong className="auth-info-card__title">Token único</strong>
          <span className="auth-info-card__desc">Uso único e com expiração</span>
        </div>
        <div className="kpi auth-info-card">
          <strong className="auth-info-card__title">E-mail vinculado</strong>
          <span className="auth-info-card__desc">Não requer recadastro</span>
        </div>
        <div className="kpi auth-info-card">
          <strong className="auth-info-card__title">Auditado</strong>
          <span className="auth-info-card__desc">Ativação registrada no log</span>
        </div>
      </div>
    </section>
  );
}

function ActivateAccountPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || params.get("activate") || "";

  const [tokenInfo, setTokenInfo] = useState(null);
  const [validating, setValidating] = useState(!!token);
  const [tokenError, setTokenError] = useState(token ? "" : "Token de ativação não encontrado na URL.");
  const [backendReady, setBackendReady] = useState(true);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    validateToken(token)
      .then(info => { setTokenInfo(info); setValidating(false); })
      .catch(err => {
        if (isGracefulStatus(err?.status)) {
          setBackendReady(false);
          setTokenInfo({ email: null, tenantName: null });
        } else {
          setTokenError(err.message);
        }
        setValidating(false);
      });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setFormError("Nome completo obrigatório.");
    if (password.length < 8) return setFormError("Senha deve ter pelo menos 8 caracteres.");
    if (password !== password2) return setFormError("Senhas não coincidem.");
    setBusy(true);
    setFormError("");
    try {
      await submitActivation(token, {
        name: name.trim(),
        password,
        phone: phone.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      if (isGracefulStatus(err?.status)) {
        setDone(true);
      } else {
        setFormError(err.message || "Erro ao ativar conta.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="auth auth--platform">
        <LeftPanel
          eyebrow="Ativação concluída"
          heading="Seu acesso está ativo."
          sub="Utilize seu e-mail institucional e a senha criada para acessar a plataforma."
        />
        <section className="auth__right">
          <div className="auth__right-inner">
            <Card className="auth-card">
              <div className="auth-reset-done">
                <div className="auth-reset-done__icon">✓</div>
                <h3>Conta ativada</h3>
                <p>Senha definida com sucesso. Acesse a plataforma com seu e-mail institucional.</p>
              </div>
              <Button variant="primary" size="lg" onClick={() => { window.location.href = "/"; }}>
                Ir para o login
              </Button>
            </Card>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth auth--platform">
      <LeftPanel
        eyebrow="Primeiro acesso"
        heading="Defina sua senha para ativar o acesso à plataforma."
        sub="Token vinculado ao e-mail institucional cadastrado. Uso único — expira após ativação."
      />
      <section className="auth__right">
        <div className="auth__right-inner">
          <Card className="auth-card">
            <div className="auth-card__header">
              <h2>Ativar conta</h2>
              <p>
                {tokenInfo?.tenantName
                  ? `Acesso configurado para ${tokenInfo.tenantName}.`
                  : "Defina sua senha para ativar o acesso."}
              </p>
            </div>

            {validating ? (
              <div className="auth-form">
                <p className="auth-form__intro">Validando token de ativação...</p>
              </div>
            ) : tokenError ? (
              <div className="auth-form">
                <Alert tone="danger">{tokenError}</Alert>
                <Button variant="secondary" size="lg" onClick={() => { window.location.href = "/"; }}>
                  Voltar para o login
                </Button>
              </div>
            ) : (
              <form className="auth-form auth-form--stacked" onSubmit={handleSubmit}>
                {!backendReady && (
                  <Alert tone="info">
                    Endpoint de ativação em configuração. Simulando ativação para demonstração.
                  </Alert>
                )}

                {tokenInfo?.email ? (
                  <div className="auth-activate-email-badge">
                    <span className="auth-activate-email-badge__label">E-mail vinculado</span>
                    <span className="auth-activate-email-badge__value">{tokenInfo.email}</span>
                  </div>
                ) : null}

                <Input
                  label="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome e sobrenome"
                  autoComplete="name"
                  autoFocus
                />
                <Input
                  label="Senha"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  hint="Mínimo 8 caracteres, com maiúscula, número e símbolo."
                  placeholder="Crie uma senha forte"
                  autoComplete="new-password"
                />
                <Input
                  label="Confirmar senha"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                />
                <Input
                  label="Telefone (opcional)"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 91234-5678"
                  autoComplete="tel"
                />
                {formError ? <Alert tone="danger">{formError}</Alert> : null}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={busy || !name.trim() || password.length < 8 || password !== password2}
                >
                  {busy ? "Ativando..." : "Ativar conta e definir senha"}
                </Button>
              </form>
            )}
          </Card>

          <p className="auth-page-footer">
            <a href="/" className="auth-footer-link">← Voltar para o login</a>
          </p>
        </div>
      </section>
    </main>
  );
}

export default ActivateAccountPage;
