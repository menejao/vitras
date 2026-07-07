import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import { Tabs, Tab } from "../components/ui/Tabs";

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
  return new Date(ts).toLocaleDateString("pt-BR");
}

const STATUS_BADGE = {
  rascunho:            { cls: "chip chip--slate",  label: "Rascunho" },
  enviada:             { cls: "chip chip--amber",  label: "Enviada"  },
  recebimento_parcial: { cls: "chip chip--teal",   label: "Parcial"  },
  recebido:            { cls: "chip chip--green",  label: "Recebido" },
  cancelada:           { cls: "chip chip--red",    label: "Cancelada"},
};

const DOMINIO_OPTIONS = [
  { value: "pharmacy", label: "Farmácia"   },
  { value: "nursing",  label: "Enfermagem" },
  { value: "dental",   label: "Odonto"     },
];

function ItemAutocomplete({ dominio, value, onSelect, token }) {
  const [query, setQuery] = useState(value?.name || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timeoutRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (value?.name) setQuery(value.name);
  }, [value?.name]);

  function search(q) {
    setQuery(q);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        const params = new URLSearchParams({ q, domain: dominio });
        const json = await apiFetch(`/catalog/items?${params}`, token);
        setResults(json.data || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 250);
  }

  function pick(item) {
    setQuery(item.name);
    setOpen(false);
    onSelect(item);
  }

  useEffect(() => {
    function onClickOut(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <Input
        value={query}
        onChange={e => { search(e.target.value); if (!e.target.value) onSelect(null); }}
        placeholder="Buscar por código ou nome..."
      />
      {busy && <div style={{ fontSize: "0.7rem", color: "var(--text-2)", marginTop: 2 }}>Buscando...</div>}
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 9999,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
          maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.12)"
        }}>
          {results.map(item => (
            <div
              key={item.code}
              onClick={() => pick(item)}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: "var(--t-sm)",
                borderBottom: "1px solid var(--border)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2, #f4f4f5)"}
              onMouseLeave={e => e.currentTarget.style.background = ""}
            >
              <span style={{ fontWeight: 600 }}>{item.name}</span>
              <span style={{ color: "var(--text-2)", marginLeft: 8, fontSize: "0.75rem" }}>{item.code} · {item.category} · {item.unit}</span>
            </div>
          ))}
        </div>
      )}
      {open && results.length === 0 && query.length >= 2 && !busy && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 9999,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "8px 12px", fontSize: "var(--t-sm)", color: "var(--text-2)"
        }}>
          Nenhum item encontrado para &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}

const BLANK_ITEM = () => ({ catalogItem: null, unit: "unidade", allowedUnits: ["unidade"], qtdSolicitada: 1, obs: "" });

