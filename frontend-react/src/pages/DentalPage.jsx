import { useEffect, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { Tabs, Tab } from "../components/ui/Tabs";
import KPI from "../components/ui/KPI";

const API = () => import.meta.env.VITE_API_URL || "";

async function apiFetch(path, token, opts = {}) {
  const r = await fetch(`${API()}${path}`, {
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

export default function DentalPage({ user, token }) {
  const canWrite = Boolean(user?.capabilities?.includes("dental.write"));
  const [tab, setTab] = useState("estoque");
  const [stock, setStock] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", category: "", unit: "unidade", qty: 0, minQty: 0, notes: "" });
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
      setError("Não foi possível carregar os dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

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
          unit: newForm.unit.trim() || "unidade",
          qty: Number(newForm.qty) || 0,
          minQty: Number(newForm.minQty) || 0,
          notes: newForm.notes || undefined,
        }),
      });
      setShowNew(false);
      setNewForm({ name: "", category: "", unit: "unidade", qty: 0, minQty: 0, notes: "" });
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
    <div>
      <PageHeader
        title="Insumos Odontológicos"
        subtitle="Controle de estoque e movimentações da equipe de saúde bucal"
        actions={heroActions}
      />

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KPI label="Total de itens" value={stock.length} />
        <KPI label="Estoque baixo" value={lowCount} variant={lowCount > 0 ? "warning" : "default"} />
        <KPI label="Sem estoque" value={zeroCount} variant={zeroCount > 0 ? "danger" : "default"} />
      </div>

      <Tabs>
        <Tab active={tab === "estoque"} onClick={() => setTab("estoque")}>Estoque</Tab>
        <Tab active={tab === "movimentacoes"} onClick={() => setTab("movimentacoes")}>Movimentações</Tab>
      </Tabs>

      {tab === "estoque" && (
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>Carregando...</div>
          ) : stock.length === 0 ? (
            <div className="card" style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-2)" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhum insumo cadastrado</div>
              {canWrite && <div style={{ fontSize: "var(--t-sm)" }}>Use o botão &quot;+ Novo Insumo&quot; para começar.</div>}
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
                    {canWrite && <th style={{ width: 210 }}>Operações</th>}
                  </tr>
                </thead>
                <tbody>
                  {stock.map(s => {
                    const statusCls = s.qty === 0 ? "zero" : s.qty <= s.minQty ? "low" : "ok";
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600, fontSize: "var(--t-sm)" }}>{s.name}</td>
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
        </div>
      )}

      {tab === "movimentacoes" && (
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>Carregando...</div>
          ) : logs.length === 0 ? (
            <div className="card" style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-2)" }}>
              Nenhuma movimentação registrada.
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
        </div>
      )}

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: "min(520px, 92vw)" }}>
            <div className="modal-header">
              <span className="modal-title">Novo Insumo</span>
              <Button size="sm" variant="ghost" iconOnly onClick={() => setShowNew(false)}>✕</Button>
            </div>
            <div className="modal-body">
              {newError && <div className="error-banner" style={{ marginBottom: 12 }}>{newError}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="field-label">Nome *</label>
                  <Input value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do insumo" />
                </div>
                <div>
                  <label className="field-label">Categoria *</label>
                  <Input value={newForm.category} onChange={e => setNewForm(p => ({ ...p, category: e.target.value }))} placeholder="Ex: EPI, Anestesia, Restauração..." />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Unidade</label>
                    <Input value={newForm.unit} onChange={e => setNewForm(p => ({ ...p, unit: e.target.value }))} placeholder="unidade" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Qtd. inicial</label>
                    <Input type="number" min={0} value={newForm.qty} onChange={e => setNewForm(p => ({ ...p, qty: e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Mínimo</label>
                    <Input type="number" min={0} value={newForm.minQty} onChange={e => setNewForm(p => ({ ...p, minQty: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="field-label">Observações</label>
                  <Input value={newForm.notes} onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={submitNovoInsumo} disabled={newBusy}>
                {newBusy ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {opItem && (
        <div className="modal-overlay" onClick={() => setOpItem(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: "min(480px, 92vw)" }}>
            <div className="modal-header">
              <span className="modal-title">{opModeLabel} — {opItem.name}</span>
              <Button size="sm" variant="ghost" iconOnly onClick={() => setOpItem(null)}>✕</Button>
            </div>
            <div className="modal-body">
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
                      <Input value={opForm.validade} onChange={e => setOpForm(p => ({ ...p, validade: e.target.value }))} placeholder="MM/AAAA" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="field-label">Observações</label>
                  <Input value={opForm.obs} onChange={e => setOpForm(p => ({ ...p, obs: e.target.value }))} placeholder="Opcional" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
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
