import { useEffect, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { Tabs, Tab } from "../components/ui/Tabs";
import KPI from "../components/ui/KPI";

const API = () => import.meta.env.VITE_API_URL || "https://api.vitras.com.br";

async function apiFetch(path, token, opts = {}) {
  const r = await fetch(`${API()}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || "Erro");
  return json;
}

function fmtTs(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function DentalPage({ user, token }) {
  const canWrite = Boolean(user?.capabilities?.includes("dental.write"));

  const [tab, setTab] = useState("stock");
  const [stock, setStock] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Adjust modal state
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustError, setAdjustError] = useState("");

  // Multi-item dispense state
  const [dispenseObs, setDispenseObs] = useState("");
  const [dispenseQtys, setDispenseQtys] = useState({});
  const [dispenseBusy, setDispenseBusy] = useState(false);
  const [dispenseError, setDispenseError] = useState("");
  const [dispenseSuccess, setDispenseSuccess] = useState("");

  const [search, setSearch] = useState("");

  async function loadStock() {
    setLoading(true);
    setError("");
    try {
      const json = await apiFetch("/dental/stock", token);
      setStock(json.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    try {
      const json = await apiFetch("/dental/logs", token);
      setLogs(json.data || []);
    } catch {}
  }

  useEffect(() => { loadStock(); }, []);
  useEffect(() => { if (tab === "logs") loadLogs(); }, [tab]);

  const filtered = stock.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return String(s.name || "").toLowerCase().includes(q) || String(s.category || "").toLowerCase().includes(q);
  });

  const lowStock = stock.filter(s => Number(s.qty || 0) <= Number(s.minQty || 0));
  const outStock = stock.filter(s => Number(s.qty || 0) === 0);

  async function submitAdjust() {
    setAdjustError("");
    const delta = parseInt(adjustDelta, 10);
    if (isNaN(delta) || delta === 0) return setAdjustError("Delta inválido.");
    if (!adjustReason.trim()) return setAdjustError("Motivo obrigatório.");
    setAdjustBusy(true);
    try {
      await apiFetch(`/dental/stock/${adjustItem.id}/adjust`, token, {
        method: "POST",
        body: JSON.stringify({ delta, reason: adjustReason }),
      });
      setAdjustItem(null);
      setAdjustDelta("");
      setAdjustReason("");
      await loadStock();
    } catch (e) {
      setAdjustError(e.message);
    } finally {
      setAdjustBusy(false);
    }
  }

  async function submitDispense() {
    setDispenseError("");
    setDispenseSuccess("");
    const items = Object.entries(dispenseQtys)
      .filter(([, q]) => Number(q) > 0)
      .map(([id, qty]) => ({ id, qty: Number(qty) }));
    if (!items.length) return setDispenseError("Selecione ao menos um item.");
    setDispenseBusy(true);
    try {
      await apiFetch("/dental/dispense", token, {
        method: "POST",
        body: JSON.stringify({ items, obs: dispenseObs || undefined }),
      });
      setDispenseQtys({});
      setDispenseObs("");
      setDispenseSuccess("Insumos dispensados com sucesso.");
      await loadStock();
    } catch (e) {
      setDispenseError(e.message);
    } finally {
      setDispenseBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Insumos Odontológicos" subtitle="Controle de estoque e dispensação" />

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <KPI label="Total de itens" value={stock.length} className="card" />
        <KPI label="Estoque baixo" value={lowStock.length} className={`card${lowStock.length > 0 ? " kpi--warning" : ""}`} />
        <KPI label="Sem estoque" value={outStock.length} className={`card${outStock.length > 0 ? " kpi--danger" : ""}`} />
      </div>

      <Tabs>
        <Tab active={tab === "stock"} onClick={() => setTab("stock")}>Estoque</Tab>
        {canWrite && <Tab active={tab === "dispense"} onClick={() => setTab("dispense")}>Dispensar</Tab>}
        <Tab active={tab === "logs"} onClick={() => setTab("logs")}>Movimentações</Tab>
      </Tabs>

      {tab === "stock" && (
        <div className="card card--noPad overflow-hidden" style={{ marginTop: 16 }}>
          <div style={{ padding: "12px 16px" }}>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar item ou categoria..." />
          </div>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>Carregando...</div>
          ) : (
            <table className="patients-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Categoria</th>
                  <th>Qtd</th>
                  <th>Mín</th>
                  <th>Unid.</th>
                  {canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--text-2)" }}>Nenhum item encontrado.</td></tr>
                )}
                {filtered.map(s => (
                  <tr key={s.id} className={Number(s.qty) === 0 ? "row--danger" : Number(s.qty) <= Number(s.minQty) ? "row--warning" : ""}>
                    <td><strong>{s.name}</strong></td>
                    <td className="muted small">{s.category}</td>
                    <td><strong style={{ color: Number(s.qty) === 0 ? "var(--danger)" : Number(s.qty) <= Number(s.minQty) ? "var(--warning)" : undefined }}>{s.qty}</strong></td>
                    <td className="muted small">{s.minQty}</td>
                    <td className="muted small">{s.unit}</td>
                    {canWrite && (
                      <td>
                        <Button size="sm" variant="ghost" onClick={() => { setAdjustItem(s); setAdjustDelta(""); setAdjustReason(""); setAdjustError(""); }}>
                          Ajustar
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "dispense" && canWrite && (
        <div className="card" style={{ marginTop: 16, padding: "1.25rem" }}>
          <h3 style={{ marginBottom: 16, fontSize: "var(--t-base)", fontWeight: 700 }}>Dispensar Insumos Odontológicos</h3>
          {dispenseError && <div className="error-banner" style={{ marginBottom: 12 }}>{dispenseError}</div>}
          {dispenseSuccess && <div style={{ background: "var(--success-bg, #ecfdf5)", color: "var(--success, #059669)", border: "1px solid var(--success, #059669)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{dispenseSuccess}</div>}
          <table className="patients-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Estoque</th>
                <th>Qtd a dispensar</th>
              </tr>
            </thead>
            <tbody>
              {stock.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="muted small">{s.qty} {s.unit}</td>
                  <td>
                    <Input
                      type="number"
                      min={0}
                      max={s.qty}
                      value={dispenseQtys[s.id] || ""}
                      onChange={e => setDispenseQtys(prev => ({ ...prev, [s.id]: e.target.value }))}
                      style={{ width: 80 }}
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Input
            value={dispenseObs}
            onChange={e => setDispenseObs(e.target.value)}
            placeholder="Observações (opcional)"
            style={{ marginTop: 16 }}
          />
          <Button variant="primary" size="sm" onClick={submitDispense} disabled={dispenseBusy} style={{ marginTop: 12 }}>
            {dispenseBusy ? "Dispensando..." : "Confirmar Dispensação"}
          </Button>
        </div>
      )}

      {tab === "logs" && (
        <div className="card card--noPad overflow-hidden" style={{ marginTop: 16 }}>
          <table className="patients-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Tipo</th>
                <th>Item</th>
                <th>Δ</th>
                <th>Usuário</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--text-2)" }}>Nenhuma movimentação registrada.</td></tr>
              )}
              {logs.map(l => (
                <tr key={l.id}>
                  <td className="muted small">{fmtTs(l.at)}</td>
                  <td><span className="chip chip--slate">{l.type}</span></td>
                  <td className="small">{(stock.find(s => s.id === l.itemId) || {}).name || l.itemId}</td>
                  <td style={{ color: l.delta < 0 ? "var(--danger)" : "var(--success)" }}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                  <td className="muted small">{l.actorName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjustItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: 360, maxWidth: "90vw" }}>
            <h3 style={{ marginBottom: 16, fontSize: "var(--t-base)", fontWeight: 700 }}>Ajustar: {adjustItem.name}</h3>
            {adjustError && <div className="error-banner" style={{ marginBottom: 12 }}>{adjustError}</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: "var(--t-sm)", fontWeight: 600, marginBottom: 4 }}>Delta (positivo = entrada, negativo = saída)</label>
              <Input type="number" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)} placeholder="Ex: 50 ou -10" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "var(--t-sm)", fontWeight: 600, marginBottom: 4 }}>Motivo</label>
              <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Recebimento, perda, inventário..." />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" size="sm" onClick={submitAdjust} disabled={adjustBusy}>{adjustBusy ? "Salvando..." : "Confirmar"}</Button>
              <Button variant="ghost" size="sm" onClick={() => setAdjustItem(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
