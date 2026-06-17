import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import PageHeader from "../components/layout/PageHeader";
import PatientsTable from "../components/patients/PatientsTable";
import PatientDetailPanel from "../components/patients/PatientDetailPanel";
import { calcAge, catLabel, normalizeSearch, protocolChip } from "../utils/clinical";

function normalizePatientCategory(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "pap_only" || normalized === "somente_papanicolau") return "general";
  return normalized || "general";
}

function sortByName(list) {
  return [...list].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" })
  );
}

export default function PatientsPage(props) {
  const {
    patients, users, templates, protocolByPatient,
    query, setQuery, categoryFilter, setCategoryFilter,
    acsFilter, setAcsFilter, conditionFilter, setConditionFilter,
    selectedPatientId, setSelectedPatientId,
    canManageUser, canWriteRecords,
    onEdit, onDelete, onView,
    patientTab, setPatientTab,
    appointments, tasks, messages, history, sortedSpecialAlerts,
    patientDataLoading,
    patientProtocolSummary,
    recordForm, setRecordForm, recordVaccines, setRecordVaccines, onSubmitRecord,
    appointmentForm, setAppointmentForm, onSubmitAppointment, onDeleteAppointment,
    taskForm, setTaskForm, onSubmitTask,
    messageText, setMessageText, onSubmitMessage,
    onStatusChange, onDeleteRecord,
    selectedPatient, userObj, token,
  } = props;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 1440);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    function onResize() { setIsNarrow(window.innerWidth < 1440); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    function handleClick(e) {
      if (!filterRef.current?.contains(e.target)) setFiltersOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filtersOpen]);

  const catOpts = useMemo(() => {
    const unique = new Map();
    (templates || []).forEach((t) => {
      const value = normalizePatientCategory(t.category);
      if (value === "chronic") return;
      if (!unique.has(value)) unique.set(value, { value, label: catLabel(templates || [], value) });
    });
    return [...unique.values()];
  }, [templates]);

  const acsUsers = useMemo(() => (users || []).filter((u) => u.role === "acs"), [users]);

  const activeFilters = [categoryFilter, acsFilter].filter(Boolean).length;

  const filtered = useMemo(() => {
    return (patients || []).filter((p) => {
      if (query.trim()) {
        const acsName = (users || []).find((u) => u.id === p.assignedAcsId)?.name || "";
        const cat = catLabel(templates || [], p.careCategory);
        const hay = normalizeSearch(`${p.name || ""} ${p.nomeSocial || ""} ${p.phone || ""} ${acsName} ${cat}`);
        if (!hay.includes(normalizeSearch(query))) return false;
      }
      if (categoryFilter && normalizePatientCategory(p.careCategory) !== normalizePatientCategory(categoryFilter)) return false;
      if (acsFilter && p.assignedAcsId !== acsFilter) return false;
      if (conditionFilter) {
        const cc = Array.isArray(p.chronicConditions) ? p.chronicConditions : [];
        if (conditionFilter === "hypertension" && !cc.includes("hypertension")) return false;
        if (conditionFilter === "diabetes" && !cc.includes("diabetes")) return false;
        if (conditionFilter === "both" && !(cc.includes("hypertension") && cc.includes("diabetes"))) return false;
      }
      return true;
    });
  }, [patients, query, categoryFilter, acsFilter, conditionFilter, users, templates]);

  const sorted = useMemo(() => sortByName(filtered), [filtered]);

  useEffect(() => { setPage(1); }, [sorted.length]);

  useEffect(() => {
    if (selectedPatientId && !sorted.some((p) => p.id === selectedPatientId)) {
      setSelectedPatientId?.("");
    }
  }, [sorted, selectedPatientId, setSelectedPatientId]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function togglePatient(patientId) {
    setSelectedPatientId?.((prev) => prev === patientId ? "" : patientId);
  }

  function handleCreate() {
    const fn = onEdit?.(null);
    if (typeof fn === "function") fn();
  }

  function closePanel() {
    setSelectedPatientId?.("");
  }

  const showSplit = !isNarrow && !!selectedPatient;
  const showOverlay = isNarrow && !!selectedPatient;

  const detailPanelProps = {
    patient: selectedPatient,
    users: users || [], templates: templates || [],
    patientTab, setPatientTab,
    appointments, tasks, messages, history, sortedSpecialAlerts,
    patientDataLoading,
    patientProtocolSummary,
    recordForm, setRecordForm, recordVaccines, setRecordVaccines, onSubmitRecord,
    appointmentForm, setAppointmentForm, onSubmitAppointment,
    taskForm, setTaskForm, onSubmitTask,
    messageText, setMessageText, onSubmitMessage,
    onDeleteAppointment, onStatusChange, onDeleteRecord,
    canManageUser, canWriteRecords,
    userObj, token, onClose: closePanel,
  };

  return (
    <div className="patients-page">
      {/* Hero section */}
      <PageHeader
        eyebrow="Gestão de Pacientes"
        title="Pacientes"
        subtitle="Carteira assistencial, cadastro operacional e abertura do atendimento clínico por paciente."
        actions={
          canManageUser ? (
            <Button onClick={handleCreate}>+ Novo paciente</Button>
          ) : null
        }
      />

      <div className={`patients-layout${showSplit ? " patients-layout--split" : ""}`}>
        {/* â"€â"€ LEFT: patient list â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        <div className="card card--noPad">
          {/* Toolbar */}
          <div className="patients-toolbar">
            <Input
              className="patients-toolbar__search"
              placeholder="Buscar por nome, telefone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="patients-toolbar__filter-wrap" ref={filterRef}>
              <Button
                className={`btn btn--secondary btn--sm${filtersOpen || activeFilters > 0 ? " is-active" : ""}`}
                onClick={() => setFiltersOpen((p) => !p)}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Filtros
                {activeFilters > 0 && (
                  <span className="patients-toolbar__filter-badge">{activeFilters}</span>
                )}
              </Button>

              {filtersOpen && (
                <div className="patients-filter-popover">
                  <div className="patients-filter-popover__head">
                    <span className="patients-filter-popover__title">Filtros</span>
                    {(categoryFilter || acsFilter) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setCategoryFilter(""); setAcsFilter(""); }}
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                  <div className="patients-filter-popover__body">
                    <Select label="Categoria" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                      <option value="">Todas as categorias</option>
                      {catOpts.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </Select>
                    <Select label="ACS responsável" value={acsFilter} onChange={(e) => setAcsFilter(e.target.value)}>
                      <option value="">Todos os ACS</option>
                      {acsUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <span className="patients-toolbar__meta">
              {sorted.length} paciente{sorted.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="patients-table-wrap">
            {!paged.length ? (
              <div className="empty">Nenhum paciente encontrado.</div>
            ) : (
              <PatientsTable
                patients={paged}
                selectedPatientId={selectedPatientId}
                catLabel={catLabel}
                templates={templates || []}
                calcAge={calcAge}
                users={users || []}
                protocolByPatient={protocolByPatient || {}}
                protocolChip={protocolChip}
                onToggleWorkspace={(patient) => togglePatient(patient.id)}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          </div>
          {/* Pagination */}
          <div className="pagination">
            <div className="pagination__page-size">
              <span className="pagination__page-size-label">Linhas por página</span>
              <Select
                className="patients-page-size"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </Select>
            </div>
            <span className="pagination__info">
              {sorted.length === 0
                ? "Sem resultados"
                : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} de ${sorted.length}`}
            </span>
            <div className="pagination__controls">
              <Button
                variant="ghost"
                size="sm"
                className="pagination__btn"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </Button>
              <span className="pagination__current">Página {safePage} de {totalPages}</span>
              <Button
                variant="ghost"
                size="sm"
                className="pagination__btn"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ›
              </Button>
            </div>
          </div>
        </div>

        {showSplit && (
          <div className="card card--noPad patient-side-panel">
            <PatientDetailPanel {...detailPanelProps} />
          </div>
        )}
      </div>

      {/* Overlay — narrow screens */}
      {showOverlay && (
        <div className="patients-detail-overlay" onClick={closePanel}>
          <div className="patients-detail-overlay__panel" onClick={(e) => e.stopPropagation()}>
            <PatientDetailPanel {...detailPanelProps} />
          </div>
        </div>
      )}
    </div>
  );
}
