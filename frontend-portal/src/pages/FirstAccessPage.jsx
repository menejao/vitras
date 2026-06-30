import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkCpf, verifyIdentity, createAccount } from "../services/authService.js";
import {
  isValidCpf, formatCpf, rawCpf,
  formatDateInput, dateToIso,
  isStrongPassword,
} from "../services/citizenIdentityService.js";

// ── Steps ─────────────────────────────────────────────────────────────────────
// 1: CPF
// 2: identity verification (name, birthDate, optional motherName/phone)
// 3: create password + terms
// 4: success

export default function FirstAccessPage({ onLogin }) {
  const navigate = useNavigate();

  const [step,         setStep]         = useState(1);
  const [busy,         setBusy]         = useState(false);
  const [erro,         setErro]         = useState("");

  // Step 1
  const [cpf,          setCpf]          = useState("");

  // Step 2
  const [birthDate,    setBirthDate]    = useState("");
  const [name,         setName]         = useState("");
  const [motherName,   setMotherName]   = useState("");
  const [phone,        setPhone]        = useState("");
  const [verifyToken,  setVerifyToken]  = useState("");
  const [hint,         setHint]         = useState(null);

  // Step 3
  const [senha,        setSenha]        = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [aceitaTermos, setAceitaTermos] = useState(false);
  const [aceitaPriv,   setAceitaPriv]   = useState(false);

  function goBack() {
    setErro("");
    if (step > 1) setStep(step - 1);
    else navigate("/login");
  }

  // ── Step 1: Check CPF ────────────────────────────────────────────────────────
  async function handleCheckCpf(e) {
    e.preventDefault();
    setErro("");
    const digits = rawCpf(cpf);
    if (!isValidCpf(digits)) { setErro("CPF inválido. Verifique e tente novamente."); return; }
    setBusy(true);
    try {
      const { exists, hasPortalAccount } = await checkCpf(digits);
      if (hasPortalAccount) {
        setErro("Este CPF já possui uma conta no Portal. Faça login normalmente.");
        return;
      }
      if (!exists) {
        setErro(
          "Não encontramos seu cadastro no VITRAS. Procure sua UBS de referência para " +
          "realizar ou atualizar seu cadastro antes de criar acesso ao Portal."
        );
        return;
      }
      setStep(2);
    } catch (err) {
      setErro(err.message || "Erro ao verificar CPF. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: Verify identity ──────────────────────────────────────────────────
  async function handleVerify(e) {
    e.preventDefault();
    setErro("");
    const digits = rawCpf(cpf);
    if (!birthDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) { setErro("Informe data de nascimento completa (DD/MM/AAAA)."); return; }
    if (!name.trim()) { setErro("Informe seu nome completo."); return; }
    setBusy(true);
    try {
      const result = await verifyIdentity({
        cpf:        digits,
        birthDate:  dateToIso(birthDate),
        name:       name.trim(),
        motherName: motherName.trim() || undefined,
        phone:      phone.replace(/\D/g, "") || undefined,
      });
      if (!result.compatible) {
        setErro(
          "Os dados informados não conferem com o cadastro existente na sua UBS de referência. " +
          "Por segurança, procure sua UBS para atualizar seus dados cadastrais."
        );
        return;
      }
      setVerifyToken(result.verifyToken);
      setHint(result.hint);
      setStep(3);
    } catch (err) {
      setErro(err.message || "Erro ao verificar dados. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step 3: Create account ───────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    setErro("");
    if (!isStrongPassword(senha))    { setErro("Senha deve ter pelo menos 8 caracteres."); return; }
    if (senha !== confirmSenha)       { setErro("Confirmação de senha não confere."); return; }
    if (!aceitaTermos)                { setErro("Você precisa aceitar os termos de uso para continuar."); return; }
    if (!aceitaPriv)                  { setErro("Você precisa aceitar a política de privacidade para continuar."); return; }
    setBusy(true);
    try {
      const result = await createAccount({
        verifyToken,
        senha,
        confirmSenha,
        aceitaTermos,
        aceitaPrivacidade: aceitaPriv,
      });
      onLogin({ ...result.cidadao, token: result.token });
      setStep(4);
    } catch (err) {
      setErro(err.message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="portal-login-shell">
      <div className="portal-login-art">
        <div className="portal-login-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5 L12 19 L19 5" />
          </svg>
        </div>
        <div className="portal-login-title">VITRAS</div>
        <div className="portal-login-subtitle">Primeiro acesso ao Portal</div>
      </div>

      {step === 4 ? (
        <div className="portal-login-form" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div className="portal-login-form__title" style={{ marginBottom: 8 }}>Conta criada!</div>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: 24 }}>
            Seu acesso ao Portal VITRAS está ativo. Você já está dentro.
          </p>
          <button className="btn btn--primary btn--full" onClick={() => navigate("/home")}>
            Ir para o início
          </button>
        </div>
      ) : (
        <form
          className="portal-login-form"
          onSubmit={step === 1 ? handleCheckCpf : step === 2 ? handleVerify : handleCreate}
        >
          {/* Progress indicator */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: s <= step ? "var(--accent)" : "var(--border)",
                transition: "background 300ms",
              }} />
            ))}
          </div>

          <div className="portal-login-form__title" style={{ marginBottom: 4 }}>
            {step === 1 && "Informe seu CPF"}
            {step === 2 && "Confirme sua identidade"}
            {step === 3 && "Crie sua senha"}
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: 20, margin: "0 0 20px" }}>
            {step === 1 && "Usaremos seu CPF para localizar seu cadastro na UBS."}
            {step === 2 && "Preencha seus dados para confirmar que você é o titular do cadastro."}
            {step === 3 && `Olá${hint?.nomeExibicao ? ", " + hint.nomeExibicao : ""}! Crie uma senha segura para sua conta.`}
          </p>

          {erro && <div className="alert alert--error" role="alert" style={{ marginBottom: 16 }}>{erro}</div>}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="field">
              <label className="field__label" htmlFor="fa-cpf">CPF</label>
              <input
                id="fa-cpf"
                className="field__input"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={formatCpf(cpf)}
                onChange={e => setCpf(e.target.value)}
                autoComplete="username"
              />
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (<>
            <div className="field">
              <label className="field__label" htmlFor="fa-name">Nome completo</label>
              <input
                id="fa-name"
                className="field__input"
                placeholder="Igual ao documento"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="fa-birth">Data de nascimento</label>
              <input
                id="fa-birth"
                className="field__input"
                inputMode="numeric"
                placeholder="DD/MM/AAAA"
                value={birthDate}
                onChange={e => setBirthDate(formatDateInput(e.target.value))}
                autoComplete="bday"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="fa-mother">
                Nome da mãe <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opcional)</span>
              </label>
              <input
                id="fa-mother"
                className="field__input"
                placeholder="Opcional"
                value={motherName}
                onChange={e => setMotherName(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="fa-phone">
                Celular <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opcional)</span>
              </label>
              <input
                id="fa-phone"
                className="field__input"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
          </>)}

          {/* STEP 3 */}
          {step === 3 && (<>
            <div className="field">
              <label className="field__label" htmlFor="fa-senha">Senha</label>
              <input
                id="fa-senha"
                type="password"
                className="field__input"
                placeholder="Mínimo 8 caracteres"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoComplete="new-password"
              />
              {senha && (
                <span style={{ fontSize: "var(--t-xs)", color: isStrongPassword(senha) ? "var(--success, #16a34a)" : "var(--danger, #dc2626)" }}>
                  {isStrongPassword(senha) ? "Senha válida" : "Mínimo 8 caracteres"}
                </span>
              )}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="fa-confirm">Confirmar senha</label>
              <input
                id="fa-confirm"
                type="password"
                className="field__input"
                placeholder="Repita a senha"
                value={confirmSenha}
                onChange={e => setConfirmSenha(e.target.value)}
                autoComplete="new-password"
              />
              {confirmSenha && (
                <span style={{ fontSize: "var(--t-xs)", color: confirmSenha === senha ? "var(--success, #16a34a)" : "var(--danger, #dc2626)" }}>
                  {confirmSenha === senha ? "Senhas conferem" : "Senhas não conferem"}
                </span>
              )}
            </div>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={aceitaTermos}
                onChange={e => setAceitaTermos(e.target.checked)}
                style={{ marginTop: 3, flexShrink: 0, width: 18, height: 18 }}
              />
              <span style={{ fontSize: "var(--t-sm)", color: "var(--text)" }}>
                Li e aceito os <strong>Termos de Uso</strong> do Portal do Cidadão VITRAS
              </span>
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 20, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={aceitaPriv}
                onChange={e => setAceitaPriv(e.target.checked)}
                style={{ marginTop: 3, flexShrink: 0, width: 18, height: 18 }}
              />
              <span style={{ fontSize: "var(--t-sm)", color: "var(--text)" }}>
                Li e aceito a <strong>Política de Privacidade</strong> e o tratamento dos meus dados de saúde conforme a LGPD
              </span>
            </label>
          </>)}

          <button
            type="submit"
            className={"btn btn--primary btn--full" + (busy ? " btn--loading" : "")}
            disabled={busy}
          >
            {busy ? "" : step === 1 ? "Continuar" : step === 2 ? "Confirmar dados" : "Criar conta"}
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--full"
            style={{ marginTop: 8 }}
            onClick={goBack}
            disabled={busy}
          >
            {step === 1 ? "Voltar ao login" : "Voltar"}
          </button>
        </form>
      )}
    </div>
  );
}
