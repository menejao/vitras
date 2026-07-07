import { useEffect, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import { Tabs, Tab } from "../components/ui/Tabs";
import KPI from "../components/ui/KPI";
import { API_URL } from "../api.js";

const UNIT_OPTIONS = ["unidade", "caixa", "pacote", "frasco", "ampola", "rolo", "par", "kit", "envelope", "tubo", "seringa"];

async function apiFetch(path, token, opts = {}) {
  const r = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || "Erro ao processar solicitação");
  return json;
}

function fmtTs(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

const OP_TYPE_LABEL = {
  entrada:    "Entrada",
  saida:      "Saída",
  ajuste:     "Ajuste",
  inventario: "Inventário",
  dispense:   "Saída",
  adjustment: "Ajuste",
};

function IconBox() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}

export default function DentalPage({ user, token }) {
  const canWrite = Boolean(user?.capabilities?.includes("dental.write"));
  const [tab, setTab] = useState("estoque");
  const [stock, setStock] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    codigo: "", name: "", category: "", unit: "unidade",
    qty: 0, minQty: 0, localizacao: "", lote: "", validade: "", notes: "",
  });
  const [newBusy, setNewBusy] = useState(false);
  const [newError, setNewError] = useState("");

  const [opItem, setOpItem] = useState(null);
  const [opMode, setOpMode] = useState("entrada");
  const [opForm, setOpForm] = useState({ delta: 1, reason: "", lote: "", validade: "", obs: "" });
  const [opBusy, setOpBusy] = useState(false);
  const [opError, setOpError] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [s, l] = await Promise.all([
        apiFetch("/dental/stock", token),
        apiFetch("/dental/logs", token),
      ]);
      setStock(s.data || []);
      setLogs(l.data || []);
    } catch {
      setError("Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (token) loadAll(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitNovoInsumo() {
    setNewError("");
    if (!newForm.name.trim()) return setNewError("Nome é obrigatório.");
    if (!newForm.category.trim()) return setNewError("Categoria é obrigatória.");
    setNewBusy(true);
    try {
      await apiFetch("/dental/stock", token, {
        method: "POST",
        body: JSON.stringify({
          name: newForm.name.trim(),
          category: newForm.category.trim(),
          unit: newForm.unit || "unidade",
          qty: Number(newForm.qty) || 0,
          minQty: Number(newForm.minQty) || 0,
          notes: [
            newForm.codigo ? `Código: ${newForm.codigo.trim()}` : "",
            newForm.localizacao ? `Local: ${newForm.localizacao.trim()}` : "",
            newForm.lote ? `Lote: ${newForm.lote.trim()}` : "",
            newForm.validade ? `Validade: ${newForm.validade.trim()}` : "",
            newForm.notes.trim(),
          ].filter(Boolean).join(" · ") || undefined,
        }),
      });
      setShowNew(false);
      setNewForm({ codigo: "", name: "", category: "", unit: "unidade", qty: 0, minQty: 0, localizacao: "", lote: "", validade: "", notes: "" });
      await loadAll();
    } catch {
      setNewError("Não foi possível criar o insumo. Tente novamente.");
    } finally {
      setNewBusy(false);
    }
  }

  function openOp(item, mode) {
    setOpItem(item);
    setOpMode(mode);
    setOpForm({ delta: 1, reason: "", lote: "", validade: "", obs: "" });
    setOpError("");
  }

  async function submitOp() {
    setOpError("");
    let delta;
    let opType;
    if (opMode === "entrada") {
      delta = Number(opForm.delta) || 0;
      opType = "entrada";
      if (delta <= 0) return setOpError("Quantidade deve ser maior que zero.");
    } else if (opMode === "saida") {
      delta = -(Number(opForm.delta) || 0);
      opType = "saida";
      if (Number(opForm.delta) <= 0) return setOpError("Quantidade deve ser maior que zero.");
    } else {
      delta = Number(opForm.delta);
      opType = "ajuste";
      if (!Number.isFinite(delta)) return setOpError("Delta inválido.");
    }
    if (!opForm.reason.trim()) return setOpError("Motivo é obrigatório.");
    setOpBusy(true);
    try {
      await apiFetch(`/dental/stock/${opItem.id}/adjust`, token, {
        method: "POST",
        body: JSON.stringify({
          delta,
          reason: opForm.reason.trim(),
          operationType: opType,
          lote: opForm.lote || undefined,
          validade: opForm.validade || undefined,
          obs: opForm.obs || undefined,
        }),
      });
      setOpItem(null);
      await loadAll();
    } catch {
      setOpError("Não foi possível registrar a operação. Tente novamente.");
    } finally {
      setOpBusy(false);
    }
  }

  const lowCount = stock.filter(s => s.qty > 0 && s.qty <= s.minQty).length;
  const zeroCount = stock.filter(s => s.qty === 0).length;
  const opModeLabel = opMode === "entrada" ? "Registrar Entrada" : opMode === "saida" ? "Registrar Saída" : "Ajuste de Estoque";

  const heroActions = canWrite ? (
    <Button size="sm" variant="primary" onClick={() => { setShowNew(true); setNewError(""); }}>+ Novo Insumo</Button>
  ) : null;

  return (
    <div className="dental-page">
      <PageHeader
        eyebrow="INSUMOS ODONTOLÓGICOS"
        title="Insumos Odontológicos"
        subtitle="Controle de estoque e movimentações da equipe de saúde bucal"
        actions={heroActions}
      />

      <div className="dental-kpis">
        <KPI label="Total de itens" value={stock.length} className="card" />
        <KPI label="Estoque baixo" value={lowCount} className={`card${lowCount > 0 ? " kpi--warning" : ""}`} />
        <KPI label="Sem estoque" value={zeroCount} className={`card${zeroCount > 0 ? " kpi--danger" : ""}`} />
      </div>

      <div className="dental-tabs-bar">
        <Tabs>
          <Tab active={tab === "estoque"} onClick={() => setTab("estoque")}>Estoque</Tab>
          <Tab active={tab === "movimentacoes"} onClick={() => setTab("movimentacoes")}>Movimentações</Tab>
        </Tabs>
      </div>

      <div className="dental-body">
        {error && (
          <div className="dental-error">
            <span>{error}</span>
            <Button size="sm" variant="ghost" onClick={loadAll}>Tentar novamente</Button>
          </div>
        )}

        {tab === "estoque" && (
          <>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>Carregando...</div>
            ) : stock.length === 0 && !error ? (
              <div className="empty">
                <div className="empty__icon empty__icon--neutral"><IconBox /></div>
                <h3 className="empty__title">Nenhum insumo cadastrado</h3>
                <p className="empty__desc">Cadastre o primeiro item para começar a controlar o estoque odontológico.</p>
                {canWrite && <Button onClick={() => { setShowNew(true); setNewError(""); }}>+ Novo Insumo</Button>}
              </div>
            ) : (
              <div className="card card--noPad overflow-hidden">
                <table className="patients-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th>Categoria</th>
                      <th>Estoque</th>
                      <th>Mín.</th>
                      {canWrite && <th style={{ width: 220 }}>Operações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map(s => {
                      const statusCls = s.qty === 0 ? "zero" : s.qty <= s.minQty ? "low" : "ok";
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600, fontSize: "var(--t-sm)" }}>
                            {s.name}
                            {s.notes && <div className="muted" style={{ fontSize: "var(--t-xs)", fontWeight: 400, marginTop: 2 }}>{s.notes}</div>}
                          </td>
                          <td className="muted small">{s.category}</td>
                          <td>
                            <span className={`pharma-stock-badge pharma-stock-badge--${statusCls}`}>
                              {s.qty} {s.unit}
                            </span>
                          </td>
                          <td className="muted small">{s.minQty} {s.unit}</td>
                          {canWrite && (
                            <td>
                              <div style={{ display: "flex", gap: 4 }}>
                                <Button size="sm" variant="ghost" onClick={() => openOp(s, "entrada")}>Entrada</Button>
                                <Button size="sm" variant="ghost" onClick={() => openOp(s, "saida")}>Saída</Button>
                                <Button size="sm" variant="ghost" onClick={() => openOp(s, "ajuste")}>Ajuste</Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "movimentacoes" && (
          <>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>Carregando...</div>
            ) : logs.length === 0 ? (
              <div className="empty">
                <div className="empty__icon empty__icon--neutral"><IconBox /></div>
                <h3 className="empty__title">Nenhuma movimentação registrada</h3>
                <p className="empty__desc">As entradas, saídas e ajustes de estoque aparecerão aqui.</p>
              </div>
            ) : (
              <div className="card card--noPad overflow-hidden">
                <table className="patients-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Insumo</th>
                      <th>Movim.</th>
                      <th>Motivo</th>
                      <th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...logs].reverse().map(l => {
                      const itemName = stock.find(s => s.id === l.itemId)?.name || "—";
                      return (
                        <tr key={l.id}>
                          <td className="muted small">{fmtTs(l.at)}</td>
                          <td>
                            <span className="chip chip--slate" style={{ fontSize: "0.7rem" }}>
                              {OP_TYPE_LABEL[l.type] || l.type}
                            </span>
                          </td>
                          <td className="small">{itemName}</td>
                          <td className="small">
                            <span style={{ color: l.delta > 0 ? "var(--teal-600, #0d9488)" : "var(--red-600, #dc2626)", fontWeight: 600 }}>
                              {l.delta > 0 ? "+" : ""}{l.delta}
                            </span>
                            <span className="muted"> → {l.newQty}</span>
                          </td>
                          <td className="muted small">{l.reason || "—"}</td>
                          <td className="muted small">{l.actorName || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {showNew && (
        <div className="modal-backdrop" onClick={() => setShowNew(false)}>
          <div className="modal dental-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal-title">Novo Insumo Odontológico</span>
              <Button size="sm" variant="ghost" iconOnly onClick={() => setShowNew(false)}>✕</Button>
            </div>
            <div className="modal__body" style={{ overflowY: "auto", flex: 1 }}>
              {newError && <div className="error-banner" style={{ marginBottom: 12 }}>{newError}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="field-label">Código</label>
                  <Input value={newForm.codigo} onChange={e => setNewForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex: ODO-0001" />
                </div>
                <div>
                  <label className="field-label">Categoria *</label>
                  <Input value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))} placeholder="Ex: EPI, Anestesia, Restauração..." />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="field-label">Nome *</label>
                  <Input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do insumo" />
                </div>
                <div>
                  <label className="field-label">Unidade</label>
                  <Select value={newForm.unit} onChange={e => setNewForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="field-label">Localização</label>
                  <Input value={newForm.localizacao} onChange={e => setNewForm(f => ({ ...f, localizacao: e.target.value }))} placeholder="Ex: Prateleira A1" />
                </div>
                <div>
                  <label className="field-label">Qtd. inicial</label>
                  <Input type="number" min={0} value={newForm.qty} onChange={e => setNewForm(f => ({ ...f, qty: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Estoque mínimo</label>
                  <Input type="number" min={0} value={newForm.minQty} onChange={e => setNewForm(f => ({ ...f, minQty: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Lote</label>
                  <Input value={newForm.lote} onChange={e => setNewForm(f => ({ ...f, lote: e.target.value }))} placeholder="Opcional" />
                </div>
                <div>
                  <label className="field-label">Validade</label>
                  <Input type="date" value={newForm.validade} onChange={e => setNewForm(f => ({ ...f, validade: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="field-label">Observações</label>
                  <Input value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)} disabled={newBusy}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={submitNovoInsumo} disabled={newBusy}>
                {newBusy ? "Salvando..." : "Salvar Insumo"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {opItem && (
        <div className="modal-backdrop" onClick={() => setOpItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: "min(560px, 90vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="modal__header">
              <span className="modal-title">{opModeLabel} — {opItem.name}</span>
              <Button size="sm" variant="ghost" iconOnly onClick={() => setOpItem(null)}>✕</Button>
            </div>
            <div className="modal__body" style={{ overflowY: "auto", flex: 1 }}>
              {opError && <div className="error-banner" style={{ marginBottom: 12 }}>{opError}</div>}
              <div style={{ color: "var(--text-2)", fontSize: "var(--t-sm)", marginBottom: 12 }}>
                Estoque atual: <strong>{opItem.qty} {opItem.unit}</strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="field-label">
                    {opMode === "ajuste" ? "Delta (+ entrada, - saída)" : "Quantidade"}
                  </label>
                  <Input type="number" value={opForm.delta} onChange={e => setOpForm(p => ({ ...p, delta: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Motivo *</label>
                  <Input value={opForm.reason} onChange={e => setOpForm(p => ({ ...p, reason: e.target.value }))} placeholder="Informe o motivo..." />
                </div>
                {opMode === "entrada" && (
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="field-label">Lote</label>
                      <Input value={opForm.lote} onChange={e => setOpForm(p => ({ ...p, lote: e.target.value }))} placeholder="Opcional" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="field-label">Validade</label>
                      <Input type="date" value={opForm.validade} onChange={e => setOpForm(p => ({ ...p, validade: e.target.value }))} />
                    </div>
                  </div>
                )}
                <div>
                  <label className="field-label">Observações</label>
                  <Input value={opForm.obs} onChange={e => setOpForm(p => ({ ...p, obs: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <Button variant="ghost" size="sm" onClick={() => setOpItem(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={submitOp} disabled={opBusy}>
                {opBusy ? "Salvando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
