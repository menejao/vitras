/**
 * MinhaUbsPage.jsx — Central de Relacionamento: Minha UBS
 *
 * Seções:
 *   1. Cabeçalho (nome, endereço, horário, botões Ligar / Como chegar)
 *   2. Minha Equipe (equipe + profissionais por cargo)
 *   3. Serviços Disponíveis (respeitam configuração do Console Nacional)
 *   4. Avisos da UBS (mural institucional)
 *   5. Campanhas Municipais
 *   6. Rede Municipal (outras UBS — quando permitido)
 *   7. Farmácia da Rede (estrutura para integração futura)
 *   8. Contatos Completos
 *
 * A UI nunca consulta endpoints diretamente — usa somente unitInformationService.
 */

import { useState, useEffect } from "react";
import {
  loadUnitInformation,
  formatarHorario,
  formatarEndereco,
} from "../services/unitInformationService.js";

// ── Icons ──────────────────────────────────────────────────────────────────────
const IcoPhone    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IcoPin      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IcoClock    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcoMessage  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IcoMail     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const IcoUsers    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcoBuilding = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoBell     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoUser     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoPill     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v2"/><circle cx="17" cy="17" r="5"/><line x1="14" y1="17" x2="20" y2="17"/></svg>;
const IcoAlert    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoMegaphone= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>;
const IcoMap      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;
const IcoContact  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 2H7a5 5 0 0 0-5 5v10a5 5 0 0 0 5 5h10a5 5 0 0 0 5-5V7a5 5 0 0 0-5-5z"/><path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M7 21v-2a5 5 0 0 1 10 0v2"/></svg>;
const IcoEmptyBuilding = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoEmptyUsers    = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Sk({ h = 56, r = 12 }) {
  return <div className="portal-skeleton" style={{ height: h, borderRadius: r, marginBottom: 8 }} />;
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ titulo, icon, children, style }) {
  return (
    <section style={{ marginBottom: "var(--s-5)", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginBottom: "var(--s-3)" }}>
        {icon && (
          <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}>{icon}</span>
        )}
        <h2 style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
          {titulo}
        </h2>
      </div>
      {children}
    </section>
  );
}

