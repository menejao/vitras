/**
 * MeuCadastroPage.jsx — Meu Cadastro do Portal do Cidadão
 *
 * Seções:
 *   1. Indicador de qualidade cadastral
 *   2. Dados pessoais (somente leitura — fonte: APS)
 *   3. Contato (editável — telefone e e-mail com fluxo OTP)
 *   4. Endereço (somente leitura — orientação para UBS)
 *   5. Dados da APS (somente leitura — UBS, equipe, ACS)
 *   6. Preferências de comunicação
 *   7. Alteração de senha
 *
 * Fluxo OTP (modal bottom-sheet):
 *   Passo 1: digitar novo valor (telefone/e-mail)
 *   Passo 2: digitar código recebido
 *   Passo 3: sucesso
 */

import { useState, useEffect, useRef } from "react";
import { getPerfil, alterarSenha, salvarPreferencias, formatarDataNasc, getInitials } from "../services/citizenProfileService.js";
import * as otpSvc from "../services/otpService.js";
import { formatarTelefone, isValidEmail, isValidPhone } from "../services/contactVerificationService.js";

// ── Icons ──────────────────────────────────────────────────────────────────────
const IcoUser     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoPhone    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IcoPin      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IcoBuilding = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoBell     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoShield   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoKey      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
const IcoChevron  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IcoCheck    = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function Sk({ h = 48, r = 10, mb = 8 }) {
  return <div className="portal-skeleton" style={{ height: h, borderRadius: r, marginBottom: mb }} />;
}

// ── Badge de qualidade ─────────────────────────────────────────────────────────
function QualidadeBadge({ qualidade }) {
  if (!qualidade) return null;
  const map = {
    verde:    { dot: "var(--green-600, #16a34a)", bg: "var(--green-50, #f0fdf4)", color: "var(--green-700, #15803d)", border: "var(--green-200, #bbf7d0)" },
    amarelo:  { dot: "var(--yellow-500, #eab308)", bg: "var(--yellow-50, #fefce8)", color: "var(--yellow-700, #a16207)", border: "var(--yellow-200, #fef08a)" },
    vermelho: { dot: "var(--red-500, #ef4444)",  bg: "var(--red-50)",              color: "var(--red-600)",             border: "var(--red-200, #fecaca)"  },
  };
  const s = map[qualidade.nivel] || map.amarelo;
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "var(--r-lg)", padding: "var(--s-3) var(--s-4)",
      marginBottom: "var(--s-5)", display: "flex", gap: "var(--s-3)", alignItems: "flex-start",
    }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.dot, flexShrink: 0, marginTop: 4 }} />
      <div>
        <div style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: s.color }}>{qualidade.texto}</div>
        {qualidade.problemas?.length > 0 && (
          <div style={{ fontSize: "var(--t-xs)", color: s.color, marginTop: 2 }}>
            {qualidade.problemas.map((p, i) => <div key={i}>• {p}</div>)}
          </div>
        )}
        {qualidade.nivel !== "verde" && (
          <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 4 }}>
            Para dados oficiais incorretos, procure sua UBS pessoalmente.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Seção com título ──────────────────────────────────────────────────────────
