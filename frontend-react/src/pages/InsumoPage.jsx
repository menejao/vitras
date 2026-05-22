import { useMemo, useState } from "react";
import { isAdmin, roleLabel } from "../utils/roles";
import { matchesPatientSearch } from "../utils/clinical";
import { fmtDate } from "../utils/formatting";
import PageHeader from "../components/layout/PageHeader";
import PageShell from "../components/layout/PageShell";
import PageToolbar from "../components/layout/PageToolbar";
import KpiGrid from "../components/layout/KpiGrid";
import MainContent from "../components/layout/MainContent";
import Button from "../components/ui/Button";
import { Tabs, Tab } from "../components/ui/Tabs";
import KPI from "../components/ui/KPI";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Textarea from "../components/ui/Textarea";
import Checkbox from "../components/ui/Checkbox";

function sitClass(st, pct) {
  if (st === 0) return "danger";
  if (pct <= 20) return "low";
  if (pct <= 60) return "info";
  return "ok";
}

function sitLabel(st, pct) {
  if (st === 0) return "Sem estoque";
  if (pct <= 20) return "Estoque baixo";
  if (pct <= 60) return "Regular";
  return "Adequado";
}

function stkClass(semEstoque, estq) {
  if (semEstoque) return "empty";
  if (estq <= 5) return "low";
  return "ok";
}

