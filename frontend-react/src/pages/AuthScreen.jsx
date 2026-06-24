import { useState } from "react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import KPI from "../components/ui/KPI";
import { BrandLockup } from "../components/brand/BrandLockup";

const VITRAS_SUBTITLE = "Plataforma integrada para gestão da saúde pública";

function AuthScreen({ onLogin, onVerifyTwoFactor, loginChallenge, onCancelTwoFactor, error, busy }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");

  return (
    <main className="auth">
      <section className="auth__left">
        <div className="auth__brand">
          <BrandLockup variant="primary-dark" className="auth-lockup" />
        </div>

        <div className="auth__hero">
          <span className="auth-eyebrow">Acesso à plataforma</span>
          <h1>Infraestrutura institucional para gestão integrada da saúde pública.</h1>
          <p>Acesso seguro, rastreabilidade completa e módulos operacionais para equipes autorizadas.</p>
        </div>

        <div className="auth-kpi-grid">
          <KPI className="auth-info-card">
            <strong className="auth-info-card__title">Segurança</strong>
            <span className="auth-info-card__desc">Autenticação multifator e controle por perfil clínico</span>
          </KPI>
          <KPI className="auth-info-card">
            <strong className="auth-info-card__title">Conformidade</strong>
            <span className="auth-info-card__desc">Conformidade com LGPD e audit log imutável</span>
          </KPI>
          <KPI className="auth-info-card">
            <strong className="auth-info-card__title">Multi-tenant</strong>
            <span className="auth-info-card__desc">Isolamento por equipe e escalabilidade municipal</span>
          </KPI>
        </div>
      </section>

      <section className="auth__right">
        <div className="auth__right-inner">
          <Card className="auth-card">
            <div className="auth-card__header">
              <h2>Entrar na plataforma</h2>
              <p>{loginChallenge ? "Informe o código 2FA para concluir o acesso institucional." : VITRAS_SUBTITLE}</p>
            </div>

            {loginChallenge ? (
              <form className="auth-form auth-form--stacked" onSubmit={(event) => { event.preventDefault(); onVerifyTwoFactor(twoFactorCode); }}>
                <Alert tone="info">
                  Código solicitado para <strong>{loginChallenge?.email || loginChallenge?.name || "seu usuário"}</strong>.
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
              <form className="auth-form auth-form--stacked" onSubmit={(event) => { event.preventDefault(); onLogin(identifier, password); }}>
                <Input
                  label="ID VITRAS"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="000000000"
                  autoComplete="off"
                  autoFocus
                  inputMode="numeric"
                />
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
            )}
          </Card>
        </div>
      </section>
    </main>
  );
}

export default AuthScreen;