function Section({ titulo, icon, children, acao, acaoLabel }) {
  return (
    <section style={{ marginBottom: "var(--s-5)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--s-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
          {icon && <span style={{ color: "var(--text-muted)", display: "flex" }}>{icon}</span>}
          <h2 style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
            {titulo}
          </h2>
        </div>
        {acao && (
          <button onClick={acao} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "var(--t-sm)", color: "var(--accent)", fontWeight: 600, padding: "var(--s-1) var(--s-2)" }}>
            {acaoLabel || "Editar"}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

// ── Campo somente leitura ─────────────────────────────────────────────────────
function Campo({ label, value, destaque }) {
  if (!value) return null;
  return (
    <div style={{ padding: "var(--s-3) 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "var(--t-md)", color: destaque ? "var(--accent)" : "var(--text)", fontWeight: destaque ? 600 : 400 }}>{value}</div>
    </div>
  );
}

// ── Card base ─────────────────────────────────────────────────────────────────
function Card({ children }) {
  return (
    <div className="portal-dash-card" style={{ marginBottom: 0 }}>
      <div style={{ padding: "var(--s-1) var(--s-4) var(--s-3)" }}>
        {children}
      </div>
    </div>
  );
}

// ── Toggle de preferência ─────────────────────────────────────────────────────
function PrefToggle({ label, sub, value, onChange, disabled }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--s-3) 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>{label}</div>
        {sub && <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        role="switch" aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 99, border: "none", cursor: disabled ? "not-allowed" : "pointer",
          background: value ? "var(--accent)" : "var(--border)",
          position: "relative", transition: "background 200ms", flexShrink: 0, marginLeft: "var(--s-3)",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: value ? 22 : 2, width: 20, height: 20,
          background: "#fff", borderRadius: 99, transition: "left 200ms", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
        }} />
      </button>
    </div>
  );
}

// ── Modal OTP (bottom sheet) ───────────────────────────────────────────────────
function ModalOtp({ tipo, onClose, onSuccess }) {
  const [passo,    setPasso]    = useState(1); // 1=valor, 2=código, 3=sucesso
  const [valor,    setValor]    = useState("");
  const [codigo,   setCodigo]   = useState("");
  const [otpInfo,  setOtpInfo]  = useState(null); // { otpId, expiraEm, mensagem, _devCode }
  const [loading,  setLoading]  = useState(false);
  const [erro,     setErro]     = useState("");
  const inputRef = useRef(null);

  const labelTipo = tipo === "telefone" ? "Telefone" : "E-mail";
  const placeholder = tipo === "telefone" ? "(11) 99999-9999" : "seu@email.com.br";

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, [passo]);

  async function handleSolicitarCodigo() {
    setErro(""); setLoading(true);
    try {
      const resultado = await otpSvc.iniciar(tipo, valor.trim());
      setOtpInfo(resultado);
      setPasso(2);
    } catch (e) {
      setErro(e.message);
    } finally { setLoading(false); }
  }

  async function handleConfirmar() {
    setErro(""); setLoading(true);
    try {
      await otpSvc.confirmar(codigo);
      await otpSvc.aplicar();
      setPasso(3);
    } catch (e) {
      setErro(e.message);
    } finally { setLoading(false); }
  }

  async function handleReenviar() {
    setErro(""); setLoading(true);
    try {
      const resultado = await otpSvc.reenviar();
      setOtpInfo(resultado);
      setCodigo("");
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ width: "100%", maxWidth: 480, background: "var(--bg)", borderRadius: "var(--r-xl) var(--r-xl) 0 0", padding: "var(--s-5)", boxShadow: "0 -8px 32px rgba(0,0,0,.15)" }}>

        {passo === 1 && (
          <>
            <h3 style={{ fontSize: "var(--t-lg)", fontWeight: 700, margin: "0 0 var(--s-2)" }}>Alterar {labelTipo}</h3>
            <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: "0 0 var(--s-4)" }}>
              Informe o novo {labelTipo.toLowerCase()}. Um código de verificação será enviado.
            </p>
            {erro && <div className="alert alert--error" style={{ marginBottom: "var(--s-3)" }}>{erro}</div>}
            <input
              ref={inputRef}
              type={tipo === "email" ? "email" : "tel"}
              inputMode={tipo === "email" ? "email" : "tel"}
              value={valor}
              onChange={e => setValor(tipo === "telefone" ? formatarTelefone(e.target.value) : e.target.value)}
              placeholder={placeholder}
              className="input"
              style={{ width: "100%", marginBottom: "var(--s-4)", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: "var(--s-2)" }}>
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
              <button
                className={"btn btn--primary" + (loading ? " btn--loading" : "")}
                style={{ flex: 1 }}
                disabled={loading || (tipo === "telefone" ? !isValidPhone(valor) : !isValidEmail(valor))}
                onClick={handleSolicitarCodigo}
              >
                {loading ? "" : "Enviar Código"}
              </button>
            </div>
          </>
        )}

        {passo === 2 && (
          <>
            <h3 style={{ fontSize: "var(--t-lg)", fontWeight: 700, margin: "0 0 var(--s-2)" }}>Código de Verificação</h3>
            <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: "0 0 var(--s-1)" }}>
              {otpInfo?.mensagem || `Código enviado para seu ${labelTipo.toLowerCase()}.`}
            </p>
            {otpInfo?._devCode && (
              <div style={{ marginBottom: "var(--s-2)", padding: "var(--s-2) var(--s-3)", background: "var(--surface-2)", borderRadius: "var(--r-md)", fontFamily: "monospace", fontSize: "var(--t-sm)", color: "var(--accent)", fontWeight: 700 }}>
                🛠 DEV: {otpInfo._devCode}
              </div>
            )}
            <p style={{ fontSize: "var(--t-xs)", color: "var(--text-dim)", margin: "0 0 var(--s-4)" }}>
              Expira em 10 minutos · {OTP_MAX_ATTEMPTS_DISPLAY} tentativas
            </p>
            {erro && <div className="alert alert--error" style={{ marginBottom: "var(--s-3)" }}>{erro}</div>}
            <input
              ref={inputRef}
              type="text" inputMode="numeric" pattern="\d*" maxLength={6}
              value={codigo}
              onChange={e => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="input"
              style={{ width: "100%", marginBottom: "var(--s-3)", boxSizing: "border-box", fontSize: "var(--t-xl)", letterSpacing: "0.3em", textAlign: "center" }}
            />
            <button
              className={"btn btn--primary btn--full" + (loading ? " btn--loading" : "")}
              disabled={loading || codigo.length !== 6}
              onClick={handleConfirmar}
            >
              {loading ? "" : "Confirmar Código"}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--s-3)" }}>
              <button className="btn btn--ghost" onClick={() => { setPasso(1); setErro(""); setCodigo(""); }}>Voltar</button>
              <button className={"btn btn--ghost" + (loading ? " btn--loading" : "")} disabled={loading} onClick={handleReenviar}>
                {loading ? "" : "Reenviar código"}
              </button>
            </div>
          </>
        )}

        {passo === 3 && (
          <div style={{ textAlign: "center", padding: "var(--s-3) 0" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--s-3)", color: "var(--success)" }}><IcoCheck /></div>
            <h3 style={{ fontSize: "var(--t-lg)", fontWeight: 700, margin: "0 0 var(--s-2)" }}>{labelTipo} atualizado!</h3>
            <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: "0 0 var(--s-4)" }}>
              Sua alteração foi confirmada e registrada com segurança.
            </p>
            <button className="btn btn--primary btn--full" onClick={onSuccess}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}