function InsumoPage({
  patients,
  user,
  stock = [],
  log = [],
  continuous = [],
  loading = false,
  error = "",
  canRead = false,
  canWrite = false,
  onAdjustStock,
  onDispense,
  onCloseContinuous,
}) {
  const canDispense = canWrite;
  const canViewAll = canRead || isAdmin(user);

  const [insumoTab, setInsumoTab] = useState(canDispense ? "dispensar" : "estoque");
  const [patSearch, setPatSearch] = useState("");
  const [patSelected, setPatSelected] = useState(null);
  const [isContinuo, setIsContinuo] = useState(false);
  const [catFilter, setCatFilter] = useState("Todas");
  const [itens, setItens] = useState({});
  const [obsDispensa, setObsDispensa] = useState("");
  const [dispErr, setDispErr] = useState("");
  const [dispOk, setDispOk] = useState(false);
  const [dispBusy, setDispBusy] = useState(false);
  const [stockCat, setStockCat] = useState("Todas");
  const [stockSearch, setStockSearch] = useState("");
  const [editStockItem, setEditStockItem] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [stockBusy, setStockBusy] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logFilter, setLogFilter] = useState("all");
  const [closingContinuous, setClosingContinuous] = useState(null);
  const [closingBusy, setClosingBusy] = useState(false);
  const [closingReason, setClosingReason] = useState("");
  const [closingError, setClosingError] = useState("");

  const continuousByPatient = useMemo(
    () => new Map(continuous.filter((entry) => entry.ativo).map((entry) => [entry.patientId, entry])),
    [continuous]
  );

  const categories = useMemo(() => ["Todas", ...new Set(stock.map((item) => item.category).filter(Boolean))], [stock]);
  const patResults = useMemo(() => {
    const query = patSearch.trim();
    if (query.length < 2) return [];
    return patients.filter((patient) => matchesPatientSearch(patient, query)).slice(0, 8);
  }, [patSearch, patients]);

  const filteredStock = useMemo(() => stock.filter((item) => {
    if (stockCat !== "Todas" && item.category !== stockCat) return false;
    if (stockSearch && !String(item.name || "").toLowerCase().includes(stockSearch.toLowerCase())) return false;
    return true;
  }), [stock, stockCat, stockSearch]);

  const filteredLog = useMemo(() => log.filter((entry) => {
    if (logFilter === "continuo" && !entry.continuo) return false;
    if (logFilter === "normal" && entry.continuo) return false;
    if (logSearch) {
      const query = logSearch.toLowerCase();
      const matchesPatient = String(entry.patientName || "").toLowerCase().includes(query);
      const matchesProfessional = String(entry.professionalName || "").toLowerCase().includes(query);
      if (!matchesPatient && !matchesProfessional) return false;
    }
    return true;
  }), [log, logFilter, logSearch]);

  const continuosAtivos = useMemo(() => continuous.filter((entry) => entry.ativo), [continuous]);
  const semEstoqueCount = useMemo(() => stock.filter((item) => Number(item.qty || 0) === 0).length, [stock]);
  const totalSaidasHoje = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return log.filter((entry) => String(entry.date || entry.ts || "").slice(0, 10) === today && entry.type === "dispensa").length;
  }, [log]);

  const tabs = [
    canDispense && ["dispensar", "Nova Dispensacao"],
    ["estoque", "Estoque de Insumos"],
    (canDispense || canViewAll) && ["log", "Historico de Saidas"],
    ["continuos", "Pacientes Continuos"],
  ].filter(Boolean);

  function selectPat(patient) {
    setPatSelected(patient);
    setPatSearch(patient.name);
    setItens({});
    setDispErr("");
    setDispOk(false);
    const continuousEntry = continuousByPatient.get(patient.id);
    if (continuousEntry) {
      setIsContinuo(true);
      setItens(Object.fromEntries((continuousEntry.items || []).map((item) => [item.id, item.qty])));
    } else {
      setIsContinuo(false);
    }
  }

  function setItem(id, val) {
    const catalogItem = stock.find((item) => item.id === id);
    const currentContinuous = continuousByPatient.get(patSelected?.id);
    const override = currentContinuous?.items?.find((item) => item.id === id)?.qty;
    const max = Number(override || catalogItem?.maxQty || 999);
    const normalized = Math.max(0, Math.min(max, Number(val) || 0));
    setItens((prev) => ({ ...prev, [id]: normalized || undefined }));
    setDispErr("");
    setDispOk(false);
  }

  function validarDispensa() {
    const selectedItems = Object.entries(itens)
      .filter(([, value]) => Number(value) > 0)
      .map(([id, qty]) => ({ id, qty: Number(qty) }));
    if (!selectedItems.length) return { ok: false, err: "Selecione ao menos um insumo com quantidade." };

    const currentContinuous = continuousByPatient.get(patSelected?.id);
    for (const selected of selectedItems) {
      const stockItem = stock.find((item) => item.id === selected.id);
      if (!stockItem) return { ok: false, err: "Insumo nao encontrado no estoque atual." };
      if (selected.qty > Number(stockItem.qty || 0)) {
        return { ok: false, err: `"${stockItem.name}" nao possui estoque suficiente.` };
      }
      const override = currentContinuous?.items?.find((item) => item.id === selected.id)?.qty;
      const max = Number(override || stockItem.maxQty || 0);
      if (max > 0 && selected.qty > max) {
        return { ok: false, err: `"${stockItem.name}" excede o limite permitido (${max} ${stockItem.unit}).` };
      }
    }
    return { ok: true, items: selectedItems };
  }

  async function confirmarDispensa() {
    if (!patSelected) {
      setDispErr("Selecione um paciente.");
      return;
    }
    const validation = validarDispensa();
    if (!validation.ok) {
      setDispErr(validation.err);
      return;
    }
    try {
      setDispBusy(true);
      await onDispense({
        patientId: patSelected.id,
        items: validation.items,
        continuo: isContinuo,
        obs: obsDispensa,
      });
      setDispOk(true);
      setDispErr("");
      setItens({});
      setObsDispensa("");
      window.setTimeout(() => {
        setDispOk(false);
        setPatSelected(null);
        setPatSearch("");
        setIsContinuo(false);
      }, 1800);
    } catch (requestError) {
      setDispErr(requestError?.message || "Falha ao registrar dispensacao.");
    } finally {
      setDispBusy(false);
    }
  }

  async function confirmarEntrada() {
    if (!editStockItem) return;
    const qty = Number(editQty || 0);
    if (!qty || qty <= 0) return;
    try {
      setStockBusy(true);
      await onAdjustStock(editStockItem.id, { qty });
      setEditStockItem(null);
      setEditQty("");
    } finally {
      setStockBusy(false);
    }
  }

  async function confirmarEncerramento() {
    if (!closingContinuous) return;
    if (String(closingReason || "").trim().length < 8) {
      setClosingError("Informe justificativa com ao menos 8 caracteres.");
      return;
    }
    try {
      setClosingBusy(true);
      setClosingError("");
      await onCloseContinuous(closingContinuous.id, { reason: String(closingReason || "").trim() });
      setClosingContinuous(null);
      setClosingReason("");
    } finally {
      setClosingBusy(false);
    }
  }

  if (!canRead) {
    return (
      <PageShell className="insumos-page">
        <PageHeader
          eyebrow="Gestao de Insumos"
          title="Dispensacao de Insumos"
          subtitle="Seu perfil nao possui permissao para acessar este modulo."
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="insumos-page">
      <PageHeader
        eyebrow="Gestao de Insumos"
        title="Dispensacao de Insumos"
        subtitle="Controle de saida, estoque e pacientes continuos com persistencia real por equipe."
        actions={
          <div className="insumos-session">
            <div className="insumos-session__name">{user?.name}</div>
            <div className="insumos-session__role">{roleLabel(user?.role)}</div>
          </div>
        }
      />

      <KpiGrid className="insumos-kpis">
        <KPI label="Pacientes continuos ativos" value={continuosAtivos.length} className="card" />
        <KPI label="Dispensacoes hoje" value={totalSaidasHoje} className="card" />
        <KPI label="Total de dispensacoes" value={log.filter((entry) => entry.type === "dispensa").length} className="card" />
        <KPI label="Itens sem estoque" value={semEstoqueCount} className={`card${semEstoqueCount > 0 ? " kpi--warning" : ""}`} />
      </KpiGrid>

      <PageToolbar className="insumos-tabs">
        <Tabs>
          {tabs.map(([id, label]) => (
            <Tab key={id} active={insumoTab === id} onClick={() => setInsumoTab(id)}>{label}</Tab>
          ))}
        </Tabs>
      </PageToolbar>

      <MainContent className="insumos-body">
        {error && <div className="alert alert--danger">{error}</div>}
        {loading && <div className="alert alert--info">Atualizando dados de insumos...</div>}

        {insumoTab === "dispensar" && canDispense && (
          <div className="ins-disp-layout">
            <div className="ins-disp-side">
              <div className="card" style={{ padding: "var(--s-4)" }}>
                <div className="ins-pat-title">Paciente</div>
                <Input value={patSearch} onChange={(event) => setPatSearch(event.target.value)} placeholder="Buscar paciente..." />
                {patResults.length > 0 && (
                  <div className="ins-pat-results">
                    {patResults.map((patient) => {
                      const currentContinuous = continuousByPatient.get(patient.id);
                      return (
                        <Button key={patient.id} variant="ghost" className="ins-pat-opt" onClick={() => selectPat(patient)}>
                          <div className="ins-pat-opt__name">{patient.name}</div>
                          <div className="ins-pat-opt__sub">{patient.cpf || ""}{currentContinuous ? " · Continuo" : ""}</div>
                        </Button>
                      );
                    })}
                  </div>
                )}
                {patSelected && (
                  <div className="ins-pat-card">
                    <div className="ins-pat-card__name">{patSelected.name}</div>
                    <div className="ins-pat-card__meta">
                      {patSelected.birthDate ? `Nasc.: ${fmtDate(patSelected.birthDate)}` : ""}
                      {patSelected.cpf ? ` · CPF: ${patSelected.cpf}` : ""}
                    </div>
                    {continuousByPatient.get(patSelected.id) && <div className="ins-pat-card__cont">Paciente continuo ativo</div>}
                  </div>
                )}
              </div>

              {patSelected && (
                <div className="card" style={{ padding: "var(--s-4)" }}>
                  <Checkbox
                    className="ins-cont-label"
                    checked={isContinuo}
                    onChange={(event) => setIsContinuo(event.target.checked)}
                    label="Paciente continuo"
                    hint="Define limite recorrente de retirada para este paciente. Se ja houver acompanhamento ativo, os limites anteriores seguem valendo."
                  />
                </div>
              )}

              {patSelected && (
                <div className="card" style={{ padding: "var(--s-4)" }}>
                  <div className="ins-obs-title">Observacoes</div>
                  <Textarea
                    value={obsDispensa}
                    onChange={(event) => setObsDispensa(event.target.value)}
                    placeholder="Motivo, diagnostico, orientacoes ao paciente..."
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div className="ins-disp-main">
              <div className="ins-notice">
                <span>As quantidades maximas seguem os limites operacionais do catalogo institucional. O backend valida estoque, paciente e equipe em cada retirada.</span>
              </div>

              <div className="ins-cat-filters">
                {categories.map((category) => (
                  <Button key={category} variant="ghost" className={`ins-cat-btn${catFilter === category ? " is-active" : ""}`} onClick={() => setCatFilter(category)}>
                    {category}
                  </Button>
                ))}
              </div>

              <div className="ins-grid">
                {stock.filter((item) => catFilter === "Todas" || item.category === catFilter).map((item) => {
                  const qty = itens[item.id] || 0;
                  const estq = Number(item.qty || 0);
                  const semEstoque = estq === 0;
                  const currentContinuous = continuousByPatient.get(patSelected?.id);
                  const continuousLimit = currentContinuous?.items?.find((entry) => entry.id === item.id)?.qty;
                  const limite = Number(continuousLimit || item.maxQty || 0);
                  return (
                    <div key={item.id} className={`ins-item${qty > 0 ? " is-selected" : ""}${semEstoque ? " is-empty" : ""}`}>
                      <div className="ins-item__body">
                        <div className="ins-item__name">{item.name}</div>
                        <div className="ins-item__meta">
                          <span className="ins-item__tag">{item.category}</span>
                          <span className="ins-item__tag">Max: {limite} {item.unit}</span>
                          <span className={`ins-item__stk ins-item__stk--${stkClass(semEstoque, estq)}`}>Estoque: {estq} {item.unit}</span>
                        </div>
                        {item.notes && <div className="ins-item__obs">Info: {item.notes}</div>}
                      </div>
                      <div className="ins-qty-ctrl">
                        <Button variant="ghost" className="ins-qty-btn" onClick={() => setItem(item.id, qty - 1)} disabled={!patSelected || qty <= 0}>-</Button>
                        <Input
                          type="number"
                          min={0}
                          max={limite}
                          value={qty || ""}
                          onChange={(event) => setItem(item.id, event.target.value)}
                          disabled={!patSelected || semEstoque}
                          placeholder="0"
                          inputClassName={`ins-qty-input${qty > 0 ? " is-selected" : ""}`}
                        />
                        <Button variant="ghost" className="ins-qty-btn" onClick={() => setItem(item.id, qty + 1)} disabled={!patSelected || qty >= limite || semEstoque}>+</Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {Object.values(itens).some((value) => value > 0) && (
                <div className="ins-summary">
                  <div className="ins-summary__title">Resumo da dispensacao</div>
                  {Object.entries(itens).filter(([, value]) => value > 0).map(([id, qty]) => {
                    const item = stock.find((entry) => entry.id === id);
                    return (
                      <div key={id} className="ins-summary__row">
                        <span>{item?.name}</span>
                        <span>{qty} {item?.unit}</span>
                      </div>
                    );
                  })}
                  {dispErr && <div className="alert alert--danger" style={{ marginTop: "var(--s-2)" }}>{dispErr}</div>}
                  {dispOk && <div className="alert alert--success" style={{ marginTop: "var(--s-2)" }}>Dispensacao registrada com sucesso.</div>}
                  <Button variant="primary" onClick={confirmarDispensa} disabled={!patSelected || dispOk || dispBusy} style={{ marginTop: "var(--s-3)", width: "100%" }}>
                    {dispBusy ? "Salvando..." : `Confirmar dispensacao${isContinuo ? " (continuo)" : ""}`}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {insumoTab === "estoque" && (
          <div>
            <PageToolbar className="ins-toolbar">
              <div style={{ flex: "1 1 200px", maxWidth: 320 }}>
                <Input value={stockSearch} onChange={(event) => setStockSearch(event.target.value)} placeholder="Buscar insumo..." />
              </div>
              <div style={{ flex: "0 0 auto" }}>
                <Select value={stockCat} onChange={(event) => setStockCat(event.target.value)}>
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </Select>
              </div>
            </PageToolbar>

            <div style={{ overflowX: "auto" }}>
              <table className="ins-table">
                <thead>
                  <tr>
                    {["Insumo", "Categoria", "Unidade", "Qtd Max", "Estoque atual", "Situacao", ""].map((header) => (
                      <th key={header} className="ins-table__th">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((item) => {
                    const st = Number(item.qty || 0);
                    const pct = Number(item.maxQty || 0) > 0 ? Math.round((st / Number(item.maxQty || 1)) * 100) : 0;
                    const sc = sitClass(st, pct);
                    return (
                      <tr key={item.id}>
                        <td className="ins-table__td ins-table__td--name">
                          {item.name}
                          {item.notes && <div className="ins-table__td--obs">{item.notes}</div>}
                        </td>
                        <td className="ins-table__td">{item.category}</td>
                        <td className="ins-table__td">{item.unit}</td>
                        <td className="ins-table__td ins-table__td--mono">{item.maxQty}</td>
                        <td className="ins-table__td">
                          <div className="ins-stk-qty">
                            <span className={`ins-stk-num ins-stk-num--${sc}`}>{st}</span>
                            <div className="ins-stk-bar">
                              <div className={`ins-stk-bar__fill ins-stk-bar__fill--${sc}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="ins-table__td">
                          <span className={`ins-sit ins-sit--${sc}`}>{sitLabel(st, pct)}</span>
                        </td>
                        <td className="ins-table__td">
                          {canWrite && (
                            <Button variant="ghost" size="sm" onClick={() => { setEditStockItem(item); setEditQty(""); }}>
                              + Entrada
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {insumoTab === "log" && (canDispense || canViewAll) && (
          <div>
            <PageToolbar className="ins-toolbar">
              <div style={{ flex: "1 1 220px", maxWidth: 360 }}>
                <Input
                  value={logSearch}
                  onChange={(event) => setLogSearch(event.target.value)}
                  placeholder="Buscar por paciente ou profissional..."
                />
              </div>
              <div className="ins-log-filters">
                {[["all", "Todas"], ["continuo", "Continuo"], ["normal", "Normal"]].map(([value, label]) => (
                  <Button key={value} variant="ghost" className={`ins-cat-btn${logFilter === value ? " is-active" : ""}`} onClick={() => setLogFilter(value)}>
                    {label}
                  </Button>
                ))}
              </div>
            </PageToolbar>
            {!filteredLog.length ? (
              <div className="empty-state">Nenhuma dispensacao registrada.</div>
            ) : (
              <div className="ins-log-list">
                {filteredLog.map((entry) => (
                  <div key={entry.id} className={`ins-log-entry${entry.continuo ? " ins-log-entry--continuo" : ""}`}>
                    <div className="ins-log-entry__head">
                      <div>
                        <div className="ins-log-entry__name">
                          {entry.patientName || entry.itemName || "Movimento de estoque"}
                          {entry.continuo && <span className="ins-cont-tag">Continuo</span>}
                        </div>
                        <div className="ins-log-entry__sub">
                          {entry.professionalName || user?.name} ({roleLabel(entry.professionalRole)}) · {new Date(entry.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <span className="ins-log-entry__date">{entry.date || String(entry.ts).slice(0, 10)}</span>
                    </div>
                    <div className="ins-log-entry__items">
                      {Array.isArray(entry.items) && entry.items.length > 0 ? entry.items.map((item) => {
                        const stockItem = stock.find((stockEntry) => stockEntry.id === item.id);
                        return <span key={item.id} className="ins-log-entry__pill">{stockItem?.name || item.id}: {item.qty} {stockItem?.unit || ""}</span>;
                      }) : (
                        <span className="ins-log-entry__pill">{entry.itemName}: {entry.qty}</span>
                      )}
                    </div>
                    {entry.obs && <div className="ins-log-entry__obs">Obs: {entry.obs}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {insumoTab === "continuos" && (
          <div>
            <div className="ins-notice" style={{ marginBottom: "var(--s-4)" }}>
              <span>Pacientes continuos retornam com limite recorrente de retirada. O backend guarda historico, encerramento e vinculo por equipe.</span>
            </div>

            {!continuosAtivos.length ? (
              <div className="empty-state">
                <div className="empty-state__title">Nenhum paciente continuo ativo</div>
                <div className="empty-state__body">Ao dispensar insumos, marque "Paciente continuo" para registra-lo aqui.</div>
              </div>
            ) : (
              <div className="ins-cont-list">
                {continuosAtivos.map((entry) => {
                  const retiradas = log.filter((item) => item.patientId === entry.patientId && item.continuo).length;
                  const ultima = log.filter((item) => item.patientId === entry.patientId).sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")))[0];
                  return (
                    <div key={entry.id} className="ins-cont-card">
                      <div className="ins-cont-card__head">
                        <div>
                          <div className="ins-cont-card__name">
                            {entry.patientName}
                            <span className="ins-cont-tag">Ativo</span>
                          </div>
                          <div className="ins-cont-card__meta">
                            Desde {fmtDate(entry.dtInicio)} · {retiradas} retirada(s) registrada(s) · Por: {entry.profissional}
                          </div>
                          {ultima && <div className="ins-cont-card__meta">Ultima retirada: {fmtDate(ultima.date || String(ultima.ts).slice(0, 10))}</div>}
                        </div>
                        {canDispense && (
                          <Button
                            variant="ghost"
                            className="ins-btn-encerrar"
                            onClick={() => {
                              setClosingContinuous(entry);
                              setClosingReason("");
                              setClosingError("");
                            }}
                          >
                            Encerrar
                          </Button>
                        )}
                      </div>
                      <div className="ins-cont-card__items-label">Insumos desta prescricao (limites)</div>
                      <div className="ins-cont-card__pills">
                        {(entry.items || []).map((item) => {
                          const stockItem = stock.find((stockEntry) => stockEntry.id === item.id);
                          return (
                            <span key={item.id} className="ins-cont-card__pill">
                              {stockItem?.name || item.id}: ate {item.qty} {stockItem?.unit || ""}
                            </span>
                          );
                        })}
                      </div>
                      {entry.obs && <div className="ins-cont-card__obs">Obs.: {entry.obs}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {continuous.filter((entry) => !entry.ativo).length > 0 && (
              <div className="ins-cont-done-list">
                <div className="ins-cont-done-title">Encerrados</div>
                {continuous.filter((entry) => !entry.ativo).map((entry) => (
                  <div key={entry.id} className="ins-cont-done">
                    <div className="ins-cont-done__name">{entry.patientName}</div>
                    <div className="ins-cont-done__meta">
                      {fmtDate(entry.dtInicio)} → {fmtDate(entry.dtFim)} · {log.filter((item) => item.patientId === entry.patientId && item.continuo).length} retirada(s)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </MainContent>

      {editStockItem && (
        <Modal
          title={`+ Entrada: ${editStockItem.name}`}
          onClose={() => setEditStockItem(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setEditStockItem(null)}>Cancelar</Button>
              <Button variant="primary" onClick={confirmarEntrada} disabled={stockBusy}>{stockBusy ? "Salvando..." : "Confirmar entrada"}</Button>
            </>
          }
        >
          <div className="field-grid">
            <div className="field-grid__full">
              <p className="ins-modal-info">Insumo: <strong>{editStockItem.name}</strong></p>
              <p className="ins-modal-info">Estoque atual: <strong>{editStockItem.qty} {editStockItem.unit}</strong></p>
            </div>
            <Input
              className="field-grid__full"
              label="Quantidade a adicionar *"
              type="number"
              min="1"
              value={editQty}
              onChange={(event) => setEditQty(event.target.value)}
              placeholder="Ex: 50"
              autoFocus
            />
          </div>
        </Modal>
      )}

      {closingContinuous && (
        <Modal
          title="Encerrar acompanhamento continuo"
          onClose={() => setClosingContinuous(null)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setClosingContinuous(null)}>Cancelar</Button>
              <Button variant="danger" onClick={confirmarEncerramento} disabled={closingBusy}>{closingBusy ? "Encerrando..." : "Encerrar"}</Button>
            </>
          }
        >
          <p className="ins-modal-info">
            O paciente <strong>{closingContinuous.patientName}</strong> deixara de aparecer como continuo para novas retiradas.
          </p>
          <label className="label" style={{ display: "grid", gap: "var(--s-2)" }}>
            Justificativa *
            <Textarea
              rows={3}
              value={closingReason}
              onChange={(event) => setClosingReason(event.target.value)}
              placeholder="Motivo clínico ou operacional para encerrar acompanhamento..."
            />
          </label>
          {closingError ? <div className="alert alert--danger" style={{ marginTop: "var(--s-2)" }}>{closingError}</div> : null}
        </Modal>
      )}
    </PageShell>
  );
}

export default InsumoPage;