// ── Card base ─────────────────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div className="portal-dash-card" style={{ marginBottom: "var(--s-3)", ...style }}>
      <div style={{ padding: "var(--s-4)" }}>
        {children}
      </div>
    </div>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, sub }) {
  if (!value) return null;
  return (
    <div className="portal-ubs-info-row">
      <div className="portal-ubs-info-row__icon">{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="portal-ubs-info-row__label">{label}</div>
        <div className="portal-ubs-info-row__value">{value}</div>
        {sub && <div style={{ fontSize: "var(--t-xs)", color: "var(--text-dim)", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Cabeçalho da UBS ─────────────────────────────────────────────────────────
function CabecalhoUbs({ ubs, contatos }) {
  const endereco = formatarEndereco(contatos);
  const horario  = formatarHorario(ubs?.horario);

  return (
    <div className="portal-dash-card" style={{ marginBottom: "var(--s-5)", overflow: "hidden" }}>
      {/* Banner institucional — placeholder para futura foto */}
      <div style={{
        height: 6, background: "linear-gradient(90deg, var(--accent) 0%, var(--accent-hover, #1d4ed8) 100%)",
      }} />
      <div style={{ padding: "var(--s-5)" }}>
        {/* Nome + CNES */}
        <div style={{ marginBottom: "var(--s-4)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--s-2)" }}>
            <h1 style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
              {ubs?.nome || "Minha UBS"}
            </h1>
            {ubs?.cnes && (
              <span style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}>
                CNES {ubs.cnes}
              </span>
            )}
          </div>
          <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 4 }}>
            Sua unidade de saúde de referência
          </div>
        </div>

        {/* Infos rápidas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <InfoRow icon={<IcoPin />}     label="Endereço"      value={endereco || "Endereço não cadastrado"} />
          <InfoRow icon={<IcoClock />}   label="Funcionamento" value={horario} sub={ubs?.horarioExtra || null} />
          <InfoRow icon={<IcoPhone />}   label="Telefone"      value={contatos?.telefone || null} />
          {contatos?.whatsapp && (
            <InfoRow icon={<IcoMessage />} label="WhatsApp" value={contatos.whatsapp} />
          )}
        </div>

        {/* Botões de ação */}
        <div style={{ display: "flex", gap: "var(--s-2)", marginTop: "var(--s-4)" }}>
          {contatos?.telefone && (
            <a
              href={`tel:${contatos.telefone.replace(/\D/g,"")}`}
              className="btn btn--secondary"
              style={{ flex: 1, textAlign: "center", textDecoration: "none", fontSize: "var(--t-sm)" }}
            >
              Ligar
            </a>
          )}
          {/* Como chegar — arquitetura preparada, integração futura com mapas */}
          <button
            className="btn btn--ghost"
            style={{ flex: 1, fontSize: "var(--t-sm)", opacity: contatos?.lat ? 1 : 0.5 }}
            disabled={!contatos?.lat}
            title={contatos?.lat ? "Ver no mapa" : "Localização não disponível"}
          >
            Como chegar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Minha Equipe ──────────────────────────────────────────────────────────────
function MinhaEquipe({ equipe, profissionais }) {
  if (!equipe && profissionais.length === 0) {
    return (
      <Card>
        <div className="portal-empty" style={{ padding: "var(--s-4) 0" }}>
          <div className="portal-empty__icon"><IcoEmptyUsers /></div>
          <div className="portal-empty__title">Equipe não identificada</div>
          <div className="portal-empty__text">Procure sua UBS para vinculação de equipe.</div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {equipe && (
        <div style={{ marginBottom: profissionais.length > 0 ? "var(--s-3)" : 0 }}>
          <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>
            Equipe
          </div>
          <div style={{ fontSize: "var(--t-md)", fontWeight: 700, color: "var(--text)" }}>
            {equipe.nome}
          </div>
        </div>
      )}
      {profissionais.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
          {profissionais.map((p, i) => (
            <div key={p.id || i} style={{
              display: "flex", alignItems: "center", gap: "var(--s-3)",
              padding: "var(--s-2) 0",
              borderTop: i === 0 && equipe ? "1px solid var(--border)" : "none",
            }}>
              <span style={{ width: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexShrink: 0 }}><IcoUser /></span>
              <div>
                <div style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>{p.nome}</div>
                <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>{p.cargo}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Serviços Disponíveis ──────────────────────────────────────────────────────
function ServicosDisponiveis({ servicos, farmaciaBreve }) {
  if (!servicos || servicos.length === 0) {
    return (
      <Card>
        <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", textAlign: "center", padding: "var(--s-2) 0" }}>
          Serviços não configurados.
        </div>
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-2)", marginBottom: "var(--s-2)" }}>
        {servicos.map(s => (
          <div key={s.id} style={{
            background: "var(--surface)", border: "1.5px solid var(--border)",
            borderRadius: "var(--r-lg)", padding: "var(--s-3)",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <span style={{ color: "var(--accent)", display: "flex" }}><IcoBuilding /></span>
            <div style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>{s.nome}</div>
            <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", lineHeight: 1.4 }}>{s.descricao}</div>
          </div>
        ))}
      </div>
      {/* Farmácia — em breve */}
      {farmaciaBreve && (
        <div className="portal-info-banner" style={{ display: "flex", gap: "var(--s-2)", alignItems: "flex-start" }}>
          <span style={{ flexShrink: 0, color: "var(--accent)", display: "flex" }}><IcoPill /></span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Farmácia disponível</div>
            <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>
              Em breve será possível consultar disponibilidade de medicamentos em toda a rede.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Avisos da UBS ─────────────────────────────────────────────────────────────
function AvisosUbs({ avisos }) {
  if (avisos === null) return null; // módulo com erro — silencioso
  if (avisos.length === 0) return null; // sem avisos — não mostrar seção vazia

  const TIPO_STYLE = {
    urgente: { bg: "var(--red-50)",             color: "var(--red-600)",             icon: <IcoAlert /> },
    alerta:  { bg: "var(--yellow-50, #fefce8)", color: "var(--yellow-700, #a16207)", icon: <IcoAlert /> },
    info:    { bg: "var(--accent-soft)",         color: "var(--accent)",              icon: <IcoBell /> },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      {avisos.map(a => {
        const s = TIPO_STYLE[a.tipo] || TIPO_STYLE.info;
        return (
          <div key={a.id} style={{
            background: s.bg, border: `1px solid ${s.color}30`,
            borderLeft: `4px solid ${s.color}`,
            borderRadius: "var(--r-md)", padding: "var(--s-3) var(--s-4)",
          }}>
            <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, color: s.color, display: "flex" }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: s.color, marginBottom: 2 }}>
                  {a.titulo}
                </div>
                <div style={{ fontSize: "var(--t-sm)", color: "var(--text)" }}>{a.texto}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Campanhas Municipais ──────────────────────────────────────────────────────
function CampanhasMunicipais({ campanhas }) {
  if (!campanhas || campanhas.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      {campanhas.map(c => (
        <div key={c.id} style={{
          background: "var(--surface)", border: "1.5px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: "var(--s-4)",
          display: "flex", alignItems: "flex-start", gap: "var(--s-3)",
          borderLeft: `4px solid ${c.cor || "var(--accent)"}`,
        }}>
          <span style={{ flexShrink: 0, color: c.cor || "var(--accent)", display: "flex" }}><IcoMegaphone /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "var(--t-md)", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{c.titulo}</div>
            <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", lineHeight: 1.5 }}>{c.descricao}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Rede Municipal ────────────────────────────────────────────────────────────
function RedeMunicipal({ rede }) {
  if (!rede?.permitido) return null;
  if (rede.unidades.length === 0) {
    return (
      <Card>
        <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", textAlign: "center" }}>
          Nenhuma outra unidade disponível na rede.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      {rede.unidades.map(u => (
        <div key={u.id} className="portal-dash-card">
          <div style={{ padding: "var(--s-4)" }}>
            <div style={{ fontSize: "var(--t-md)", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{u.nome}</div>
            {u.bairro && (
              <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginBottom: 4 }}>
                {u.bairro}{u.municipio ? ` · ${u.municipio}` : ""}
              </div>
            )}
            {u.telefone && (
              <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginBottom: 4 }}>
                {u.telefone}
              </div>
            )}
            <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
              {u.horario}
            </div>
            {u.servicos?.length > 0 && (
              <div style={{ marginTop: "var(--s-2)", display: "flex", flexWrap: "wrap", gap: 6 }}>
                {u.servicos.map(s => (
                  <span key={s} style={{
                    fontSize: "var(--t-xs)", padding: "2px 8px",
                    background: "var(--surface-2)", borderRadius: 99, color: "var(--text-muted)",
                  }}>{s}</span>
                ))}
              </div>
            )}
            {/* Distância — preparado para futura integração com geolocalização */}
            {u.distanciaKm !== null && (
              <div style={{ marginTop: 8, fontSize: "var(--t-xs)", color: "var(--accent)" }}>
                {u.distanciaKm.toFixed(1)} km
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Contatos Completos ────────────────────────────────────────────────────────
function ContatosCompletos({ contatos, ubs }) {
  if (!contatos) return null;
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <InfoRow icon={<IcoPhone />}   label="Telefone"      value={contatos.telefone} />
        <InfoRow icon={<IcoMessage />} label="WhatsApp"      value={contatos.whatsapp} />
        <InfoRow icon={<IcoMail />}    label="E-mail"        value={contatos.email} />
        <InfoRow icon={<IcoPin />}     label="Endereço"      value={formatarEndereco(contatos)} />
        <InfoRow icon={<IcoClock />}   label="Funcionamento" value={formatarHorario(ubs?.horario)} sub={ubs?.horarioExtra} />
      </div>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MinhaUbsPage() {
  const [info,    setInfo]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUnitInformation()
      .then(setInfo)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="portal-page-header">
          <div className="portal-page-header__title">Minha UBS</div>
        </div>
        <Sk h={180} r={16} />
        <Sk h={120} />
        <Sk h={100} />
        <Sk h={80} />
      </div>
    );
  }

  if (!info?.ubs) {
    return (
      <div>
        <div className="portal-page-header">
          <div className="portal-page-header__title">Minha UBS</div>
        </div>
        <div className="portal-empty">
          <div className="portal-empty__icon"><IcoEmptyBuilding /></div>
          <div className="portal-empty__title">UBS não encontrada</div>
          <div className="portal-empty__text">
            Seu cadastro ainda não está vinculado a uma unidade de saúde.
            Procure a Secretaria Municipal de Saúde para regularização.
          </div>
        </div>
      </div>
    );
  }

  const { ubs, equipe, profissionais, contatos, servicos, farmaciaBreve, avisos, campanhas, rede } = info;
  const temAvisos = avisos && avisos.length > 0;
  const temCampanhas = campanhas && campanhas.length > 0;
  const temRede = rede?.permitido;

  return (
    <div>
      <div className="portal-page-header">
        <div className="portal-page-header__title">Minha UBS</div>
        <div className="portal-page-header__sub">{ubs.nome || "Sua unidade de saúde de referência"}</div>
      </div>

      {/* Cabeçalho UBS — full width always */}
      <CabecalhoUbs ubs={ubs} contatos={contatos} />

      {/* Avisos urgentes — full width */}
      {temAvisos && (
        <Section titulo="Avisos da UBS" icon={<IcoBell />}>
          <AvisosUbs avisos={avisos} />
        </Section>
      )}

      {/* Grid layout — 2-3 colunas no desktop */}
      <div className="portal-ubs-layout">

        {/* Equipe */}
        <div>
          <Section titulo="Minha Equipe" icon={<IcoUsers />}>
            <MinhaEquipe equipe={equipe} profissionais={profissionais} />
          </Section>
        </div>

        {/* Serviços */}
        <div>
          <Section titulo="Serviços Disponíveis" icon={<IcoBuilding />}>
            <ServicosDisponiveis servicos={servicos} farmaciaBreve={farmaciaBreve} />
          </Section>
        </div>

        {/* Contatos */}
        <div>
          <Section titulo="Contatos" icon={<IcoContact />}>
            <ContatosCompletos contatos={contatos} ubs={ubs} />
          </Section>
        </div>

        {/* Campanhas */}
        {temCampanhas && (
          <div>
            <Section titulo="Campanhas Municipais" icon={<IcoMegaphone />}>
              <CampanhasMunicipais campanhas={campanhas} />
            </Section>
          </div>
        )}

        {/* Rede */}
        {temRede && (
          <div>
            <Section titulo="Outras UBS da Rede" icon={<IcoMap />}>
              <RedeMunicipal rede={rede} />
            </Section>
          </div>
        )}

      </div>

      <div className="portal-info-banner" style={{ marginTop: "var(--s-4)" }}>
        Para alterações no cadastro, vínculo de equipe ou outras solicitações, procure sua UBS pessoalmente ou entre em contato pelo telefone.
      </div>
    </div>
  );
}
