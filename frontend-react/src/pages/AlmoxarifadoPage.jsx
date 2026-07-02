import { useEffect, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import { Tabs, Tab } from "../components/ui/Tabs";

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
  return new Date(ts).toLocaleDateString("pt-BR");
}

const STATUS_BADGE = {
  rascunho:             { cls: "chip chip--slate",   label: "Rascunho"     },
  enviada:              { cls: "chip chip--amber",   label: "Enviada"      },
  recebimento_parcial:  { cls: "chip chip--teal",    label: "Parcial"      },
  recebido:             { cls: "chip chip--green",   label: "Recebido"     },
  cancelada:            { cls: "chip chip--red",     label: "Cancelada"    },
};

const DOMINIO_OPTIONS = [
  { value: "pharmacy", label: "Farmácia"   },
  { value: "nursing",  label: "Enfermagem" },
  { value: "dental",   label: "Odonto"     },
];

export default function AlmoxarifadoPage({ user, token }) {
  const canWrite = Boolean(user?.capabilities?.includes("almoxarifado.write"));

  const [tab, setTab] = useState("requisicoes");
  const [requisicoes, setRequisicoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New requisição form
  const [newItens, setNewItens] = useState([{ nome: "", unit: "unidade", qtdSolicitada: 1, dominio: "pharmacy", obs: "" }]);
  const [newObs, setNewObs] = useState("");
  const [newBusy, setNewBusy] = useState(false);
  const [newError, setNewError] = useState("");
  const [newSuccess, setNewSuccess] = useState("");

  // Receiving modal
  const [recvReq, setRecvReq] = useState(null);
  const [recvItens, setRecvItens] = useState([]);
  const [recvObs, setRecvObs] = useState("");
  const [recvBusy, setRecvBusy] = useState(false);
  const [recvError, setRecvError] = useState("");

  async function loadRequisicoes() {
    setLoading(true);
    setError("");
    try {
      const json = await apiFetch("/almoxarifado/requisicoes", token);
      setRequisicoes(json.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRequisicoes(); }, []);

  function addItem() {
    setNewItens(prev => [...prev, { nome: "", unit: "unidade", qtdSolicitada: 1, dominio: "pharmacy", obs: "" }]);
  }

  function removeItem(i) {
    setNewItens(prev => prev.filter((_, j) => j !== i));
  }

  function patchItem(i, field, value) {
    setNewItens(prev => prev.map((it, j) => j === i ? { ...it, [field]: value } : it));
  }

  async function submitNovaRequisicao() {
    setNewError("");
    setNewSuccess("");
    if (newItens.some(it => !it.nome.trim())) return setNewError("Todos os itens precisam ter nome.");
    setNewBusy(true);
    try {
      const itens = newItens.map(it => ({
        nome: it.nome.trim(),
        unit: it.unit.trim() || "unidade",
        qtdSolicitada: Number(it.qtdSolicitada) || 1,
        dominio: it.dominio,
        obs: it.obs || undefined,
      }));
      await apiFetch("/almoxarifado/requisicoes", token, {
        method: "POST",
        body: JSON.stringify({ itens, obs: newObs || undefined }),
      });
      setNewItens([{ nome: "", unit: "unidade", qtdSolicitada: 1, dominio: "pharmacy", obs: "" }]);
      setNewObs("");
      setNewSuccess("Requisição criada com sucesso.");
      await loadRequisicoes();
      setTab("requisicoes");
    } catch (e) {
      setNewError(e.message);
    } finally {
      setNewBusy(false);
    }
  }

  async function enviarRequisicao(id) {
    try {
      await apiFetch(`/almoxarifado/requisicoes/${id}/enviar`, token, { method: "POST", body: "{}" });
      await loadRequisicoes();
    } catch (e) {
      setError(e.message);
    }
  }

  function openReceive(req) {
    setRecvReq(req);
    setRecvItens(req.itens.map((it, idx) => ({
      itemIdx: idx,
      nome: it.nome,
      qtdSolicitada: it.qtdSolicitada,
      qtdRecebida: it.qtdSolicitada,
      lote: "",
      validade: "",
    })));
    setRecvObs("");
    setRecvError("");
  }

  async function submitRecebimento() {
    setRecvError("");
    setRecvBusy(true);
    try {
      await apiFetch(`/almoxarifado/requisicoes/${recvReq.id}/receber`, token, {
        method: "POST",
        body: JSON.stringify({
          itens: recvItens.map(it => ({
            itemIdx: it.itemIdx,
            qtdRecebida: Number(it.qtdRecebida) || 0,
            lote: it.lote || undefined,
            validade: it.validade || undefined,
          })),
          obs: recvObs || undefined,
        }),
      });
      setRecvReq(null);
      await loadRequisicoes();
    } catch (e) {
      setRecvError(e.message);
    } finally {
      setRecvBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Almoxarifado" subtitle="Requisições internas e recebimento de materiais" />

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

      <Tabs>
        <Tab active={tab === "requisicoes"} onClick={() => setTab("requisicoes")}>Requisições</Tab>
        {canWrite && <Tab active={tab === "nova"} onClick={() => setTab("nova")}>Nova Requisição</Tab>}
      </Tabs>

      {tab === "requisicoes" && (
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>Carregando...</div>
          ) : requisicoes.length === 0 ? (
            <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>
              Nenhuma requisição registrada.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {requisicoes.map(r => {
                const badge = STATUS_BADGE[r.status] || { cls: "chip chip--slate", label: r.status };
                return (
                  <div key={r.id} className="card" style={{ padding: "1rem 1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <span className={badge.cls}>{badge.label}</span>
                        <span style={{ marginLeft: 10, fontWeight: 600, fontSize: "var(--t-sm)" }}>
                          {r.itens.length} ite{r.itens.length !== 1 ? "ns" : "m"}
                        </span>
                        <span style={{ marginLeft: 8, color: "var(--text-2)", fontSize: "var(--t-xs)" }}>
                          {fmtTs(r.criadaEm)} · {r.criadaPorNome}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {canWrite && r.status === "rascunho" && (
                          <Button size="sm" variant="ghost" onClick={() => enviarRequisicao(r.id)}>Enviar</Button>
                        )}
                        {canWrite && (r.status === "enviada" || r.status === "recebimento_parcial") && (
                          <Button size="sm" variant="primary" onClick={() => openReceive(r)}>Receber</Button>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                      {r.itens.map((it, i) => {
                        const itemBadge = it.status === "recebido"
                          ? <span className="chip chip--green">Recebido</span>
                          : it.status === "parcial"
                          ? <span className="chip chip--amber">Parcial</span>
                          : <span className="chip chip--slate">Pendente</span>;
                        return (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--t-sm)" }}>
                            {itemBadge}
                            <span>{it.nome}</span>
                            <span style={{ color: "var(--text-2)" }}>{it.qtdRecebida || 0}/{it.qtdSolicitada} {it.unit}</span>
                            <span className="chip chip--slate" style={{ fontSize: "0.7rem" }}>{it.dominio}</span>
                          </div>
                        );
                      })}
                    </div>
                    {r.obs && <div style={{ marginTop: 8, color: "var(--text-2)", fontSize: "var(--t-xs)" }}>{r.obs}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "nova" && canWrite && (
        <div className="card" style={{ marginTop: 16, padding: "1.25rem" }}>
          <h3 style={{ marginBottom: 16, fontSize: "var(--t-base)", fontWeight: 700 }}>Nova Requisição ao Almoxarifado</h3>
          {newError && <div className="error-banner" style={{ marginBottom: 12 }}>{newError}</div>}
          {newSuccess && <div style={{ background: "var(--success-bg, #ecfdf5)", color: "var(--success, #059669)", border: "1px solid var(--success, #059669)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{newSuccess}</div>}

          <table className="patients-table" style={{ width: "100%", marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Unid.</th>
                <th>Qtd</th>
                <th>Domínio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {newItens.map((it, i) => (
                <tr key={i}>
                  <td><Input value={it.nome} onChange={e => patchItem(i, "nome", e.target.value)} placeholder="Nome do item..." /></td>
                  <td><Input value={it.unit} onChange={e => patchItem(i, "unit", e.target.value)} style={{ width: 90 }} /></td>
                  <td>
                    <Input type="number" min={1} value={it.qtdSolicitada} onChange={e => patchItem(i, "qtdSolicitada", e.target.value)} style={{ width: 70 }} />
                  </td>
                  <td>
                    <Select value={it.dominio} onChange={e => patchItem(i, "dominio", e.target.value)}>
                      {DOMINIO_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </Select>
                  </td>
                  <td>
                    {newItens.length > 1 && (
                      <Button size="sm" variant="ghost" onClick={() => removeItem(i)}>✕</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Button size="sm" variant="ghost" onClick={addItem} style={{ marginBottom: 16 }}>+ Adicionar item</Button>

          <Input value={newObs} onChange={e => setNewObs(e.target.value)} placeholder="Observações gerais (opcional)" style={{ marginBottom: 16 }} />

          <Button variant="primary" size="sm" onClick={submitNovaRequisicao} disabled={newBusy}>
            {newBusy ? "Salvando..." : "Criar Requisição"}
          </Button>
        </div>
      )}

      {recvReq && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, overflowY: "auto" }}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: 500, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Registrar Recebimento</h3>
            {recvError && <div className="error-banner" style={{ marginBottom: 12 }}>{recvError}</div>}
            <table className="patients-table" style={{ width: "100%", marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Solicitado</th>
                  <th>Recebido</th>
                  <th>Lote</th>
                  <th>Validade</th>
                </tr>
              </thead>
              <tbody>
                {recvItens.map((it, i) => (
                  <tr key={i}>
                    <td className="small">{it.nome}</td>
                    <td className="muted small">{it.qtdSolicitada}</td>
                    <td>
                      <Input
                        type="number"
                        min={0}
                        max={it.qtdSolicitada}
                        value={it.qtdRecebida}
                        onChange={e => setRecvItens(prev => prev.map((d, j) => j === i ? { ...d, qtdRecebida: e.target.value } : d))}
                        style={{ width: 70 }}
                      />
                    </td>
                    <td>
                      <Input
                        value={it.lote}
                        onChange={e => setRecvItens(prev => prev.map((d, j) => j === i ? { ...d, lote: e.target.value } : d))}
                        placeholder="Opcional"
                        style={{ width: 100 }}
                      />
                    </td>
                    <td>
                      <Input
                        value={it.validade}
                        onChange={e => setRecvItens(prev => prev.map((d, j) => j === i ? { ...d, validade: e.target.value } : d))}
                        placeholder="MM/AAAA"
                        style={{ width: 100 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Input value={recvObs} onChange={e => setRecvObs(e.target.value)} placeholder="Observações (opcional)" style={{ marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" size="sm" onClick={submitRecebimento} disabled={recvBusy}>{recvBusy ? "Salvando..." : "Confirmar Recebimento"}</Button>
              <Button variant="ghost" size="sm" onClick={() => setRecvReq(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