const OTP_MAX_ATTEMPTS_DISPLAY = 3;

// ── Modal Alterar Senha ────────────────────────────────────────────────────────
function ModalSenha({ onClose, onSuccess }) {
  const [senhaAtual,  setSenhaAtual]  = useState("");
  const [novaSenha,   setNovaSenha]   = useState("");
  const [confirmSenha,setConfirmSenha]= useState("");
  const [loading,     setLoading]     = useState(false);
  const [erro,        setErro]        = useState("");
  const [feito,       setFeito]       = useState(false);

  async function handleSubmit() {
    setErro(""); setLoading(true);
    try {
      await alterarSenha(senhaAtual, novaSenha, confirmSenha);
      setFeito(true);
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  }

  const forte = novaSenha.length >= 8;
  const igual = novaSenha === confirmSenha && confirmSenha.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ width: "100%", maxWidth: 480, background: "var(--bg)", borderRadius: "var(--r-xl) var(--r-xl) 0 0", padding: "var(--s-5)", boxShadow: "0 -8px 32px rgba(0,0,0,.15)" }}>
        {!feito ? (
          <>
            <h3 style={{ fontSize: "var(--t-lg)", fontWeight: 700, margin: "0 0 var(--s-4)" }}>Alterar Senha</h3>
            {erro && <div className="alert alert--error" style={{ marginBottom: "var(--s-3)" }}>{erro}</div>}
            {[
              { label: "Senha atual", value: senhaAtual, set: setSenhaAtual, placeholder: "Sua senha atual" },
              { label: "Nova senha",  value: novaSenha,  set: setNovaSenha,  placeholder: "Mínimo 8 caracteres" },
              { label: "Confirmar nova senha", value: confirmSenha, set: setConfirmSenha, placeholder: "Repita a nova senha" },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} style={{ marginBottom: "var(--s-3)" }}>
                <label style={{ display: "block", fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)", marginBottom: "var(--s-1)" }}>{label}</label>
                <input
                  type="password" value={value} onChange={e => set(e.target.value)}
                  placeholder={placeholder} className="input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>
            ))}
            {novaSenha.length > 0 && !forte && (
              <div style={{ fontSize: "var(--t-xs)", color: "var(--red-600)", marginBottom: "var(--s-2)" }}>
                Senha muito curta (mínimo 8 caracteres)
              </div>
            )}
            {confirmSenha.length > 0 && !igual && (
              <div style={{ fontSize: "var(--t-xs)", color: "var(--red-600)", marginBottom: "var(--s-2)" }}>
                As senhas não conferem
              </div>
            )}
            <div style={{ display: "flex", gap: "var(--s-2)", marginTop: "var(--s-2)" }}>
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onClose} disabled={loading}>Cancelar</button>
              <button
                className={"btn btn--primary" + (loading ? " btn--loading" : "")}
                style={{ flex: 1 }}
                disabled={loading || !forte || !igual || !senhaAtual}
                onClick={handleSubmit}
              >
                {loading ? "" : "Salvar Senha"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "var(--s-3) 0" }}>
            <div style={{ fontSize: 48, marginBottom: "var(--s-3)" }}>🔒</div>
            <h3 style={{ fontSize: "var(--t-lg)", fontWeight: 700, margin: "0 0 var(--s-2)" }}>Senha alterada!</h3>
            <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", margin: "0 0 var(--s-4)" }}>Sua nova senha está ativa.</p>
            <button className="btn btn--primary btn--full" onClick={onSuccess}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MeuCadastroPage() {
  const [dados,     setDados]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [prefSaving,setPrefSaving]= useState(false);
  const [prefOk,    setPrefOk]    = useState(false);

  // Modais
  const [otpTipo,   setOtpTipo]   = useState(null); // "telefone" | "email" | null
  const [modalSenha,setModalSenha]= useState(false);

  async function carregar() {
    setLoading(true);
    try { setDados(await getPerfil()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { carregar(); }, []);

  async function handlePrefChange(campo, valor) {
    const novasPref = { ...(dados?.editavel?.preferencias || {}), [campo]: valor };
    setDados(d => ({ ...d, editavel: { ...d.editavel, preferencias: novasPref } }));
    setPrefSaving(true); setPrefOk(false);
    try {
      await salvarPreferencias(novasPref);
      setPrefOk(true);
      setTimeout(() => setPrefOk(false), 2000);
    } catch (e) {
      // Reverter em caso de erro
      setDados(d => ({ ...d, editavel: { ...d.editavel, preferencias: dados?.editavel?.preferencias } }));
    } finally { setPrefSaving(false); }
  }

  if (loading) {
    return (
      <div className="portal-content">
        <div className="portal-page-header"><div className="portal-page-header__title">Meu Cadastro</div></div>
        <Sk h={70} r={12} mb={16} />
        <Sk h={200} r={12} mb={16} />
        <Sk h={140} r={12} mb={16} />
        <Sk h={100} r={12} />
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="portal-content">
        <div className="portal-page-header"><div className="portal-page-header__title">Meu Cadastro</div></div>
        <div className="portal-info-banner">Não foi possível carregar seus dados. Tente novamente.</div>
      </div>
    );
  }

  const { editavel, oficial, qualidade } = dados;
  const pref = editavel?.preferencias || {};

  return (
    <>
      {/* Modais */}
      {otpTipo && (
        <ModalOtp
          tipo={otpTipo}
          onClose={() => { setOtpTipo(null); otpSvc.limpar(); }}
          onSuccess={() => { setOtpTipo(null); otpSvc.limpar(); carregar(); }}
        />
      )}
      {modalSenha && (
        <ModalSenha
          onClose={() => setModalSenha(false)}
          onSuccess={() => { setModalSenha(false); }}
        />
      )}

      <div className="portal-content">
        <div className="portal-page-header">
          <div className="portal-page-header__title">Meu Cadastro</div>
        </div>

        {/* 1. Qualidade cadastral */}
        <QualidadeBadge qualidade={qualidade} />

        {/* 2. Dados pessoais — somente leitura */}
        <Section titulo="Dados Pessoais" icon={<IcoUser />}>
          <Card>
            <Campo label="Nome completo"    value={oficial?.nome}     />
            <Campo label="CPF"              value={oficial?.cpf}      />
            <Campo label="CNS"              value={oficial?.cns}      />
            <Campo label="Data de nascimento" value={formatarDataNasc(oficial?.dataNasc)} />
            <Campo label="Nome da mãe"      value={oficial?.nomeMae}  />
          </Card>
          <div className="portal-info-banner" style={{ marginTop: "var(--s-2)", fontSize: "var(--t-xs)" }}>
            Dados oficiais — alterações apenas na sua UBS
          </div>
        </Section>

        {/* 3. Contato — editável */}
        <Section titulo="Contato" icon={<IcoPhone />} acao={null}>
          <Card>
            <div style={{ padding: "var(--s-3) 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>Telefone celular</div>
                  <div style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>{editavel?.telefone || <span style={{ color: "var(--text-dim)" }}>Não cadastrado</span>}</div>
                </div>
                <button onClick={() => setOtpTipo("telefone")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "var(--t-sm)", color: "var(--accent)", fontWeight: 600, padding: "var(--s-1) var(--s-2)", minHeight: 40 }}>
                  Editar
                </button>
              </div>
            </div>
            <div style={{ padding: "var(--s-3) 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>E-mail</div>
                  <div style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>{editavel?.email || <span style={{ color: "var(--text-dim)" }}>Não cadastrado</span>}</div>
                </div>
                <button onClick={() => setOtpTipo("email")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "var(--t-sm)", color: "var(--accent)", fontWeight: 600, padding: "var(--s-1) var(--s-2)", minHeight: 40 }}>
                  Editar
                </button>
              </div>
            </div>
          </Card>
        </Section>

        {/* 4. Endereço — somente leitura */}
        {(oficial?.endereco || oficial?.municipio) && (
          <Section titulo="Endereço" icon={<IcoPin />}>
            <Card>
              <Campo label="Logradouro"  value={[oficial.endereco, oficial.numero].filter(Boolean).join(", ")} />
              <Campo label="Bairro"      value={oficial.bairro}    />
              <Campo label="Município"   value={oficial.municipio} />
              <Campo label="CEP"         value={oficial.cep}       />
            </Card>
            <div className="portal-info-banner" style={{ marginTop: "var(--s-2)", fontSize: "var(--t-xs)" }}>
              Para alterar seu endereço, procure sua UBS.
            </div>
          </Section>
        )}

        {/* 5. Dados da APS — somente leitura */}
        {(oficial?.ubsNome || oficial?.equipeNome || oficial?.acsNome) && (
          <Section titulo="Dados da APS" icon={<IcoBuilding />}>
            <Card>
              <Campo label="UBS de referência" value={oficial.ubsNome}    />
              <Campo label="Equipe"             value={oficial.equipeNome} />
              <Campo label="ACS responsável"    value={oficial.acsNome}    />
            </Card>
            <div className="portal-info-banner" style={{ marginTop: "var(--s-2)", fontSize: "var(--t-xs)" }}>
              Dados territoriais gerenciados pela Secretaria Municipal de Saúde.
            </div>
          </Section>
        )}

        {/* 6. Preferências */}
        <Section titulo="Preferências" icon={<IcoBell />}>
          <Card>
            <PrefToggle
              label="Notificações"
              sub="Receber lembretes de consultas e vacinas"
              value={pref.notificacoes !== false}
              onChange={v => handlePrefChange("notificacoes", v)}
              disabled={prefSaving}
            />
            <PrefToggle
              label="WhatsApp"
              sub="Receber mensagens via WhatsApp (quando disponível)"
              value={!!pref.whatsapp}
              onChange={v => handlePrefChange("whatsapp", v)}
              disabled={prefSaving}
            />
            <PrefToggle
              label="E-mail"
              sub="Receber comunicações por e-mail"
              value={!!pref.emailAtivo}
              onChange={v => handlePrefChange("emailAtivo", v)}
              disabled={prefSaving}
            />
            <PrefToggle
              label="SMS"
              sub="Receber SMS (em breve)"
              value={!!pref.sms}
              onChange={v => handlePrefChange("sms", v)}
              disabled={true}
            />
          </Card>
          {prefOk && (
            <div style={{ fontSize: "var(--t-xs)", color: "var(--green-700, #15803d)", textAlign: "right", marginTop: 4 }}>
              ✓ Preferências salvas
            </div>
          )}
        </Section>

        {/* 7. Segurança */}
        <Section titulo="Segurança" icon={<IcoShield />}>
          <div className="portal-dash-card">
            <button
              onClick={() => setModalSenha(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "var(--s-4)", background: "none", border: "none", cursor: "pointer", minHeight: 56 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
                <span style={{ display: "flex", color: "var(--accent)" }}><IcoKey /></span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "var(--t-md)", fontWeight: 600, color: "var(--text)" }}>Alterar senha</div>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>Mantenha sua conta segura</div>
                </div>
              </div>
              <span style={{ display: "flex", color: "var(--text-dim)" }}><IcoChevron /></span>
            </button>
          </div>
        </Section>

        <p style={{ textAlign: "center", fontSize: "var(--t-xs)", color: "var(--text-dim)", padding: "var(--s-3) 0 var(--s-8)" }}>
          Dados protegidos pela LGPD · VITRAS Portal do Cidadão
        </p>
      </div>
    </>
  );
}
