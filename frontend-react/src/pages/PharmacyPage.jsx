import { useEffect, useMemo, useState } from "react";
import { isPharmacist } from "../utils/roles";
import { fetchPrescriptions } from "../api";
import { printPrescription } from "../utils/printDoc";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import { Tabs, Tab } from "../components/ui/Tabs";
import KPI from "../components/ui/KPI";

const BASE_UNITS = ["comprimido", "capsula", "frasco", "bolsa", "ampola", "sache", "bisnaga"];

function IconSearch() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M8 1l6.5 13H1.5L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function stockStatusClass(item) {
  if (Number(item?.qty || 0) === 0) return "zero";
  if (Number(item?.qty || 0) <= Number(item?.minQty || 0)) return "low";
  return "ok";
}

function fmtTs(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

const LOG_TYPE_CONFIG = {
  dispensa: { label: "Dispensação", cls: "pharma-log-badge--dispensa" },
  ajuste:   { label: "Ajuste",      cls: "pharma-log-badge--ajuste"   },
  cadastro: { label: "Cadastro",    cls: "pharma-log-badge--cadastro" },
  edicao:   { label: "Edição",      cls: "pharma-log-badge--edicao"   },
};

function logTypeBadge(type) {
  const cfg = LOG_TYPE_CONFIG[type];
  return (
    <span className={`pharma-log-badge ${cfg ? cfg.cls : "pharma-log-badge--default"}`}>
      {cfg ? cfg.label : (type || "—")}
    </span>
  );
}

function buildCategoryOptions(stock = []) {
  const unique = [...new Set(stock.map((item) => String(item.category || "").trim()).filter(Boolean))];
  return ["Todas", ...unique.sort((a, b) => a.localeCompare(b, "pt-BR"))];
}

function buildUnitOptions(stock = []) {
  const unique = [...new Set(stock.map((item) => String(item.unit || "").trim()).filter(Boolean))];
  return [...new Set([...BASE_UNITS, ...unique])];
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportPharmacyCsv(log = []) {
  const rows = [
    ["Data/Hora", "Tipo", "Medicamento", "Qtd", "Paciente", "Prescritor", "Conselho", "Numero Receita", "Data Receita", "Lote", "Farmaceutico", "Observacoes"],
    ...log.map((item) => [
      fmtTs(item.ts),
      item.type,
      item.itemName,
      item.qty ?? item.delta ?? "",
      item.patient || "",
      item.prescriber || "",
      item.prescriberCouncil || "",
      item.numReceita || "",
      item.dtReceita || "",
      item.lote || "",
      item.pharma || "",
      item.notes || item.reason || "",
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `dispensacoes_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function DispenseModal({ item, patients, prescribers, onConfirm, onClose }) {
  const [form, setForm] = useState({
    qty: 1,
    patientId: "",
    prescriberId: "",
    numReceita: "",
    lote: "",
    dtReceita: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function sf(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (Number(form.qty || 0) <= 0) return setErr("Informe uma quantidade valida.");
    if (Number(form.qty || 0) > Number(item?.qty || 0)) return setErr("Quantidade maior que o estoque disponivel.");
    if (!form.patientId) return setErr("Selecione o paciente.");
    if (!form.prescriberId) return setErr("Selecione o prescritor.");
    if (!String(form.numReceita || "").trim()) return setErr("Informe o numero da receita.");
    if (!String(form.dtReceita || "").trim()) return setErr("Informe a data da receita.");
    try {
      setBusy(true);
      setErr("");
      const patient = patients.find((entry) => entry.id === form.patientId);
      const prescriber = prescribers.find((entry) => entry.id === form.prescriberId);
      await onConfirm({
        itemId: item.id,
        qty: Number(form.qty || 0),
        patientId: form.patientId,
        patient: patient?.name || "",
        prescriberId: form.prescriberId,
        prescriber: prescriber?.name || "",
        prescriberCouncil: prescriber?.councilNumber ? `${prescriber.councilType || ""} ${prescriber.councilNumber}/${prescriber.councilUf || ""}`.trim() : "",
        numReceita: String(form.numReceita || "").trim(),
        lote: String(form.lote || "").trim(),
        dtReceita: String(form.dtReceita || "").trim(),
        notes: String(form.notes || "").trim(),
      });
      onClose();
    } catch (error) {
      setErr(error?.message || "Falha ao registrar dispensacao.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Dispensar ${item?.name || "medicamento"}`}
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Salvando..." : "Confirmar dispensacao"}</Button>
        </>
      )}
    >
      <form className="form-grid" onSubmit={submit}>
        <Input label="Quantidade" type="number" min={1} max={Number(item?.qty || 0)} value={form.qty} onChange={(e) => sf("qty", Number(e.target.value || 0))} />
        <Input label="Estoque disponivel" value={String(item?.qty || 0)} readOnly />
        <Select label="Paciente" value={form.patientId} onChange={(e) => sf("patientId", e.target.value)}>
          <option value="">Selecione</option>
          {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}
        </Select>
        <Select label="Prescritor" value={form.prescriberId} onChange={(e) => sf("prescriberId", e.target.value)}>
          <option value="">Selecione</option>
          {prescribers.map((prescriber) => <option key={prescriber.id} value={prescriber.id}>{prescriber.name}</option>)}
        </Select>
        <Input label="Numero da receita" value={form.numReceita} onChange={(e) => sf("numReceita", e.target.value)} />
        <Input label="Data da receita" type="date" value={form.dtReceita} onChange={(e) => sf("dtReceita", e.target.value)} />
        <Input label="Lote" value={form.lote} onChange={(e) => sf("lote", e.target.value)} />
        <Input className="field--span-2" label="Observacoes" value={form.notes} onChange={(e) => sf("notes", e.target.value)} />
        {err ? <p className="error field--span-2">{err}</p> : null}
      </form>
    </Modal>
  );
}

function StockEditModal({ item, mode, categories, units, onConfirm, onClose }) {
  const [form, setForm] = useState({
    name: String(item?.name || ""),
    category: String(item?.category || categories.find((entry) => entry !== "Todas") || ""),
    unit: String(item?.unit || units[0] || "comprimido"),
    qty: Number(item?.qty || 0),
    minQty: Number(item?.minQty || 0),
    location: String(item?.location || ""),
  });
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [entQty, setEntQty] = useState("");
  const [entLote, setEntLote] = useState("");
  const [entValidade, setEntValidade] = useState("");
  const [entObs, setEntObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function sf(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    try {
      setBusy(true);
      setErr("");
      if (mode === "entrada") {
        const qty = Number(entQty);
        if (!Number.isInteger(qty) || qty <= 0) return setErr("Informe uma quantidade inteira positiva.");
        await onConfirm({ mode: "adjust", delta: qty, reason: "Entrada de estoque", lote: entLote.trim(), validade: entValidade.trim(), obs: entObs.trim() });
      } else if (mode === "adjust") {
        if (!Number.isInteger(Number(delta)) || Number(delta) === 0) return setErr("Informe um ajuste inteiro diferente de zero.");
        if (!String(reason || "").trim()) return setErr("Informe o motivo do ajuste.");
        await onConfirm({ mode, delta: Number(delta), reason: String(reason || "").trim() });
      } else {
        if (!String(form.name || "").trim()) return setErr("Informe o nome do medicamento.");
        if (!String(form.category || "").trim()) return setErr("Informe a categoria.");
        if (!String(form.unit || "").trim()) return setErr("Informe a unidade.");
        if (!String(form.location || "").trim()) return setErr("Informe a localizacao.");
        await onConfirm({
          mode,
          form: {
            name: String(form.name || "").trim(),
            category: String(form.category || "").trim(),
            unit: String(form.unit || "").trim(),
            qty: Math.max(0, Number(form.qty || 0)),
            minQty: Math.max(0, Number(form.minQty || 0)),
            location: String(form.location || "").trim(),
          },
        });
      }
      onClose();
    } catch (error) {
      setErr(error?.message || "Falha ao salvar alteracao.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "add" ? "Novo medicamento" : mode === "edit" ? "Editar medicamento" : mode === "entrada" ? "Entrada de estoque" : "Ajustar estoque";

  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </>
      )}
    >
      <form className="form-grid" onSubmit={submit}>
        {mode === "entrada" ? (
          <>
            <Input label="Medicamento" value={String(item?.name || "")} readOnly />
            <Input label="Estoque atual" value={String(item?.qty || 0)} readOnly />
            <Input label="Quantidade" type="number" min={1} value={entQty} onChange={(e) => setEntQty(e.target.value)} required />
            <Input label="Lote" value={entLote} onChange={(e) => setEntLote(e.target.value)} placeholder="Ex: L2025-001" />
            <Input label="Validade" type="date" value={entValidade} onChange={(e) => setEntValidade(e.target.value)} />
            <Input className="field--span-2" label="Observação" value={entObs} onChange={(e) => setEntObs(e.target.value)} placeholder="Fornecedor, nota fiscal, etc." />
          </>
        ) : mode === "adjust" ? (
          <>
            <Input label="Medicamento" value={String(item?.name || "")} readOnly />
            <Input label="Estoque atual" value={String(item?.qty || 0)} readOnly />
            <Input label="Delta" type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value || 0))} />
            <Input className="field--span-2" label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          </>
        ) : (
          <>
            <Input label="Medicamento" value={form.name} onChange={(e) => sf("name", e.target.value)} />
            <Select label="Categoria" value={form.category} onChange={(e) => sf("category", e.target.value)}>
              {[...categories.filter((entry) => entry !== "Todas"), form.category].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </Select>
            <Select label="Unidade" value={form.unit} onChange={(e) => sf("unit", e.target.value)}>
              {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </Select>
            <Input label="Quantidade inicial" type="number" min={0} value={form.qty} onChange={(e) => sf("qty", Number(e.target.value || 0))} />
            <Input label="Estoque minimo" type="number" min={0} value={form.minQty} onChange={(e) => sf("minQty", Number(e.target.value || 0))} />
            <Input className="field--span-2" label="Localizacao" value={form.location} onChange={(e) => sf("location", e.target.value)} placeholder="Ex: Prateleira A1" />
          </>
        )}
        {err ? <p className="error field--span-2">{err}</p> : null}
      </form>
    </Modal>
  );
}

function PharmacyPage({
  user,
  token,
  patients = [],
  users = [],
  stock = [],
  log = [],
  loading = false,
  error = "",
  canRead = false,
  canWrite = false,
  onCreateStockItem,
  onUpdateStockItem,
  onAdjustStockItem,
  onDispense,
}) {
  const [pharmaTab, setPharmaTab] = useState("stock");
  const [prescriptions, setPrescriptions] = useState([]);
  const [rxSearch, setRxSearch] = useState("");
  const [rxLoading, setRxLoading] = useState(false);

  useEffect(() => {
    if (pharmaTab !== "prescriptions" || !token) return;
    setRxLoading(true);
    fetchPrescriptions(token)
      .then(r => setPrescriptions(r?.prescriptions || []))
      .catch(() => {})
      .finally(() => setRxLoading(false));
  }, [pharmaTab, token]);
  const [catFilter, setCatFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [dispenseItem, setDispenseItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [stockPage, setStockPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const PHARMA_PAGE_SIZE = 20;

  const categories = useMemo(() => buildCategoryOptions(stock), [stock]);
  const units = useMemo(() => buildUnitOptions(stock), [stock]);
  const lowStock = useMemo(() => stock.filter((item) => Number(item.qty || 0) <= Number(item.minQty || 0)), [stock]);
  const outStock = useMemo(() => stock.filter((item) => Number(item.qty || 0) === 0), [stock]);
  const dispensasHoje = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return log.filter((item) => item.type === "dispensa" && String(item.ts || "").slice(0, 10) === today).length;
  }, [log]);

  const filtered = useMemo(() => (
    stock
      .filter((item) => {
        if (catFilter !== "Todas" && item.category !== catFilter) return false;
        if (showLowOnly && Number(item.qty || 0) > Number(item.minQty || 0)) return false;
        const normalizedQuery = String(search || "").trim().toLowerCase();
        if (!normalizedQuery) return true;
        return String(item.name || "").toLowerCase().includes(normalizedQuery)
          || String(item.category || "").toLowerCase().includes(normalizedQuery)
          || String(item.location || "").toLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) =>
        String(left.name || "").localeCompare(String(right.name || ""), "pt-BR", { sensitivity: "base" })
      )
  ), [stock, catFilter, showLowOnly, search]);

  const filteredLog = useMemo(() => {
    const normalizedQuery = String(logSearch || "").trim().toLowerCase();
    if (!normalizedQuery) return log;
    return log.filter((entry) =>
      String(entry.itemName || "").toLowerCase().includes(normalizedQuery)
      || String(entry.patient || "").toLowerCase().includes(normalizedQuery)
      || String(entry.pharma || "").toLowerCase().includes(normalizedQuery)
      || String(entry.numReceita || "").toLowerCase().includes(normalizedQuery)
    );
  }, [log, logSearch]);

  const prescribers = useMemo(() => (
    users.filter((entry) => ["doctor", "dentist", "nurse_manager"].includes(String(entry.role || "")))
  ), [users]);

  const stockTotalPages = Math.max(1, Math.ceil(filtered.length / PHARMA_PAGE_SIZE));
  const pagedFiltered   = filtered.slice((stockPage - 1) * PHARMA_PAGE_SIZE, stockPage * PHARMA_PAGE_SIZE);
  const logTotalPages   = Math.max(1, Math.ceil(filteredLog.length / PHARMA_PAGE_SIZE));
  const pagedLog        = filteredLog.slice((logPage - 1) * PHARMA_PAGE_SIZE, logPage * PHARMA_PAGE_SIZE);

  const canUseWriteFlow = canWrite;

  async function handleDispense(payload) {
    await onDispense?.(payload);
  }

  async function handleStockConfirm(payload) {
    if (payload.mode === "add") {
      await onCreateStockItem?.(payload.form);
      return;
    }
    if (payload.mode === "edit") {
      await onUpdateStockItem?.(editItem.item.id, payload.form);
      return;
    }
    await onAdjustStockItem?.(editItem.item.id, { delta: payload.delta, reason: payload.reason, lote: payload.lote, validade: payload.validade, obs: payload.obs });
  }

  if (!canRead) {
    return (
      <div className="pharmacy-page">
        <PageHeader
          eyebrow="GESTÃO DE MEDICAMENTOS"
          title="Farmácia UBS"
          subtitle="Controle de estoque, dispensação e rastreabilidade de medicamentos."
        />
        <div className="pharma-auth-notice">
          <IconWarning />
          Sua sessao atual nao possui permissao para consultar a farmacia.
        </div>
      </div>
    );
  }

  return (
    <div className="pharmacy-page">
      <PageHeader
        eyebrow="GESTÃO DE MEDICAMENTOS"
        title="Farmácia UBS"
        subtitle="Controle de estoque, dispensação e rastreabilidade de medicamentos."
      />

      {error ? <div className="error error-banner">{error}</div> : null}
      {!canUseWriteFlow ? (
        <div className="pharma-auth-notice">
          <IconWarning />
          Seu perfil pode consultar estoque e histórico, mas não pode dispensar nem ajustar medicamentos.
        </div>
      ) : null}

      <div className="pharma-kpis">
        <KPI label="Total de itens" value={stock.length} className="card" />
        <KPI label="Estoque baixo" value={lowStock.length} className={`card${lowStock.length > 0 ? " kpi--warning" : ""}`} />
        <KPI label="Sem estoque" value={outStock.length} className={`card${outStock.length > 0 ? " kpi--danger" : ""}`} />
        <KPI label="Dispensações hoje" value={dispensasHoje} className="card kpi--info" />
      </div>

      <div className="pharma-tabs-bar">
        <Tabs>
          <Tab active={pharmaTab === "stock"} onClick={() => setPharmaTab("stock")}>Estoque</Tab>
          <Tab active={pharmaTab === "log"} onClick={() => setPharmaTab("log")}>Log de Movimentações</Tab>
          <Tab active={pharmaTab === "prescriptions"} onClick={() => setPharmaTab("prescriptions")}>Prescrições</Tab>
        </Tabs>
      </div>

      <div className="pharma-body">
        {pharmaTab === "stock" && (
          <div className="card card--noPad overflow-hidden">
            <div className="pharma-toolbar">
              <div className="pharma-search">
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setStockPage(1); }} placeholder="Buscar medicamento, categoria ou localizacao..." />
              </div>
              <div className="pharma-filter-cat">
                <Select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setStockPage(1); }}>
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </Select>
              </div>
              <Button variant="ghost" size="sm" className={showLowOnly ? "is-active" : ""} onClick={() => { setShowLowOnly((v) => !v); setStockPage(1); }}>
                {showLowOnly ? "So baixo" : "Filtrar baixo"}
              </Button>
              {canUseWriteFlow ? <Button size="sm" onClick={() => setEditItem({ item: null, mode: "add" })}>+ Novo medicamento</Button> : null}
            </div>
            <table className="patients-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: "center" }}>Status</th>
                    <th>Medicamento</th>
                    <th>Categoria</th>
                    <th style={{ textAlign: "center" }}>Estoque</th>
                    <th style={{ textAlign: "center" }}>Minimo</th>
                    <th>Localizacao</th>
                    {canUseWriteFlow ? <th style={{ textAlign: "center" }}>Acoes</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={canUseWriteFlow ? 7 : 6} className="muted small" style={{ textAlign: "center", padding: "2rem" }}>
                        Nenhum medicamento encontrado.
                      </td>
                    </tr>
                  ) : null}
                  {pagedFiltered.map((item) => {
                    const status = stockStatusClass(item);
                    return (
                      <tr key={item.id}>
                        <td style={{ textAlign: "center" }}>
                          <span className={`pharma-dot pharma-dot--${status === "ok" ? "ok" : status}`} />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: "var(--t-sm)" }}>{item.name}</div>
                          <div className="muted" style={{ fontSize: "var(--t-xs)" }}>{item.unit}</div>
                        </td>
                        <td><span className="pharma-cat">{item.category}</span></td>
                        <td style={{ textAlign: "center" }}><span className={`pharma-qty pharma-qty--${status}`}>{item.qty}</span></td>
                        <td className="muted small" style={{ textAlign: "center" }}>{item.minQty}</td>
                        <td className="muted small">{item.location}</td>
                        {canUseWriteFlow ? (
                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", gap: "var(--s-1)", justifyContent: "center" }}>
                              <Button size="sm" onClick={() => setDispenseItem(item)} disabled={Number(item.qty || 0) === 0}>Dispensar</Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditItem({ item, mode: "entrada" })}>+ Entrada</Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditItem({ item, mode: "adjust" })}>± Ajustar</Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditItem({ item, mode: "edit" })}>Editar</Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
            </table>
            {stockTotalPages > 1 && (
              <div className="table-pagination">
                <span>{filtered.length} itens — página {stockPage} de {stockTotalPages}</span>
                <div style={{ display: "flex", gap: "var(--s-2)" }}>
                  <Button variant="secondary" size="sm" disabled={stockPage <= 1} onClick={() => setStockPage(p => p - 1)}>← Anterior</Button>
                  <Button variant="secondary" size="sm" disabled={stockPage >= stockTotalPages} onClick={() => setStockPage(p => p + 1)}>Próxima →</Button>
                </div>
              </div>
            )}
          </div>
        )}
        {pharmaTab === "log" && (
          <>
            <div className="pharma-anvisa-notice">
              <span>
                <strong>ANVISA RDC 20/2011:</strong> a escrituração de dispensação deve ser conservada por no mínimo <strong>5 anos</strong>. O histórico abaixo vem do backend oficial e não pode depender de navegador local.
              </span>
            </div>

            <div className="card card--noPad overflow-hidden">
              <div className="pharma-toolbar">
                <div className="pharma-search" style={{ maxWidth: 380 }}>
                  <Input value={logSearch} onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }} placeholder="Buscar por medicamento, paciente, prescritor ou receita..." />
                </div>
                <Button onClick={() => exportPharmacyCsv(filteredLog)}>Exportar CSV (ANVISA)</Button>
              </div>
              <table className="patients-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Data / hora</th>
                    <th style={{ width: 90 }}>Tipo</th>
                    <th>Medicamento</th>
                    <th>Detalhe / Rastreabilidade</th>
                    <th style={{ width: 110 }}>Farmaceutico</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filteredLog.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted small" style={{ textAlign: "center", padding: "2rem" }}>
                        Nenhuma movimentacao registrada.
                      </td>
                    </tr>
                  ) : null}
                  {pagedLog.map((entry) => (
                    <tr key={entry.id}>
                      <td className="muted" style={{ fontSize: "var(--t-xs)", whiteSpace: "nowrap" }}>{fmtTs(entry.ts)}</td>
                      <td>{logTypeBadge(entry.type)}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: "var(--t-sm)" }}>{entry.itemName}</div>
                        {entry.lote ? <div className="muted" style={{ fontSize: "var(--t-xs)" }}>Lote: {entry.lote}</div> : null}
                      </td>
                      <td style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>
                        {entry.type === "dispensa" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span><strong>{entry.qty}x</strong> {"→"} <strong>{entry.patient}</strong></span>
                            {entry.prescriber ? <span className="muted">Prescritor: {entry.prescriber}{entry.prescriberCouncil ? ` (${entry.prescriberCouncil})` : ""}</span> : null}
                            {entry.numReceita ? <span className="muted">Receita nº {entry.numReceita}{entry.dtReceita ? ` - ${new Date(`${entry.dtReceita}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}</span> : null}
                            {entry.notes ? <span className="muted" style={{ fontStyle: "italic" }}>{entry.notes}</span> : null}
                          </div>
                        ) : null}
                        {entry.type === "ajuste" ? (
                          <>
                            <span style={{ fontWeight: 600, color: Number(entry.delta || 0) >= 0 ? "var(--success)" : "var(--danger)" }}>
                              {Number(entry.delta || 0) >= 0 ? "+" : ""}{entry.delta}
                            </span>
                            {entry.reason ? <span className="muted"> · {entry.reason}</span> : null}
                          </>
                        ) : null}
                        {entry.type === "cadastro" ? <span>Estoque inicial: {entry.qty}</span> : null}
                        {entry.type === "edicao" ? <span>Dados atualizados</span> : null}
                      </td>
                      <td className="muted small">{entry.pharma}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logTotalPages > 1 && (
                <div className="table-pagination">
                  <span>{filteredLog.length} registros — página {logPage} de {logTotalPages}</span>
                  <div style={{ display: "flex", gap: "var(--s-2)" }}>
                    <Button variant="secondary" size="sm" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>← Anterior</Button>
                    <Button variant="secondary" size="sm" disabled={logPage >= logTotalPages} onClick={() => setLogPage(p => p + 1)}>Próxima →</Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        {pharmaTab === "prescriptions" && (
          <div className="card card--noPad overflow-hidden">
            <div className="pharma-toolbar">
              <div className="pharma-search">
                <Input value={rxSearch} onChange={e => setRxSearch(e.target.value)} placeholder="Buscar paciente ou medicamento..." />
              </div>
            </div>
              <table className="patients-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Medicamentos</th>
                    <th>Profissional</th>
                    <th>Data</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rxLoading ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--text-2)" }}>Carregando prescrições...</td></tr>
                  ) : prescriptions.filter(rx => {
                    if (!rxSearch) return true;
                    const q = rxSearch.toLowerCase();
                    return String(rx.patientName || "").toLowerCase().includes(q) || String(rx.title || "").toLowerCase().includes(q);
                  }).length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--text-2)" }}>Nenhuma prescrição encontrada.</td></tr>
                  ) : prescriptions.filter(rx => {
                    if (!rxSearch) return true;
                    const q = rxSearch.toLowerCase();
                    return String(rx.patientName || "").toLowerCase().includes(q) || String(rx.title || "").toLowerCase().includes(q);
                  }).map(rx => (
                    <tr key={rx.id}>
                      <td><strong>{rx.patientName}</strong></td>
                      <td className="small" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(rx.title || "").replace(/^Prescricao:\s*/i, "")}</td>
                      <td className="muted small">{rx.professionalName || "—"}</td>
                      <td className="muted small">{rx.date ? new Date(rx.date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                      <td>
                        <Button size="sm" variant="ghost" onClick={() => printPrescription({
                          patient: { name: rx.patientName, id: rx.patientId },
                          medications: String(rx.title || "").replace(/^Prescricao:\s*/i, "").split(", ").map(n => ({ name: n })),
                          professional: { name: rx.professionalName, councilNumber: rx.professionalCouncil },
                        })}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="3" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 9V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4" stroke="currentColor" strokeWidth="1.3"/><path d="M5 4V2h6v2" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="7" r=".75" fill="currentColor"/></svg>
                          Imprimir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </div>

      {dispenseItem && canUseWriteFlow ? (
        <DispenseModal
          item={dispenseItem}
          patients={patients}
          prescribers={prescribers}
          onConfirm={handleDispense}
          onClose={() => setDispenseItem(null)}
        />
      ) : null}
      {editItem && canUseWriteFlow ? (
        <StockEditModal
          item={editItem.item}
          mode={editItem.mode}
          categories={categories}
          units={units}
          onConfirm={handleStockConfirm}
          onClose={() => setEditItem(null)}
        />
      ) : null}
    </div>
  );
}

export default PharmacyPage;