export default function AlmoxarifadoPage({ user, token }) {
  const canWrite = Boolean(user?.capabilities?.includes("almoxarifado.write"));

  const [tab, setTab] = useState("requisicoes");
  const [requisicoes, setRequisicoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Nova Requisição modal
  const [showModal, setShowModal] = useState(false);
  const [modalDominio, setModalDominio] = useState("pharmacy");
  const [modalItens, setModalItens] = useState([BLANK_ITEM()]);
  const [modalObs, setModalObs] = useState("");
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  // Recebimento
  const [recvReq, setRecvReq] = useState(null);
  const [recvItens, setRecvItens] = useState([]);
  const [recvObs, setRecvObs] = useState("");
  const [recvBusy, setRecvBusy] = useState(false);
  const [recvError, setRecvError] = useState("");

  const loadRequisicoes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const json = await apiFetch("/almoxarifado/requisicoes", token);
      setRequisicoes(json.data || []);
    } catch {
      setError("Não foi possível carregar as requisições. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadRequisicoes(); }, [loadRequisicoes]);

  function openModal() {
    setModalDominio("pharmacy");
    setModalItens([BLANK_ITEM()]);
    setModalObs("");
    setModalError("");
    setShowModal(true);
  }

  function patchModalItem(i, patch) {
    setModalItens(prev => prev.map((it, j) => j === i ? { ...it, ...patch } : it));
  }

  function addModalItem() {
    setModalItens(prev => [...prev, BLANK_ITEM()]);
  }

  function removeModalItem(i) {
    setModalItens(prev => prev.filter((_, j) => j !== i));
  }

  function onSelectCatalogItem(i, catalogItem) {
    if (!catalogItem) {
      patchModalItem(i, { catalogItem: null, unit: "unidade", allowedUnits: ["unidade"] });
      return;
    }
    patchModalItem(i, {
      catalogItem,
      unit: catalogItem.unit,
      allowedUnits: catalogItem.allowedUnits?.length ? catalogItem.allowedUnits : [catalogItem.unit],
    });
  }

  async function submitRascunho() {
    return submitModal(false);
  }

  async function submitEnviar() {
    return submitModal(true);
  }

  async function submitModal(enviar) {
    setModalError("");
    if (modalItens.some(it => !it.catalogItem)) return setModalError("Selecione um item do catálogo para cada linha.");
    if (modalItens.some(it => Number(it.qtdSolicitada) < 1)) return setModalError("Quantidade deve ser pelo menos 1.");
    setModalBusy(true);
    try {
      const itens = modalItens.map(it => ({
        nome: it.catalogItem.name,
        unit: it.unit,
        qtdSolicitada: Number(it.qtdSolicitada) || 1,
        dominio: modalDominio,
        obs: it.obs || undefined,
      }));
      const body = { itens, obs: modalObs || undefined };
      const created = await apiFetch("/almoxarifado/requisicoes", token, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (enviar && created.data?.id) {
        await apiFetch(`/almoxarifado/requisicoes/${created.data.id}/enviar`, token, { method: "POST", body: "{}" });
      }
      setShowModal(false);
      await loadRequisicoes();
    } catch {
      setModalError("Não foi possível criar a requisição. Tente novamente.");
    } finally {
      setModalBusy(false);
    }
  }

  async function enviarRequisicao(id) {
    try {
      await apiFetch(`/almoxarifado/requisicoes/${id}/enviar`, token, { method: "POST", body: "{}" });
      await loadRequisicoes();
    } catch {
      setError("Não foi possível enviar a requisição. Tente novamente.");
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
    } catch {
      setRecvError("Não foi possível registrar o recebimento. Tente novamente.");
    } finally {
      setRecvBusy(false);
    }
  }

  const pendentes = requisicoes.filter(r => r.status === "enviada" || r.status === "recebimento_parcial");
  const historico = requisicoes.filter(r => r.status === "recebido" || r.status === "cancelada");

  const heroActions = canWrite ? (
    <Button size="sm" variant="primary" onClick={openModal}>+ Nova Requisição</Button>
  ) : null;

  return (
    <div className="almoxarifado-page">
      <PageHeader
        eyebrow="ALMOXARIFADO"
        title="Almoxarifado"
        subtitle="Requisições internas e recebimento de materiais"
        actions={heroActions}
      />

      {error && (
        <div className="almox-error">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={loadRequisicoes}>Tentar novamente</Button>
        </div>
      )}

      <div className="almox-tabs-bar">
        <Tabs>
          <Tab active={tab === "requisicoes"} onClick={() => setTab("requisicoes")}>Requisições</Tab>
          <Tab active={tab === "recebimentos"} onClick={() => setTab("recebimentos")}>Recebimentos</Tab>
          <Tab active={tab === "historico"} onClick={() => setTab("historico")}>Histórico</Tab>
        </Tabs>
      </div>

      <div className="almox-body">
        {tab === "requisicoes" && (
          <>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>Carregando...</div>
            ) : requisicoes.filter(r => r.status === "rascunho" || r.status === "enviada" || r.status === "recebimento_parcial").length === 0 ? (
              <div className="empty">
                <div className="empty__icon empty__icon--neutral">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="1"/>
                    <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
                  </svg>
                </div>
                <h3 className="empty__title">Nenhuma requisição em aberto</h3>
                <p className="empty__desc">Crie uma nova requisição para solicitar materiais ao almoxarifado.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {requisicoes
                  .filter(r => r.status === "rascunho" || r.status === "enviada" || r.status === "recebimento_parcial")
                  .map(r => <RequisicaoCard key={r.id} r={r} canWrite={canWrite} onEnviar={enviarRequisicao} onReceive={openReceive} />)}
              </div>
            )}
          </>
        )}

        {tab === "recebimentos" && (
          <>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>Carregando...</div>
            ) : pendentes.length === 0 ? (
              <div className="empty">
                <div className="empty__icon empty__icon--neutral">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 className="empty__title">Nenhum recebimento pendente</h3>
                <p className="empty__desc">Requisições enviadas aguardando conferência aparecerão aqui.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendentes.map(r => <RequisicaoCard key={r.id} r={r} canWrite={canWrite} onEnviar={enviarRequisicao} onReceive={openReceive} showReceive />)}
              </div>
            )}
          </>
        )}

        {tab === "historico" && (
          <>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>Carregando...</div>
            ) : historico.length === 0 ? (
              <div className="empty">
                <div className="empty__icon empty__icon--neutral">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <h3 className="empty__title">Histórico vazio</h3>
                <p className="empty__desc">Requisições recebidas ou canceladas aparecerão aqui.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {historico.map(r => <RequisicaoCard key={r.id} r={r} canWrite={false} onEnviar={() => {}} onReceive={() => {}} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Nova Requisição */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-box almox-modal--wide"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-title">Nova Requisição ao Almoxarifado</span>
              <Button size="sm" variant="ghost" iconOnly onClick={() => setShowModal(false)}>✕</Button>
            </div>
            <div className="modal-body" style={{ overflowY: "auto", flex: 1 }}>
              {modalError && <div className="error-banner" style={{ marginBottom: 12 }}>{modalError}</div>}

              <div style={{ marginBottom: 16 }}>
                <label className="field-label">Domínio</label>
                <Select value={modalDominio} onChange={e => { setModalDominio(e.target.value); setModalItens([BLANK_ITEM()]); }}>
                  {DOMINIO_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </Select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {modalItens.map((it, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 32px", gap: 8, alignItems: "start" }}>
                    <div>
                      {i === 0 && <label className="field-label">Item *</label>}
                      <ItemAutocomplete
                        dominio={modalDominio}
                        value={it.catalogItem}
                        onSelect={item => onSelectCatalogItem(i, item)}
                        token={token}
                      />
                    </div>
                    <div>
                      {i === 0 && <label className="field-label">Unidade</label>}
                      <Select value={it.unit} onChange={e => patchModalItem(i, { unit: e.target.value })}>
                        {it.allowedUnits.map(u => <option key={u} value={u}>{u}</option>)}
                      </Select>
                    </div>
                    <div>
                      {i === 0 && <label className="field-label">Qtd.</label>}
                      <Input
                        type="number"
                        min={1}
                        value={it.qtdSolicitada}
                        onChange={e => patchModalItem(i, { qtdSolicitada: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: i === 0 ? "flex-end" : "center", paddingBottom: i === 0 ? 2 : 0 }}>
                      {modalItens.length > 1 && (
                        <Button size="sm" variant="ghost" iconOnly onClick={() => removeModalItem(i)}>✕</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button size="sm" variant="ghost" onClick={addModalItem} style={{ marginTop: 8 }}>
                + Adicionar item
              </Button>

              <div style={{ marginTop: 16 }}>
                <label className="field-label">Observações gerais</label>
                <Input value={modalObs} onChange={e => setModalObs(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: "flex-end", gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button variant="ghost" size="sm" onClick={submitRascunho} disabled={modalBusy}>Salvar rascunho</Button>
              <Button variant="primary" size="sm" onClick={submitEnviar} disabled={modalBusy}>
                {modalBusy ? "Enviando..." : "Enviar Requisição"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recebimento */}
      {recvReq && (
        <div className="modal-overlay" onClick={() => setRecvReq(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: "min(600px, 92vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="modal-header">
              <span className="modal-title">Registrar Recebimento</span>
              <Button size="sm" variant="ghost" iconOnly onClick={() => setRecvReq(null)}>✕</Button>
            </div>
            <div className="modal-body" style={{ overflowY: "auto", flex: 1 }}>
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
                        <Input type="number" min={0} max={it.qtdSolicitada} value={it.qtdRecebida}
                          onChange={e => setRecvItens(prev => prev.map((d, j) => j === i ? { ...d, qtdRecebida: e.target.value } : d))}
                          style={{ width: 70 }} />
                      </td>
                      <td>
                        <Input value={it.lote}
                          onChange={e => setRecvItens(prev => prev.map((d, j) => j === i ? { ...d, lote: e.target.value } : d))}
                          placeholder="Opcional" style={{ width: 100 }} />
                      </td>
                      <td>
                        <Input value={it.validade}
                          onChange={e => setRecvItens(prev => prev.map((d, j) => j === i ? { ...d, validade: e.target.value } : d))}
                          placeholder="MM/AAAA" style={{ width: 100 }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <label className="field-label">Observações</label>
                <Input value={recvObs} onChange={e => setRecvObs(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" size="sm" onClick={() => setRecvReq(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={submitRecebimento} disabled={recvBusy}>
                {recvBusy ? "Salvando..." : "Confirmar Recebimento"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequisicaoCard({ r, canWrite, onEnviar, onReceive, showReceive }) {
  const badge = STATUS_BADGE[r.status] || { cls: "chip chip--slate", label: r.status };
  return (
    <div className="card" style={{ padding: "1rem 1.25rem" }}>
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
            <Button size="sm" variant="ghost" onClick={() => onEnviar(r.id)}>Enviar</Button>
          )}
          {canWrite && (showReceive || r.status === "enviada" || r.status === "recebimento_parcial") &&
            (r.status === "enviada" || r.status === "recebimento_parcial") && (
            <Button size="sm" variant="primary" onClick={() => onReceive(r)}>Receber</Button>
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
}
