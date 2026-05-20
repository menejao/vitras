// artboards-screens.jsx
// Hero section (padronizado) e Dashboard preview (densa, hi-fi)

// ─── Hero Section padronizado ─────────────────────────────────
function HeroArtboard({ variant }) {
  return (
    <ABFrame variant={variant} title="Hero Section · padronizada"
             sub="Mesma estrutura para Home, Pacientes, Agenda, Auditoria — só muda kicker, título, ação.">
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Hero principal — workspace home */}
        <div className="sg-hero" style={{ padding: "28px 32px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sg-kicker">EM PRODUÇÃO · 47 UBS · 312 PROFISSIONAIS</div>
              <h1 style={{ marginTop: 14, fontSize: 30 }}>Boa tarde, <span style={{ color: "var(--accent-text)" }}>Dra. Maria</span>.</h1>
              <p style={{ marginTop: 8, maxWidth: "62ch", fontSize: 14 }}>
                Você tem 8 atendimentos restantes hoje e 3 protocolos críticos esperando triagem. Última sincronização com e-SUS APS há 4 minutos.
              </p>
              <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="sg-btn sg-btn--primary"><Icon name="bolt"/> Iniciar próximo atendimento</button>
                <button className="sg-btn sg-btn--secondary" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", borderColor: "rgba(255,255,255,0.12)" }}>
                  Ver agenda completa
                </button>
              </div>
            </div>

            {/* Quick-stats verticais à direita */}
            <div style={{
              flex: "0 0 auto",
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1,
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: "var(--r-md)",
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden", minWidth: 280,
            }}>
              {[
                ["247",   "Atendimentos hoje"],
                ["18",    "Em espera"],
                ["3",     "Críticos"],
                ["94.2%", "SLA mensal"],
              ].map(([v, k]) => (
                <div key={k} style={{ background: "rgba(7,16,26,0.6)", padding: "12px 14px" }}>
                  <div style={{ font: "600 22px IBM Plex Mono", color: "#fff", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  <div style={{ font: "500 10.5px Inter", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 2 }}>{k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hero compacta — para páginas internas (Pacientes, Auditoria etc) */}
        <div className="sg-hero" style={{ padding: "20px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
            <div>
              <div className="sg-kicker">PACIENTES · UBS VILA NOVA</div>
              <h1 style={{ marginTop: 8, fontSize: 22 }}>4.812 pacientes ativos</h1>
              <p style={{ marginTop: 4, fontSize: 13 }}>247 atendidos nos últimos 7 dias · 18 acompanhamentos vencendo essa semana.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="sg-input" style={{ width: 240, background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)" }}>
                <Icon name="search"/>
                <input placeholder="Buscar paciente, CPF…" style={{ color: "#fff" }}/>
              </div>
              <button className="sg-btn sg-btn--primary"><Icon name="plus"/> Cadastrar</button>
            </div>
          </div>
        </div>

        {/* Spec / anatomy */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-md)", padding: 16,
        }}>
          <div className="sg-eyebrow" style={{ marginBottom: 10 }}>Anatomia padrão</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, fontSize: 12.5, color: "var(--text-muted)" }}>
            <div><strong style={{ color: "var(--text)" }}>Kicker</strong> · IBM Plex Mono 10.5px · accent-text · dot pulsante</div>
            <div><strong style={{ color: "var(--text)" }}>Título</strong> · Inter 700 22–30px · color #fff</div>
            <div><strong style={{ color: "var(--text)" }}>Subtítulo</strong> · Inter 400 13–14px · rgba(255,255,255,0.7) · max 62ch</div>
            <div><strong style={{ color: "var(--text)" }}>Background</strong> · linear-gradient slate-900→navy · radial teal glow</div>
            <div><strong style={{ color: "var(--text)" }}>Padding</strong> · 28–32px (full) · 20–24px (compacto)</div>
            <div><strong style={{ color: "var(--text)" }}>Raio</strong> · var(--r-xl)</div>
          </div>
        </div>
      </div>
    </ABFrame>
  );
}

// ─── Dashboard preview (denso, hi-fi) ─────────────────────────
function DashboardArtboard({ variant }) {
  return (
    <ABFrame variant={variant} title="Dashboard · Visão Geral Municipal"
             sub="Hero leve + tabelas densas. Combina todos os componentes padronizados." pad={0}>
      <div style={{ display: "flex", height: "100%", minHeight: 0, background: "var(--bg)" }}>

        {/* Sidebar */}
        <aside style={{
          width: 220, flex: "0 0 220px",
          background: variant === "a" ? "#070C12" : "rgba(255,255,255,0.02)",
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          backdropFilter: variant === "b" ? "blur(14px)" : "none",
        }}>
          <div style={{ padding: "16px 16px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-subtle)" }}>
            <Monogram size={28} variant={variant}/>
            <Wordmark size={16} variant={variant}/>
          </div>
          <div style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 10, flex: 1, overflow: "auto" }}>
            <div className="sg-input" style={{ height: 30 }}>
              <Icon name="search"/>
              <input placeholder="Buscar"/>
              <span style={{ font: "500 10px IBM Plex Mono", color: "var(--text-dim)", padding: "1px 5px", border: "1px solid var(--border)", borderRadius: 3 }}>⌘K</span>
            </div>

            <div className="sg-nav">
              <div className="sg-nav__label">Operacional</div>
              <SidebarItem icon="bolt"    label="Visão geral" active variant={variant}/>
              <SidebarItem icon="users"   label="Pacientes"   count={247} variant={variant}/>
              <SidebarItem icon="more"    label="Agenda" variant={variant}/>
              <SidebarItem icon="plus"    label="Prontuário" variant={variant}/>
              <SidebarItem icon="alert"   label="Triagem" count={3} tone="danger" variant={variant}/>

              <div className="sg-nav__label" style={{ marginTop: 8 }}>Gestão</div>
              <SidebarItem icon="settings" label="Farmácia" variant={variant}/>
              <SidebarItem icon="download" label="Auditoria" variant={variant}/>
              <SidebarItem icon="users"    label="Equipe" variant={variant}/>
              <SidebarItem icon="more"     label="Relatórios" variant={variant}/>
            </div>
          </div>

          {/* Sidebar footer */}
          <div style={{ padding: 12, borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="sg-avatar">MS</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "500 12.5px Inter", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Dra. Maria Silva</div>
              <div style={{ font: "400 10.5px IBM Plex Mono", color: "var(--text-dim)" }}>CRM 134987</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Topbar / breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ font: "400 12px Inter", color: "var(--text-dim)" }}>Operacional</span>
            <span style={{ color: "var(--text-subtle)" }}>/</span>
            <span style={{ font: "500 12px Inter", color: "var(--text)" }}>Visão geral municipal</span>
            <span style={{ marginLeft: "auto" }}/>
            <span style={{ font: "500 11px IBM Plex Mono", color: "var(--text-dim)" }}>
              SYNC <span style={{ color: "var(--success)" }}>●</span> e-SUS APS · 12:47
            </span>
            <button className="sg-btn sg-btn--ghost sg-btn--icon" aria-label="settings"><Icon name="settings"/></button>
            <button className="sg-btn sg-btn--ghost sg-btn--icon" aria-label="more"><Icon name="more"/></button>
          </div>

          {/* Hero leve */}
          <div className="sg-hero" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 18 }}>
              <div>
                <div className="sg-kicker">SECRETARIA MUNICIPAL · 47 UBS</div>
                <h1 style={{ fontSize: 22, marginTop: 8 }}>Visão geral · Abril 2024</h1>
                <p style={{ marginTop: 4, fontSize: 13 }}>Indicadores operacionais e clínicos consolidados em tempo quase real.</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ display: "inline-flex", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                  {["Hoje", "7d", "30d", "Trim."].map((k, i) => (
                    <button key={k} className="sg-btn sg-btn--ghost" style={{
                      height: 28, borderRadius: 0,
                      background: i === 2 ? "rgba(255,255,255,0.10)" : "transparent",
                      color: i === 2 ? "#fff" : "rgba(255,255,255,0.65)",
                      borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "0",
                    }}>{k}</button>
                  ))}
                </div>
                <button className="sg-btn sg-btn--primary sg-btn--sm">Exportar <Icon name="download"/></button>
              </div>
            </div>
          </div>

          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            <KpiCard label="Atendimentos · 30d"   value="12,847" delta="▲ 12.4%" tone="accent"  variant={variant}/>
            <KpiCard label="Tempo médio espera"   value="18:42"  delta="▼ 2:18"  tone="success" variant={variant}/>
            <KpiCard label="Protocolos críticos"  value="14"     delta="▲ 3"     tone="danger"  variant={variant}/>
            <KpiCard label="Cobertura ESF"        value="94.2%"  delta="▲ 1.1%"  tone="warning" variant={variant}/>
          </div>

          {/* Two-column: chart + queue */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, minHeight: 280 }}>
            {/* Chart card */}
            <div className="sg-card" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ font: "600 13.5px Inter", color: "var(--text)" }}>Atendimentos por dia</div>
                  <div style={{ font: "400 11.5px Inter", color: "var(--text-dim)", marginTop: 2 }}>Últimos 30 dias · todas as unidades</div>
                </div>
                <div className="sg-tabs" style={{ border: 0 }}>
                  {["Consultas", "Triagens", "Vacinas"].map((k, i) => (
                    <button key={k} className="sg-tab" style={{ padding: "6px 10px", fontSize: 12 }} aria-selected={i === 0}>{k}</button>
                  ))}
                </div>
              </div>
              <Areachart variant={variant}/>
              <div style={{ display: "flex", gap: 18, paddingTop: 6, borderTop: "1px solid var(--border-subtle)" }}>
                {[
                  ["Pico", "892", "16/abr"],
                  ["Média", "428", "/dia"],
                  ["Mínimo", "84", "Domingo"],
                ].map(([k, v, sub]) => (
                  <div key={k}>
                    <div className="sg-eyebrow" style={{ fontSize: 10 }}>{k}</div>
                    <div style={{ font: "600 16px IBM Plex Mono", color: "var(--text)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{v}</div>
                    <div style={{ font: "400 10.5px IBM Plex Mono", color: "var(--text-dim)" }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Queue / urgent */}
            <div className="sg-card" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <div style={{ font: "600 13.5px Inter", color: "var(--text)" }}>Fila crítica</div>
                  <div style={{ font: "400 11.5px Inter", color: "var(--text-dim)", marginTop: 2 }}>3 vermelhos · 5 laranjas</div>
                </div>
                <span className="sg-badge sg-badge--danger"><span className="sg-dot sg-dot--pulse"/> 3 críticos</span>
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                {[
                  ["Carlos M. da Silva",  "61",  "DOR TORÁCICA",         "Vermelho", "#EF4444", "00:04"],
                  ["Ana B. Ferreira",     "29",  "GESTANTE · SANGRAMENTO","Vermelho", "#EF4444", "00:08"],
                  ["Roberto T. Junior",   "47",  "AVC SUSPEITO",         "Vermelho", "#EF4444", "00:12"],
                  ["Diego H. Almeida",    "34",  "DISPNEIA INTENSA",     "Laranja",  "#F97316", "00:18"],
                  ["Sofia N. Cruz",       "8",   "FEBRE 39.8°",          "Laranja",  "#F97316", "00:24"],
                ].map(([n, age, qx, prio, c, t], i) => (
                  <div key={i} style={{
                    padding: "11px 18px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center",
                    background: i === 0 ? "rgba(239,68,68,0.06)" : "transparent",
                  }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 3, height: 14, background: c, borderRadius: 2 }}/>
                        <span style={{ font: "500 12.5px Inter", color: "var(--text)" }}>{n}</span>
                        <span style={{ font: "400 11px IBM Plex Mono", color: "var(--text-dim)" }}>· {age}a</span>
                      </div>
                      <div style={{ font: "500 11px IBM Plex Mono", color: c, letterSpacing: "0.06em", marginTop: 3, marginLeft: 11 }}>
                        {qx}
                      </div>
                    </div>
                    <span className="sg-num" style={{ color: "var(--text-muted)" }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Patients table (dense) */}
          <div className="sg-card" style={{ padding: 0 }}>
            <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ font: "600 13.5px Inter", color: "var(--text)" }}>Pacientes em atendimento</div>
                <div style={{ font: "400 11.5px Inter", color: "var(--text-dim)", marginTop: 2 }}>Hoje · 247 ativos</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div className="sg-input" style={{ width: 220, height: 30 }}>
                  <Icon name="search"/>
                  <input placeholder="Filtrar"/>
                </div>
                <button className="sg-btn sg-btn--secondary sg-btn--sm">Filtros</button>
                <button className="sg-btn sg-btn--primary sg-btn--sm"><Icon name="plus"/> Novo</button>
              </div>
            </div>
            <div className="sg-tabs" style={{ padding: "0 18px" }}>
              {[
                ["Todos", 247],
                ["Em consulta", 12],
                ["Aguardando", 18],
                ["Triagem", 8],
                ["Atendidos", 189],
              ].map(([t, n], i) => (
                <button key={t} className="sg-tab" aria-selected={i === 0}>
                  {t} <span style={{ marginLeft: 4, font: "500 10.5px IBM Plex Mono", color: "var(--text-dim)" }}>{n}</span>
                </button>
              ))}
            </div>
            <table className="sg-table sg-table--dense">
              <thead>
                <tr>
                  <th>Paciente</th><th>CNS</th><th>Profissional</th><th>UBS</th><th>Início</th><th>CID</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["MS", "Maria A. Santos",   "898 0010 1234 5678", "Dra. M. Silva",   "Vila Nova",   "08:30", "I10",   "info",    "Em consulta"],
                  ["JP", "João C. Pereira",   "898 0010 9871 0231", "Dr. R. Tavares",  "Centro",      "09:00", "E11.9", "accent",  "Triagem"],
                  ["LO", "Lúcia M. Oliveira", "898 0010 4582 3319", "Dra. F. Cunha",   "Vila Nova",   "09:30", "Z34.1", "warning", "Aguardando"],
                  ["PL", "Pedro R. Lima",     "898 0010 8841 0090", "Dr. R. Tavares",  "Jardim Sul",  "10:00", "J45.9", "success", "Atendido"],
                  ["AC", "Ana C. Costa",      "898 0010 0021 4488", "Dra. M. Silva",   "Vila Nova",   "10:30", "M54.5", "warning", "Aguardando"],
                  ["RP", "Rafael P. Mendes",  "898 0010 7741 2245", "Dr. L. Almeida",  "Boa Vista",   "11:00", "K29.7", "info",    "Em consulta"],
                  ["FS", "Fernanda S. Reis",  "898 0010 4422 9981", "Dra. F. Cunha",   "Vila Nova",   "11:30", "F32.0", "success", "Atendido"],
                ].map(([ini, n, cns, prof, ubs, h, cid, tone, st], i) => (
                  <tr key={i}>
                    <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="sg-avatar sg-avatar--sm">{ini}</div>
                      <span style={{ font: "500 12.5px Inter", color: "var(--text)" }}>{n}</span>
                    </td>
                    <td><span className="sg-num" style={{ color: "var(--text-muted)" }}>{cns}</span></td>
                    <td style={{ color: "var(--text-muted)", font: "400 12.5px Inter" }}>{prof}</td>
                    <td style={{ color: "var(--text-muted)", font: "400 12.5px Inter" }}>UBS {ubs}</td>
                    <td><span className="sg-num">{h}</span></td>
                    <td><span className="sg-badge">{cid}</span></td>
                    <td><span className={`sg-badge sg-badge--${tone}`}><span className="sg-dot"/> {st}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <button className="sg-btn sg-btn--ghost sg-btn--icon" aria-label="more"><Icon name="more"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-muted)" }}>
              <span>Exibindo 1–7 de 247</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="sg-btn sg-btn--ghost sg-btn--sm">‹</button>
                <button className="sg-btn sg-btn--secondary sg-btn--sm">1</button>
                <button className="sg-btn sg-btn--ghost sg-btn--sm">2</button>
                <button className="sg-btn sg-btn--ghost sg-btn--sm">3</button>
                <span style={{ alignSelf: "center", padding: "0 4px", color: "var(--text-dim)" }}>…</span>
                <button className="sg-btn sg-btn--ghost sg-btn--sm">36</button>
                <button className="sg-btn sg-btn--ghost sg-btn--sm">›</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ABFrame>
  );
}

function SidebarItem({ icon, label, count, active, tone, variant }) {
  return (
    <div className="sg-nav__item" style={active ? {
      background: "var(--accent-soft)", color: "var(--accent-text)",
    } : {}}>
      {active && (
        <span style={{
          position: "absolute", left: 0, top: "20%", bottom: "20%",
          width: 2, background: "var(--accent)", borderRadius: 2,
          boxShadow: variant === "b" ? "0 0 12px var(--accent-glow)" : "none",
        }}/>
      )}
      <Icon name={icon}/>
      <span>{label}</span>
      {count != null && (
        <span style={{
          marginLeft: "auto",
          font: "500 10.5px IBM Plex Mono",
          color: tone === "danger" ? "var(--danger)" : "var(--text-dim)",
        }}>{count}</span>
      )}
    </div>
  );
}

function Areachart({ variant }) {
  // 30 dias com pico no meio
  const days = 30;
  const pts = Array.from({ length: days }, (_, i) => {
    const base = 380 + Math.sin(i / 4) * 80 + Math.cos(i / 6) * 60;
    const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.9)) * 30;
    return Math.max(120, Math.round(base + noise + (i > 13 && i < 19 ? 250 : 0)));
  });
  const max = Math.max(...pts), min = 80;
  const w = 760, h = 180, pad = 16;
  const sx = (i) => pad + (i / (days - 1)) * (w - pad * 2);
  const sy = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ");
  const area = `${path} L ${sx(days - 1)} ${h - pad} L ${sx(0)} ${h - pad} Z`;
  const gradId = `area-${variant}`;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h} style={{ display: "block" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={variant === "b" ? "#5EEAD4" : "#2DD4BF"} stopOpacity="0.32"/>
            <stop offset="1" stopColor={variant === "b" ? "#5EEAD4" : "#2DD4BF"} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1={pad} y1={pad + p * (h - pad * 2)} x2={w - pad} y2={pad + p * (h - pad * 2)}
                stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="2 4"/>
        ))}
        <path d={area} fill={`url(#${gradId})`}/>
        <path d={path} fill="none" stroke={variant === "b" ? "#5EEAD4" : "#2DD4BF"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        {/* Peak marker */}
        <circle cx={sx(16)} cy={sy(pts[16])} r="4" fill={variant === "b" ? "#5EEAD4" : "#2DD4BF"}/>
        <circle cx={sx(16)} cy={sy(pts[16])} r="9" fill={variant === "b" ? "#5EEAD4" : "#2DD4BF"} fillOpacity="0.18"/>
      </svg>
      <div style={{ position: "absolute", left: pad, right: pad, bottom: -2, display: "flex", justifyContent: "space-between",
                    font: "400 10px IBM Plex Mono", color: "var(--text-dim)", pointerEvents: "none" }}>
        <span>18 mar</span><span>25 mar</span><span>01 abr</span><span>08 abr</span><span>15 abr</span><span>16 abr</span>
      </div>
    </div>
  );
}

Object.assign(window, { HeroArtboard, DashboardArtboard, SidebarItem, Areachart });
