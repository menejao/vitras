import { useEffect, useMemo, useRef, useState } from "react";
import { isPharmacist } from "../utils/roles";
import { api, fetchPrescriptions } from "../api";
import { printPrescription } from "../utils/printDoc";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import { Tabs, Tab } from "../components/ui/Tabs";
import KPI from "../components/ui/KPI";

const BASE_UNITS = ["comprimido", "capsula", "frasco", "bolsa", "ampola", "sache", "bisnaga"];

const ORIGIN_LABELS = {
  medicina: "Medicina",
  medical: "Medicina",
  enfermagem: "Enfermagem",
  nursing: "Enfermagem",
  odontologia: "Odontologia",
  dentistry: "Odontologia",
};
function originLabel(raw) {
  return ORIGIN_LABELS[String(raw || "").toLowerCase()] || "Medicina";
}

const STATUS_LABELS = {
  ativa: { label: "Ativa", cls: "pharma-rx-badge--ativa" },
  parcialmente_dispensada: { label: "Parcial", cls: "pharma-rx-badge--parcial" },
  dispensada: { label: "Dispensada", cls: "pharma-rx-badge--dispensada" },
  vencida: { label: "Vencida", cls: "pharma-rx-badge--vencida" },
  cancelada: { label: "Cancelada", cls: "pharma-rx-badge--cancelada" },
};
function statusBadge(status) {
  const cfg = STATUS_LABELS[status] || { label: status, cls: "" };
  return <span className={`pharma-rx-badge ${cfg.cls}`}>{cfg.label}</span>;
}

function calcAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

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

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function PatientSearchAutocomplete({ patients, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const results = useMemo(() => {
    const q = normalizeSearch(query);
    if (q.length < 2) return [];
    const digits = q.replace(/\D/g, "");
    return patients.filter(p => {
      // Name match (accent-insensitive, case-insensitive)
      if (normalizeSearch(p.name).includes(q)) return true;
      // Phone match (text, partial)
      if (p.phone && normalizeSearch(p.phone).includes(q)) return true;
      // Digit-only fields: only match when query has digits
      if (digits.length >= 2) {
        const cpfDigits = String(p.cpf || "").replace(/\D/g, "");
        const cnsDigits = String(p.cns || "").replace(/\D/g, "");
        const phoneDigits = String(p.phone || "").replace(/\D/g, "");
        if (cpfDigits.includes(digits)) return true;
        if (cnsDigits.includes(digits)) return true;
        if (phoneDigits.includes(digits)) return true;
      }
      return false;
    }).slice(0, 8);
  }, [patients, query]);

  useEffect(() => {
    function onOut(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  function initials(name) {
    return String(name || "").split(" ").slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
  }

  function docLine(p) {
    const cpfDigits = String(p.cpf || "").replace(/\D/g, "");
    if (cpfDigits.length === 11) return `CPF ${cpfDigits.slice(0, 3)}.***.***-${cpfDigits.slice(9)}`;
    const cnsDigits = String(p.cns || "").replace(/\D/g, "");
    if (cnsDigits.length >= 15) return `CNS ${cnsDigits.slice(0, 3)} ****.***.**** **`;
    if (p.phone) return p.phone;
    return null;
  }

  function pick(p) {
    setQuery(p.name);
    setOpen(false);
    onSelect(p);
  }

  const showDropdown = open && query.length >= 2;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => query.length >= 2 && setOpen(true)}
        placeholder="Buscar paciente por nome, CPF ou CNS..."
        autoComplete="off"
      />
      {showDropdown && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
          maxHeight: 320, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.12)"
        }}>
          {results.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: "var(--t-sm)", color: "var(--text-2)" }}>
              Nenhum paciente encontrado para &quot;{query}&quot;
            </div>
          ) : results.map(p => {
            const doc = docLine(p);
            return (
              <div key={p.id} onClick={() => pick(p)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt, #f8fafc)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--teal-100, #ccfbf1)", color: "var(--teal-700, #0f766e)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>
                  {initials(p.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--t-sm)" }}>{p.name}</div>
                  {doc && (
                    <div style={{ fontSize: "var(--t-xs)", color: "var(--text-2)" }}>{doc}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StockItemAutocomplete({ stock, onSelect, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const wrapRef = useRef(null);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return stock.filter(s => Number(s.qty || 0) > 0 && (
      String(s.name || "").toLowerCase().includes(q) ||
      String(s.category || "").toLowerCase().includes(q)
    )).slice(0, 10);
  }, [stock, query]);

  useEffect(() => {
    function onOut(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  function pick(item) {
    setQuery(item.name);
    setSelected(item);
    setOpen(false);
    onSelect(item);
  }

  function clear() {
    setQuery(""); setSelected(null); setOpen(false); onSelect(null);
  }

  const status = selected ? stockStatusClass(selected) : null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); onSelect(null); setOpen(!!e.target.value); }}
          placeholder={placeholder || "Pesquisar medicamento por nome ou categoria..."}
          style={{ flex: 1 }}
        />
        {selected && (
          <button type="button" onClick={clear} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0 8px", cursor: "pointer", color: "var(--text-2)", fontSize: 14 }}>
            ✕
          </button>
        )}
      </div>
      {selected && (
        <div style={{ marginTop: 4, fontSize: "var(--t-xs)", color: "var(--text-2)" }}>
          Estoque: <span className={`pharma-stock-badge pharma-stock-badge--${status}`}>{selected.qty} {selected.unit}</span>
        </div>
      )}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
          maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.12)"
        }}>
          {results.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: "var(--t-sm)", color: "var(--text-2)" }}>
              Nenhum medicamento em estoque para &quot;{query}&quot;
            </div>
          ) : results.map(s => {
            const st = stockStatusClass(s);
            return (
              <div key={s.id} onClick={() => pick(s)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt, #f8fafc)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--t-sm)" }}>{s.name}</div>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--text-2)" }}>{s.category} · {s.unit}</div>
                </div>
                <span className={`pharma-stock-badge pharma-stock-badge--${st}`} style={{ fontSize: "0.75rem", marginLeft: 8, whiteSpace: "nowrap" }}>
                  {s.qty} {s.unit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function normSearch(v) {
  return String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function StockDispAutocomplete({ stock: availStock, value, onChange, placeholder }) {
  const [query, setQuery] = useState(value?.name || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => { setQuery(value?.name || ""); }, [value]);

  const results = useMemo(() => {
    const q = normSearch(query);
    const pool = availStock.filter(s => Number(s.qty || 0) > 0);
    if (q.length < 1) return pool.slice(0, 8);
    return pool.filter(s =>
      normSearch(s.name).includes(q) ||
      normSearch(s.category || "").includes(q) ||
      normSearch(s.unit || "").includes(q) ||
      (s.lote && normSearch(s.lote).includes(q))
    ).slice(0, 10);
  }, [availStock, query]);

  useEffect(() => {
    function onOut(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  function pick(item) { setQuery(item.name); setOpen(false); onChange(item); }

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || "Selecionar estoque disponível..."}
        autoComplete="off"
      />
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
          maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.12)"
        }}>
          {results.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: "var(--t-sm)", color: "var(--text-2)" }}>
              Nenhum item disponível no estoque para &quot;{query}&quot;
            </div>
          ) : results.map(s => {
            const st = stockStatusClass(s);
            return (
              <div key={s.id} onMouseDown={() => pick(s)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt,#f8fafc)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "var(--t-sm)" }}>{s.name}</div>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--text-2)" }}>
                    {s.category} · {s.unit}
                    {s.lote ? ` · Lote: ${s.lote}` : ""}
                    {s.validade ? ` · Val: ${fmtDate(s.validade)}` : ""}
                  </div>
                </div>
                <span className={`pharma-stock-badge pharma-stock-badge--${st}`}
                  style={{ fontSize: "0.75rem", marginLeft: 8, whiteSpace: "nowrap" }}>
                  {s.qty} {s.unit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DispensaReceitaModal({ receita, patient, stock, token, onClose, onSuccess }) {
  const today = new Date().toISOString().slice(0, 10);

  const availableStock = useMemo(() => {
    return stock.filter(s => {
      if (Number(s.qty || 0) <= 0) return false;
      if (s.validade && String(s.validade).slice(0, 10) < today) return false;
      return true;
    });
  }, [stock, today]);

  function suggest(itemName) {
    const q = normSearch(itemName);
    const tokens = q.split(/\s+/).filter(t => t.length > 2);
    let best = null, bestScore = 0;
    for (const s of availableStock) {
      const sn = normSearch(s.name);
      if (sn === q || sn.includes(q)) return s;
      const score = tokens.filter(t => sn.includes(t)).length;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return bestScore >= 2 ? best : null;
  }

  const [items, setItems] = useState(() =>
    (receita.itens || []).map((it, idx) => {
      const suggested = suggest(it.nome);
      return {
        idx,
        nome: it.nome,
        dosagem: it.dosagem || "",
        posologia: it.posologia || "",
        qtdPrescrita: Number(it.qtdPrescrita) || 1,
        stockItem: suggested,
        qtd: Number(it.qtdPrescrita) || 1,
      };
    })
  );
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function updateItem(idx, patch) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  async function handleConfirm() {
    setErr("");
    if (receita.validUntil && receita.validUntil < today) return setErr("Receita vencida. Não é possível dispensar.");
    if (receita.status === "cancelada") return setErr("Receita cancelada.");
    if (receita.status === "dispensada") return setErr("Receita já dispensada.");
    for (const it of items) {
      if (!it.stockItem) return setErr(`Selecione o item de estoque para "${it.nome}".`);
      if (Number(it.qtd) <= 0) return setErr(`Quantidade inválida para "${it.nome}".`);
      if (Number(it.qtd) > Number(it.stockItem.qty || 0)) {
        return setErr(`Quantidade (${it.qtd}) maior que estoque disponível (${it.stockItem.qty}) para "${it.stockItem.name}".`);
      }
    }
    setBusy(true);
    try {
      await api("/pharmacy/dispensacoes", {
        method: "POST",
        body: JSON.stringify({
          receitaId: receita.id,
          itens: items.map(it => ({ stockItemId: it.stockItem.id, qtd: Number(it.qtd) })),
          obs: obs.trim() || undefined,
        }),
      }, token);
      onSuccess();
      onClose();
    } catch (e) {
      setErr(e?.message || "Erro ao registrar dispensação.");
      setBusy(false);
    }
  }

  const isExpired = receita.validUntil && receita.validUntil < today;

  return (
    <Modal
      title="Dispensar receita"
      onClose={() => !busy && onClose()}
      className="modal--lg"
      actions={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button onClick={handleConfirm} disabled={busy || isExpired}>
          {busy ? "Registrando..." : "Confirmar dispensação"}
        </Button>
      </>}
    >
      {/* Receita header */}
      <div className="disp-modal-header">
        <div className="disp-modal-patient">
          <strong>{patient?.name}</strong>
          {calcAge(patient?.dob) !== null && <span> · {calcAge(patient?.dob)} anos</span>}
          {patient?.cpf && <span> · CPF {patient.cpf}</span>}
        </div>
        <div className="disp-modal-rx-info">
          <span>{originLabel(receita.origem)}</span>
          <span>Prescritor: {receita.prescritorNome || "—"}{receita.prescritorRegistro ? ` (${receita.prescritorRegistro})` : ""}</span>
          <span>Emitida: {fmtDate(receita.dtReceita)}</span>
          {receita.validUntil && (
            <span style={{ color: isExpired ? "var(--danger,#dc2626)" : undefined }}>
              Válida até: {fmtDate(receita.validUntil)}{isExpired ? " ⚠ VENCIDA" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
        {items.map((it, i) => (
          <div key={i} className="disp-modal-item">
            <div className="disp-modal-item__header">
              <span className="disp-modal-item__num">{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="disp-modal-item__name">{it.nome}</div>
                {(it.dosagem || it.posologia) && (
                  <div className="disp-modal-item__dosage">
                    {it.dosagem}{it.posologia ? ` · ${it.posologia}` : ""}
                  </div>
                )}
              </div>
              <div style={{ fontSize: "var(--t-xs)", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                Prescrito: {it.qtdPrescrita}
              </div>
            </div>
            <div className="disp-modal-item__fields">
              <StockDispAutocomplete
                stock={availableStock}
                value={it.stockItem}
                onChange={stockItem => updateItem(i, {
                  stockItem,
                  qtd: stockItem ? Math.min(Number(it.qtd), Number(stockItem.qty)) : it.qtd,
                })}
                placeholder="Buscar no estoque disponível..."
              />
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                <div style={{ width: 90 }}>
                  <Input
                    label="Qtd"
                    type="number"
                    min={1}
                    max={it.stockItem ? it.stockItem.qty : it.qtdPrescrita}
                    value={it.qtd}
                    onChange={e => updateItem(i, { qtd: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
                {it.stockItem && (
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--text-2)", paddingBottom: 10 }}>
                    / {it.stockItem.qty} em estoque
                  </div>
                )}
              </div>
            </div>
            {it.stockItem && Number(it.qtd) > Number(it.stockItem.qty) && (
              <div style={{ fontSize: "var(--t-xs)", color: "var(--danger,#dc2626)", marginTop: 4 }}>
                Quantidade maior que estoque disponível.
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <Input label="Observações" value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações (opcional)" />
      </div>

      {err && <div className="error-banner" style={{ marginTop: 12 }}>{err}</div>}
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
  const [pharmaTab, setPharmaTab] = useState("prescricoes");
  const [prescriptions, setPrescriptions] = useState([]);
  const [rxSearch, setRxSearch] = useState("");
  const [rxLoading, setRxLoading] = useState(false);

  // Patient-first dispensation state
  const [dispPatient, setDispPatient] = useState(null);
  const [dispReceitas, setDispReceitas] = useState([]);
  const [dispReceitasLoading, setDispReceitasLoading] = useState(false);
  const [dispModalReceita, setDispModalReceita] = useState(null);
  const [dispError, setDispError] = useState("");
  const [dispSuccess, setDispSuccess] = useState("");

  // External dispensation state — multi-item
  const EXT_BLANK_ITEM = () => ({ _key: Math.random(), stockItem: null, qty: 1, lote: "" });
  const [extPaciente, setExtPaciente] = useState({ nome: "", cpf: "", telefone: "" });
  const [extReceita, setExtReceita] = useState({ numero: "", dtEmissao: "", validade: "" });
  const [extPrescritor, setExtPrescritor] = useState({ nome: "", conselho: "CRM", numero: "", uf: "" });
  const [extItems, setExtItems] = useState([EXT_BLANK_ITEM()]);
  const [extObs, setExtObs] = useState("");
  const [extBusy, setExtBusy] = useState(false);
  const [extError, setExtError] = useState("");
  const [extSuccess, setExtSuccess] = useState("");
  const [extFieldErrors, setExtFieldErrors] = useState({});

  async function loadReceitasForPatient(patientId) {
    if (!token || !patientId) return;
    setDispReceitasLoading(true);
    setDispReceitas([]);
    setDispSelectedReceita(null);
    setDispItems([]);
    setDispError("");
    try {
      // Use api() so token refresh + CSRF are handled automatically
      const json = await api(`/pharmacy/receitas?patientId=${encodeURIComponent(patientId)}`, { method: "GET", retryCount: 2 }, token);
      // Show ativa + parcialmente_dispensada as active
      const active = (json.data || []).filter(r => r.status === "ativa" || r.status === "parcialmente_dispensada");
      setDispReceitas(active);
    } catch (e) {
      setDispError(e.message || "Erro ao carregar receitas.");
    } finally {
      setDispReceitasLoading(false);
    }
  }

  function openDispensaModal(receita) {
    setDispModalReceita(receita);
    setDispError("");
    setDispSuccess("");
  }

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

  async function submitExtDispensacao() {
    setExtError("");
    setExtSuccess("");
    const fe = {};
    if (!extPrescritor.nome.trim()) fe.prescritorNome = "Nome do prescritor é obrigatório.";
    if (!extPrescritor.numero.trim()) fe.prescritorNumero = "Número do registro é obrigatório.";
    if (!extPrescritor.uf.trim()) fe.prescritorUf = "UF é obrigatória.";
    if (!extReceita.numero.trim()) fe.receitaNumero = "Número da receita é obrigatório.";
    if (!extReceita.dtEmissao) fe.receitaDt = "Data da receita é obrigatória.";
    const validItems = extItems.filter(it => it.stockItem);
    if (validItems.length === 0) fe.items = "Adicione ao menos um medicamento.";
    for (const it of validItems) {
      if (Number(it.qty) <= 0) fe.items = "Quantidade deve ser maior que zero.";
      if (Number(it.qty) > Number(it.stockItem.qty || 0)) fe.items = `Estoque insuficiente: ${it.stockItem.name} (disponível: ${it.stockItem.qty}).`;
    }
    if (Object.keys(fe).length) { setExtFieldErrors(fe); return; }
    setExtFieldErrors({});
    setExtBusy(true);
    const council = `${extPrescritor.conselho} ${extPrescritor.numero}/${extPrescritor.uf}`.trim();
    const patientLabel = extPaciente.nome.trim() || "Dispensação externa";
    try {
      for (const it of validItems) {
        await onDispense?.({
          itemId: it.stockItem.id,
          qty: Number(it.qty),
          patient: patientLabel,
          patientId: "",
          prescriber: extPrescritor.nome.trim(),
          prescriberId: "",
          prescriberCouncil: council,
          numReceita: extReceita.numero.trim(),
          dtReceita: extReceita.dtEmissao,
          lote: it.lote.trim(),
          notes: extObs.trim(),
        });
      }
      setExtSuccess(`${validItems.length} medicamento(s) dispensado(s) com sucesso.`);
      setExtPaciente({ nome: "", cpf: "", telefone: "" });
      setExtReceita({ numero: "", dtEmissao: "", validade: "" });
      setExtPrescritor({ nome: "", conselho: "CRM", numero: "", uf: "" });
      setExtItems([EXT_BLANK_ITEM()]);
      setExtObs("");
    } catch (e) {
      setExtError(e?.message || "Erro ao registrar dispensação.");
    } finally {
      setExtBusy(false);
    }
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
          <Tab active={pharmaTab === "prescricoes"} onClick={() => setPharmaTab("prescricoes")}>Prescrições</Tab>
          {canWrite && <Tab active={pharmaTab === "dispensacao_externa"} onClick={() => setPharmaTab("dispensacao_externa")}>Dispensação Externa</Tab>}
          <Tab active={pharmaTab === "stock"} onClick={() => setPharmaTab("stock")}>Estoque</Tab>
          <Tab active={pharmaTab === "movimentacoes"} onClick={() => setPharmaTab("movimentacoes")}>Movimentações</Tab>
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
        {pharmaTab === "movimentacoes" && (
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
        {pharmaTab === "prescricoes" && (
          <div className="pharma-rx-layout">
            {/* Column 1: Patient search + patient card + receitas */}
            <div className="pharma-rx-left">
              {/* 1. Buscar paciente */}
              <div className="card" style={{ padding: "var(--s-5)" }}>
                <div style={{ fontWeight: 700, fontSize: "var(--t-sm)", marginBottom: 10, color: "var(--navy)" }}>Buscar paciente</div>
                <PatientSearchAutocomplete
                  patients={patients}
                  onSelect={p => {
                    setDispError("");
                    setDispSuccess("");
                    setDispPatient(p);
                    setDispSelectedReceita(null);
                    setDispItems([]);
                    loadReceitasForPatient(p.id);
                  }}
                />
                {dispPatient && (
                  <button type="button" onClick={() => { setDispPatient(null); setDispReceitas([]); setDispSelectedReceita(null); setDispItems([]); setDispError(""); setDispSuccess(""); }}
                    style={{ marginTop: 8, background: "none", border: "none", cursor: "pointer", fontSize: "var(--t-xs)", color: "var(--text-2)", textDecoration: "underline" }}>
                    Limpar seleção
                  </button>
                )}
              </div>

              {/* 2. Patient card */}
              {dispPatient && (
                <div className="pharma-patient-card card">
                  <div className="pharma-patient-card__avatar">
                    {String(dispPatient.name || "").split(" ").slice(0, 2).map(w => w[0] || "").join("").toUpperCase()}
                  </div>
                  <div className="pharma-patient-card__info">
                    <div className="pharma-patient-card__name">{dispPatient.name}</div>
                    <div className="pharma-patient-card__meta">
                      {calcAge(dispPatient.dob) !== null && <span>{calcAge(dispPatient.dob)} anos</span>}
                      {dispPatient.cpf && <span>CPF {dispPatient.cpf}</span>}
                      {dispPatient.cns && <span>CNS {dispPatient.cns}</span>}
                      {dispPatient.phone && <span>{dispPatient.phone}</span>}
                    </div>
                  </div>
                </div>
              )}

              {dispError && <div className="error-banner">{dispError}</div>}
              {dispSuccess && <div className="pharma-success-banner">{dispSuccess}</div>}

              {/* 3. Receitas ativas */}
              {dispPatient && (
                <div className="card" style={{ padding: "var(--s-5)" }}>
                  <div style={{ fontWeight: 700, fontSize: "var(--t-sm)", marginBottom: 10, color: "var(--navy)" }}>
                    Receitas ativas
                    {dispReceitas.length > 0 && <span style={{ marginLeft: 8, fontWeight: 400, fontSize: "var(--t-xs)", color: "var(--text-2)" }}>{dispReceitas.length} receita{dispReceitas.length !== 1 ? "s" : ""}</span>}
                  </div>
                  {dispReceitasLoading && <div style={{ color: "var(--text-2)", fontSize: "var(--t-sm)" }}>Carregando...</div>}
                  {!dispReceitasLoading && dispReceitas.length === 0 && (
                    <div className="pharma-rx-empty">
                      <div className="pharma-rx-empty__icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                      </div>
                      <div className="pharma-rx-empty__title">Nenhuma receita ativa</div>
                      <div className="pharma-rx-empty__text">Este paciente não possui prescrições pendentes de dispensação.</div>
                    </div>
                  )}
                  {!dispReceitasLoading && dispReceitas.map(r => {
                    return (
                      <div key={r.id} className="pharma-rx-card">
                        <div className="pharma-rx-card__header">
                          <div className="pharma-rx-card__origin">{originLabel(r.origem)}</div>
                          {statusBadge(r.status)}
                        </div>
                        <div className="pharma-rx-card__meta">
                          <span>{r.prescritorNome || "—"}{r.prescritorRegistro ? ` · ${r.prescritorRegistro}` : ""}</span>
                          <span>Emitida: {fmtDate(r.dtReceita)}</span>
                          {r.validUntil ? <span>Válida até: {fmtDate(r.validUntil)}</span> : r.validade ? <span>Validade: {r.validade}</span> : null}
                        </div>
                        <div className="pharma-rx-card__meds">
                          {r.itens.map((it, idx) => (
                            <div key={idx} className="pharma-rx-card__med">
                              <span className="pharma-rx-card__med-name">{it.nome}</span>
                              <span className="pharma-rx-card__med-detail">{it.dosagem}{it.posologia ? ` · ${it.posologia}` : ""}</span>
                            </div>
                          ))}
                        </div>
                        {canUseWriteFlow && (
                          <div className="pharma-rx-card__actions">
                            <button type="button" className="pharma-rx-card__btn-open" onClick={() => openDispensaModal(r)}>
                              Dispensar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!dispPatient && (
                <div className="pharma-rx-start">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.3"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  <p>Busque um paciente pelo nome, CPF ou CNS para ver as receitas pendentes de dispensação.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {pharmaTab === "dispensacao_externa" && canWrite && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "var(--s-5, 1.25rem)", alignItems: "start" }} className="ext-disp-grid">
            {/* Main form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-5, 1.25rem)" }}>
              {extError && <div className="error-banner">{extError}</div>}
              {extSuccess && <div style={{ background: "var(--success-bg, #ecfdf5)", color: "var(--success, #059669)", border: "1px solid var(--success, #059669)", borderRadius: 8, padding: "10px 14px" }}>{extSuccess}</div>}

              {/* Seção 1: Paciente */}
              <div className="card" style={{ padding: "var(--s-5, 1.25rem)" }}>
                <div style={{ fontWeight: 700, fontSize: "var(--t-sm)", marginBottom: 14, color: "var(--navy)" }}>1. Paciente</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="field-label">Nome</label>
                    <Input value={extPaciente.nome} onChange={e => setExtPaciente(p => ({ ...p, nome: e.target.value }))} placeholder="Nome completo do paciente" />
                  </div>
                  <div>
                    <label className="field-label">CPF</label>
                    <Input value={extPaciente.cpf} onChange={e => setExtPaciente(p => ({ ...p, cpf: e.target.value }))} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className="field-label">Telefone</label>
                    <Input value={extPaciente.telefone} onChange={e => setExtPaciente(p => ({ ...p, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                  </div>
                </div>
              </div>

              {/* Seção 2: Receita */}
              <div className="card" style={{ padding: "var(--s-5, 1.25rem)" }}>
                <div style={{ fontWeight: 700, fontSize: "var(--t-sm)", marginBottom: 14, color: "var(--navy)" }}>2. Receita</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="field-label">Número da receita *</label>
                    <Input value={extReceita.numero} onChange={e => setExtReceita(r => ({ ...r, numero: e.target.value }))} placeholder="Ex: 12345" />
                    {extFieldErrors.receitaNumero && <div style={{ color: "var(--danger, #dc2626)", fontSize: "var(--t-xs)", marginTop: 4 }}>{extFieldErrors.receitaNumero}</div>}
                  </div>
                  <div>
                    <label className="field-label">Data de emissão *</label>
                    <Input type="date" value={extReceita.dtEmissao} onChange={e => setExtReceita(r => ({ ...r, dtEmissao: e.target.value }))} />
                    {extFieldErrors.receitaDt && <div style={{ color: "var(--danger, #dc2626)", fontSize: "var(--t-xs)", marginTop: 4 }}>{extFieldErrors.receitaDt}</div>}
                  </div>
                  <div>
                    <label className="field-label">Validade</label>
                    <Input type="date" value={extReceita.validade} onChange={e => setExtReceita(r => ({ ...r, validade: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Seção 3: Prescritor */}
              <div className="card" style={{ padding: "var(--s-5, 1.25rem)" }}>
                <div style={{ fontWeight: 700, fontSize: "var(--t-sm)", marginBottom: 14, color: "var(--navy)" }}>3. Prescritor</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 90px 1fr 80px", gap: 12 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="field-label">Nome completo *</label>
                    <Input value={extPrescritor.nome} onChange={e => setExtPrescritor(p => ({ ...p, nome: e.target.value }))} placeholder="Dr. João da Silva" />
                    {extFieldErrors.prescritorNome && <div style={{ color: "var(--danger, #dc2626)", fontSize: "var(--t-xs)", marginTop: 4 }}>{extFieldErrors.prescritorNome}</div>}
                  </div>
                  <div>
                    <label className="field-label">Conselho</label>
                    <Select value={extPrescritor.conselho} onChange={e => setExtPrescritor(p => ({ ...p, conselho: e.target.value }))}>
                      <option value="CRM">CRM</option>
                      <option value="CRO">CRO</option>
                      <option value="COREN">COREN</option>
                      <option value="CRF">CRF</option>
                      <option value="CFM">CFM</option>
                    </Select>
                  </div>
                  <div>
                    <label className="field-label">Número *</label>
                    <Input value={extPrescritor.numero} onChange={e => setExtPrescritor(p => ({ ...p, numero: e.target.value }))} placeholder="000000" />
                    {extFieldErrors.prescritorNumero && <div style={{ color: "var(--danger, #dc2626)", fontSize: "var(--t-xs)", marginTop: 4 }}>{extFieldErrors.prescritorNumero}</div>}
                  </div>
                  <div>
                    <label className="field-label">UF *</label>
                    <Input value={extPrescritor.uf} onChange={e => setExtPrescritor(p => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="SP" maxLength={2} />
                    {extFieldErrors.prescritorUf && <div style={{ color: "var(--danger, #dc2626)", fontSize: "var(--t-xs)", marginTop: 4 }}>{extFieldErrors.prescritorUf}</div>}
                  </div>
                </div>
              </div>

              {/* Seção 4: Medicamentos */}
              <div className="card" style={{ padding: "var(--s-5, 1.25rem)" }}>
                <div style={{ fontWeight: 700, fontSize: "var(--t-sm)", marginBottom: 14, color: "var(--navy)" }}>4. Medicamentos</div>
                {extFieldErrors.items && <div style={{ color: "var(--danger, #dc2626)", fontSize: "var(--t-xs)", marginBottom: 10 }}>{extFieldErrors.items}</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {extItems.map((it, i) => (
                    <div key={it._key} style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px auto", gap: 10, alignItems: "start" }}>
                      <div>
                        {i === 0 && <label className="field-label">Medicamento *</label>}
                        <StockItemAutocomplete
                          stock={stock}
                          placeholder="Buscar por nome ou categoria..."
                          onSelect={item => setExtItems(prev => prev.map((x, j) => j === i ? { ...x, stockItem: item } : x))}
                        />
                      </div>
                      <div>
                        {i === 0 && <label className="field-label">Qtd *</label>}
                        <Input
                          type="number"
                          min={1}
                          max={it.stockItem ? it.stockItem.qty : undefined}
                          value={it.qty}
                          onChange={e => setExtItems(prev => prev.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                        />
                      </div>
                      <div>
                        {i === 0 && <label className="field-label">Lote</label>}
                        <Input
                          value={it.lote}
                          onChange={e => setExtItems(prev => prev.map((x, j) => j === i ? { ...x, lote: e.target.value } : x))}
                          placeholder="Opcional"
                        />
                      </div>
                      <div style={{ paddingTop: i === 0 ? 22 : 0 }}>
                        {extItems.length > 1 && (
                          <button type="button" onClick={() => setExtItems(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: "var(--text-2)", fontSize: 13 }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setExtItems(prev => [...prev, EXT_BLANK_ITEM()])} style={{ alignSelf: "flex-start" }}>
                    + Adicionar medicamento
                  </Button>
                </div>
              </div>

              {/* Seção 5: Observações */}
              <div className="card" style={{ padding: "var(--s-5, 1.25rem)" }}>
                <div style={{ fontWeight: 700, fontSize: "var(--t-sm)", marginBottom: 14, color: "var(--navy)" }}>5. Observações</div>
                <Input value={extObs} onChange={e => setExtObs(e.target.value)} placeholder="Anotações adicionais (opcional)" />
              </div>
            </div>

            {/* Sidebar: Resumo + Confirmar */}
            <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: "var(--s-4, 1rem)" }}>
              <div className="card" style={{ padding: "var(--s-5, 1.25rem)" }}>
                <div style={{ fontWeight: 700, fontSize: "var(--t-sm)", marginBottom: 14, color: "var(--navy)" }}>Resumo</div>
                <div style={{ fontSize: "var(--t-xs)", color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>Paciente:</span>{" "}
                    {extPaciente.nome || <span style={{ fontStyle: "italic" }}>Não informado</span>}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600 }}>Prescritor:</span>{" "}
                    {extPrescritor.nome ? `${extPrescritor.nome} (${extPrescritor.conselho} ${extPrescritor.numero}/${extPrescritor.uf})` : <span style={{ fontStyle: "italic" }}>Não informado</span>}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600 }}>Receita:</span>{" "}
                    {extReceita.numero || <span style={{ fontStyle: "italic" }}>Não informado</span>}
                    {extReceita.dtEmissao ? ` · ${new Date(`${extReceita.dtEmissao}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
                  </div>
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
                    <span style={{ fontWeight: 600 }}>Medicamentos:</span>
                    {extItems.filter(it => it.stockItem).length === 0 ? (
                      <div style={{ fontStyle: "italic", marginTop: 4 }}>Nenhum selecionado</div>
                    ) : extItems.filter(it => it.stockItem).map((it, i) => (
                      <div key={i} style={{ marginTop: 4 }}>
                        {it.qty}x {it.stockItem.name}
                        <span style={{ color: "var(--text-3, #94a3b8)" }}> ({it.stockItem.unit})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={submitExtDispensacao}
                disabled={extBusy}
                style={{ width: "100%" }}
              >
                {extBusy ? "Registrando..." : "Confirmar Dispensação"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {dispModalReceita && canUseWriteFlow && (
        <DispensaReceitaModal
          receita={dispModalReceita}
          patient={dispPatient}
          stock={stock}
          token={token}
          onClose={() => setDispModalReceita(null)}
          onSuccess={async () => {
            setDispSuccess("Dispensação realizada com sucesso.");
            if (dispPatient) await loadReceitasForPatient(dispPatient.id);
          }}
        />
      )}
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

