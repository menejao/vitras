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

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Sk({ h = 56, r = 12 }) {
  return <div className="portal-skeleton" style={{ height: h, borderRadius: r, marginBottom: 8 }} />;
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ titulo, icone, children, style }) {
  return (
    <section style={{ marginBottom: "var(--s-5)", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginBottom: "var(--s-3)" }}>
        <span style={{ fontSize: 18 }}>{icone}</span>
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
function InfoRow({ icone, label, value, sub }) {
  if (!value) return null;
  return (
    <div className="portal-ubs-info-row">
      <div className="portal-ubs-info-row__icon" style={{ fontSize: 18 }}>{icone}</div>
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
          <InfoRow icone="📍" label="Endereço" value={endereco || "Endereço não cadastrado"} />
          <InfoRow icone="🕐" label="Funcionamento" value={horario} sub={ubs?.horarioExtra || null} />
          <InfoRow icone="📞" label="Telefone" value={contatos?.telefone || null} />
          {contatos?.whatsapp && (
            <InfoRow icone="💬" label="WhatsApp" value={contatos.whatsapp} />
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
              📞 Ligar
            </a>
          )}
          {/* Como chegar — arquitetura preparada, integração futura com mapas */}
          <button
            className="btn btn--ghost"
            style={{ flex: 1, fontSize: "var(--t-sm)", opacity: contatos?.lat ? 1 : 0.5 }}
            disabled={!contatos?.lat}
            title={contatos?.lat ? "Ver no mapa" : "Localização não disponível"}
          >
            📍 Como chegar
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
        <div style={{ textAlign: "center", padding: "var(--s-3) 0" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
            Equipe de referência não identificada.
          </div>
          <div style={{ fontSize: "var(--t-xs)", color: "var(--text-dim)", marginTop: 4 }}>
            Procure sua UBS para vinculação de equipe.
          </div>
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
              <span style={{ fontSize: 22, width: 32, textAlign: "center", flexShrink: 0 }}>{p.icone}</span>
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
            <span style={{ fontSize: 24 }}>{s.icone}</span>
            <div style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>{s.nome}</div>
            <div style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", lineHeight: 1.4 }}>{s.descricao}</div>
          </div>
        ))}
      </div>
      {/* Farmácia — em breve */}
      {farmaciaBreve && (
        <div className="portal-info-banner" style={{ display: "flex", gap: "var(--s-2)", alignItems: "flex-start" }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>💊</span>
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
    urgente: { bg: "var(--red-50)",      color: "var(--red-600)",     icone: "🚨" },
    alerta:  { bg: "var(--yellow-50, #fefce8)", color: "var(--yellow-700, #a16207)", icone: "⚠️" },
    info:    { bg: "var(--accent-soft)", color: "var(--accent)",      icone: "📢" },
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
              <span style={{ fontSize: 18, flexShrink: 0 }}>{a.icone || s.icone}</span>
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
          <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{c.icone}</span>
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
                📍 {u.bairro}{u.municipio ? ` · ${u.municipio}` : ""}
              </div>
            )}
            {u.telefone && (
              <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginBottom: 4 }}>
                📞 {u.telefone}
              </div>
            )}
            <div style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
              🕐 {u.horario}
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
                📍 {u.distanciaKm.toFixed(1)} km
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
        <InfoRow icone="📞" label="Telefone"     value={contatos.telefone} />
        <InfoRow icone="💬" label="WhatsApp"     value={contatos.whatsapp} />
        <InfoRow icone="📧" label="E-mail"       value={contatos.email} />
        <InfoRow icone="📍" label="Endereço"     value={formatarEndereco(contatos)} />
        <InfoRow icone="🕐" label="Funcionamento" value={formatarHorario(ubs?.horario)} sub={ubs?.horarioExtra} />
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
      <div className="portal-content">
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
      <div className="portal-content">
        <div className="portal-page-header">
          <div className="portal-page-header__title">Minha UBS</div>
        </div>
        <div className="portal-empty">
          <div style={{ fontSize: 48, marginBottom: "var(--s-3)" }}>🏥</div>
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
    <div className="portal-content">
      <div className="portal-page-header">
        <div className="portal-page-header__title">Minha UBS</div>
      </div>

      {/* 1. Cabeçalho */}
      <CabecalhoUbs ubs={ubs} contatos={contatos} />

      {/* 2. Avisos — aparecem primeiro quando existem */}
      {temAvisos && (
        <Section titulo="Avisos da UBS" icone="📢">
          <AvisosUbs avisos={avisos} />
        </Section>
      )}

      {/* 3. Minha Equipe */}
      <Section titulo="Minha Equipe" icone="👥">
        <MinhaEquipe equipe={equipe} profissionais={profissionais} />
      </Section>

      {/* 4. Serviços Disponíveis */}
      <Section titulo="Serviços Disponíveis" icone="🏥">
        <ServicosDisponiveis servicos={servicos} farmaciaBreve={farmaciaBreve} />
      </Section>

      {/* 5. Campanhas Municipais */}
      {temCampanhas && (
        <Section titulo="Campanhas Municipais" icone="📣">
          <CampanhasMunicipais campanhas={campanhas} />
        </Section>
      )}

      {/* 6. Rede Municipal */}
      {temRede && (
        <Section titulo="Outras UBS da Rede" icone="🗺️">
          <RedeMunicipal rede={rede} />
        </Section>
      )}

      {/* 7. Contatos Completos */}
      <Section titulo="Contatos" icone="📇">
        <ContatosCompletos contatos={contatos} ubs={ubs} />
      </Section>

      {/* Rodapé institucional */}
      <div className="portal-info-banner" style={{ marginTop: "var(--s-3)" }}>
        Para alterações no cadastro, vínculo de equipe ou outras solicitações, procure sua UBS pessoalmente ou entre em contato pelo telefone.
      </div>
    </div>
  );
}
