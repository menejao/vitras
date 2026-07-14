/**
 * LabelPrintModal — Impressão de etiquetas laboratoriais (amostra biológica).
 *
 * LGPD:
 *   - Não exibe CPF, endereço, telefone, diagnóstico
 *   - Não registra dados clínicos em logs operacionais
 *   - Número de acesso gerado no backend (nunca no frontend)
 *
 * Impressão não altera status de coleta (collectedAt permanece inalterado).
 *
 * Layout: lista compacta (esquerda) + preview único (direita) + folha em mm no print.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { generateCode128SVG } from "../utils/barcode128";
import { prepareLaboratoryLabels, printLaboratoryLabels } from "../api";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";

// ── Template padrão do sistema (substituível por config da UBS no futuro) ──────
const DEFAULT_LABEL_CONFIG = {
  templateId:      "sheet_a4_3x8",
  templateName:    "A4 · 3×8 (Pimaco padrão)",
  labelWidthMm:    63.5,
  labelHeightMm:   29.6,
  columns:         3,
  rows:            8,
  pageWidthMm:     210,
  pageHeightMm:    297,
  marginTopMm:     10.5,
  marginRightMm:   5,
  marginBottomMm:  10.5,
  marginLeftMm:    5,
  horizontalGapMm: 2.5,
  verticalGapMm:   0,
  orientation:     "portrait",
  offsetXmm:       0,
  offsetYmm:       0,
};

const SPECIMEN_LABELS = {
  sangue_digital:    "Sangue (ponta de dedo)",
  sangue_venoso:     "Sangue venoso",
  urina:             "Urina",
  celulas_cervicais: "Células cervicais",
  fezes:             "Fezes",
};

const CONTAINER_LABELS = {
  microtubo_capilar:    "Microtubo capilar",
  tubo_vacutainer:      "Tubo vacutainer",
  tubo_edta:            "Tubo com EDTA",
  copo_coletor:         "Copo coletor",
  lamina_frasco:        "Lâmina / frasco",
  frasco_coletor_fezes: "Frasco coletor (fezes)",
};

function specimenLabel(t) { return SPECIMEN_LABELS[t] || t || "Amostra"; }
function containerLabel(t) { return CONTAINER_LABELS[t] || t || ""; }
function specimenFull(l) {
  const s = specimenLabel(l.specimenType);
  const c = containerLabel(l.containerType);
  return c ? `${s} · ${c}` : s;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LabelPrintModal({ request, token, onClose }) {
  const [labelData, setLabelData]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [printing, setPrinting]       = useState(false);
  const [error, setError]             = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewId, setPreviewId]     = useState(null);
  const [search, setSearch]           = useState("");
  const [startPosition, setStartPosition] = useState(1);

  const config         = DEFAULT_LABEL_CONFIG;
  const labelsPerPage  = config.columns * config.rows;
  const examRequestId  = request?.id;

  // ── Preparar etiquetas ────────────────────────────────────────────────────
  const prepare = useCallback(async () => {
    if (!examRequestId) {
      setError("Pedido sem identificador. Feche e tente novamente.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const exams = request?.exams || [];
      const res = await prepareLaboratoryLabels(token, examRequestId, {
        examIds: exams.map(ex => ex.examTypeId || ex.id).filter(Boolean),
      });
      setLabelData(res);
      const ids = (res?.labels || []).map(l => l.id);
      setSelectedIds(ids);
      setPreviewId(ids[0] || null);
    } catch (e) {
      setError(e.message || "Não foi possível preparar as etiquetas.");
    } finally {
      setLoading(false);
    }
  }, [token, examRequestId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { prepare(); }, [prepare]);

  const allLabels = labelData?.labels || [];

  // ── Filtro de busca ───────────────────────────────────────────────────────
  const filteredLabels = useMemo(() => {
    if (!search.trim()) return allLabels;
    const q = search.toLowerCase();
    return allLabels.filter(l =>
      (l.examName        || "").toLowerCase().includes(q) ||
      specimenLabel(l.specimenType).toLowerCase().includes(q) ||
      containerLabel(l.containerType).toLowerCase().includes(q) ||
      (l.accessionNumber || "").toLowerCase().includes(q)
    );
  }, [allLabels, search]);

  // ── Preview navigation ────────────────────────────────────────────────────
  const previewIdx   = allLabels.findIndex(l => l.id === previewId);
  const previewLabel = allLabels.find(l => l.id === previewId) || null;

  function prevPreview() {
    if (previewIdx > 0) setPreviewId(allLabels[previewIdx - 1].id);
  }
  function nextPreview() {
    if (previewIdx < allLabels.length - 1) setPreviewId(allLabels[previewIdx + 1].id);
  }

  // ── Seleção ───────────────────────────────────────────────────────────────
  function toggleSelect(id, e) {
    e?.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function selectAll()      { setSelectedIds(allLabels.map(l => l.id)); }
  function clearAll()       { setSelectedIds([]); }
  function selectUnprinted(){ setSelectedIds(allLabels.filter(l => !l.printCount).map(l => l.id)); }

  // ── Cálculo de folhas ─────────────────────────────────────────────────────
  const totalSelected  = selectedIds.length;
  const startPos0      = Math.max(0, startPosition - 1);
  const slotsOnFirst   = labelsPerPage - startPos0;
  const pagesNeeded    = totalSelected <= 0 ? 0 :
                         totalSelected <= slotsOnFirst ? 1 :
                         1 + Math.ceil((totalSelected - slotsOnFirst) / labelsPerPage);

  // ── Imprimir ──────────────────────────────────────────────────────────────
  async function handlePrint() {
    setPrinting(true);
    setError("");
    try {
      const selectedLabels = allLabels.filter(l => selectedIds.includes(l.id));
      await printLaboratoryLabels(token, examRequestId, {
        labelIds:      selectedIds,
        templateId:    config.templateId,
        selectedCount: totalSelected,
        pageCount:     pagesNeeded,
        startPosition,
      });
      // Atualizar printCount local sem reload
      setLabelData(prev => prev ? {
        ...prev,
        labels: prev.labels.map(l =>
          selectedIds.includes(l.id)
            ? { ...l, printCount: (l.printCount || 0) + 1 }
            : l
        ),
      } : prev);
      doPrint(selectedLabels);
    } catch (e) {
      setError(e.message || "Erro ao registrar impressão. Tente novamente.");
    } finally {
      setPrinting(false);
    }
  }

  function doPrint(labels) {
    const html = buildPrintHtml(labels, request, config, startPosition);
    const win  = window.open("", "_blank", "width=900,height=700");
    if (!win) { setError("Popup bloqueado. Permita popups para imprimir."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.onafterprint = () => win.close();
  }

  const showSearch    = allLabels.length > 5;
  const hasAnyPrinted = allLabels.some(l => l.printCount > 0);

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerActions = (
    <div className="label-print__footer">
      <div className="label-print__footer-info">
        {!loading && allLabels.length > 0 && (
          <>
            <span>{totalSelected} de {allLabels.length} selecionada{allLabels.length !== 1 ? "s" : ""}</span>
            {pagesNeeded > 0 && (
              <span className="label-print__page-pill">{pagesNeeded} folha{pagesNeeded !== 1 ? "s" : ""}</span>
            )}
          </>
        )}
      </div>
      <div className="label-print__footer-btns">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={printing}>Fechar</Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handlePrint}
          disabled={printing || loading || totalSelected === 0}
        >
          {printing ? "Imprimindo…" : totalSelected > 0 ? `Imprimir ${totalSelected}` : "Imprimir"}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      title="Imprimir etiquetas de coleta"
      onClose={onClose}
      className="modal--label-print"
      actions={footerActions}
    >
      <div className="label-print-body">
        {/* Loading */}
        {loading && <p className="label-print__loading">Preparando etiquetas…</p>}

        {/* Erro inicial (sem dados) */}
        {!loading && error && !labelData && (
          <div className="label-print__error-wrap">
            <div className="alert alert--danger" role="alert">{error}</div>
            <Button variant="secondary" size="sm" onClick={prepare} style={{ marginTop: "var(--s-3)" }}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Sem etiquetas */}
        {!loading && !error && allLabels.length === 0 && (
          <p className="label-print__empty">Nenhuma etiqueta disponível para este pedido.</p>
        )}

        {/* Conteúdo principal */}
        {!loading && allLabels.length > 0 && (
          <>
            {/* Cabeçalho resumo */}
            <div className="label-print__summary">
              <div className="label-print__summary-patient">
                {request.patientName || request.patientId}
              </div>
              <div className="label-print__summary-meta">
                {request.scheduledDate && <span>{request.scheduledDate}{request.scheduledTime ? ` · ${request.scheduledTime}` : ""}</span>}
                <span className="label-print__template-tag">{config.templateName}</span>
              </div>
              {error && (
                <div className="alert alert--danger" role="alert" style={{ marginTop: "var(--s-2)" }}>
                  {error}
                </div>
              )}
            </div>

            {/* Painel dividido: lista + preview */}
            <div className="label-print__panel">
              {/* ── Coluna esquerda: lista de seleção ── */}
              <div className="label-print__list-col">
                {/* Ações em massa */}
                <div className="label-print__bulk">
                  <button type="button" className="label-print__bulk-btn" onClick={selectAll}>
                    Selecionar todas
                  </button>
                  <button type="button" className="label-print__bulk-btn" onClick={clearAll}>
                    Limpar
                  </button>
                  {hasAnyPrinted && (
                    <button type="button" className="label-print__bulk-btn" onClick={selectUnprinted}>
                      Não impressas
                    </button>
                  )}
                </div>

                {/* Busca */}
                {showSearch && (
                  <div className="label-print__search">
                    <input
                      type="search"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar exame, material…"
                      className="input__control"
                      aria-label="Buscar etiqueta"
                    />
                  </div>
                )}

                {/* Posição de início */}
                <div className="label-print__start-pos">
                  <label className="label-print__start-pos-label">
                    Iniciar na posição
                    <select
                      value={startPosition}
                      onChange={e => setStartPosition(Number(e.target.value))}
                      className="label-print__start-pos-select"
                      aria-label="Posição de início na folha"
                    >
                      {Array.from({ length: labelsPerPage }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Lista de etiquetas */}
                <ul
                  className="label-print__list"
                  role="listbox"
                  aria-multiselectable="true"
                  aria-label="Etiquetas disponíveis"
                >
                  {filteredLabels.length === 0 && (
                    <li className="label-print__list-empty">Nenhuma etiqueta encontrada.</li>
                  )}
                  {filteredLabels.map(label => {
                    const checked    = selectedIds.includes(label.id);
                    const isActive   = label.id === previewId;
                    const isReprint  = (label.printCount || 0) > 0;
                    return (
                      <li
                        key={label.id}
                        className={`label-print__item${isActive ? " label-print__item--active" : ""}${isReprint ? " label-print__item--reprint" : ""}`}
                        onClick={() => setPreviewId(label.id)}
                        role="option"
                        aria-selected={checked}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === " " || e.key === "Enter") toggleSelect(label.id); }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => toggleSelect(label.id, e)}
                          onClick={e => e.stopPropagation()}
                          aria-label={`Selecionar ${label.examName}`}
                          className="label-print__item-cb"
                        />
                        <div className="label-print__item-info">
                          <div className="label-print__item-name">
                            {label.examName}
                            {isReprint && (
                              <span className="label-print__reprint-badge">Reimpressão</span>
                            )}
                          </div>
                          <div className="label-print__item-meta">{specimenFull(label)}</div>
                          {label.accessionNumber && (
                            <div className="label-print__item-acc">{label.accessionNumber}</div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* ── Coluna direita: preview único ── */}
              <div className="label-print__preview-col">
                {previewLabel ? (
                  <>
                    <div className="label-print__preview-nav">
                      <button
                        type="button"
                        className="label-print__nav-btn"
                        onClick={prevPreview}
                        disabled={previewIdx <= 0}
                        aria-label="Etiqueta anterior"
                      >‹</button>
                      <span className="label-print__nav-pos">
                        {previewIdx + 1} de {allLabels.length}
                      </span>
                      <button
                        type="button"
                        className="label-print__nav-btn"
                        onClick={nextPreview}
                        disabled={previewIdx >= allLabels.length - 1}
                        aria-label="Próxima etiqueta"
                      >›</button>
                    </div>
                    <SingleLabelPreview label={previewLabel} request={request} />
                  </>
                ) : (
                  <p className="label-print__preview-empty">
                    Clique em uma etiqueta para visualizar.
                  </p>
                )}
                <p className="label-print__print-hint">
                  Na impressão, use <strong>escala 100%</strong> e desative cabeçalhos e rodapés.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Preview de etiqueta única ────────────────────────────────────────────────
function SingleLabelPreview({ label, request }) {
  const barcodeSvg = useMemo(
    () => label.accessionNumber
      ? generateCode128SVG(label.accessionNumber, { moduleWidth: 1.5, barHeight: 32, fontSize: 9 })
      : "",
    [label.accessionNumber]
  );

  return (
    <div className="label-single-preview">
      <div className="label-single-preview__patient">
        {request.patientName || request.patientId}
      </div>
      {request.patientBirthDate && (
        <div className="label-single-preview__dob">DN: {request.patientBirthDate}</div>
      )}
      <div className="label-single-preview__exam">{label.examName}</div>
      <div className="label-single-preview__specimen">{specimenFull(label)}</div>
      {label.accessionNumber && (
        <>
          <div
            className="label-single-preview__barcode"
            dangerouslySetInnerHTML={{ __html: barcodeSvg }}
          />
          <div className="label-single-preview__acc">{label.accessionNumber}</div>
        </>
      )}
      {request.scheduledDate && (
        <div className="label-single-preview__date">
          {request.scheduledDate}{request.scheduledTime ? ` ${request.scheduledTime}` : ""}
        </div>
      )}
    </div>
  );
}

// ── Construção do HTML de impressão (mm, posicionamento absoluto) ─────────────
function buildPrintHtml(selectedLabels, request, config, startPosition) {
  const {
    labelWidthMm, labelHeightMm, columns, rows,
    pageWidthMm, pageHeightMm,
    marginTopMm, marginLeftMm,
    horizontalGapMm, verticalGapMm,
    offsetXmm, offsetYmm,
    orientation,
  } = config;

  const labelsPerPage = columns * rows;
  const startPos0     = Math.max(0, startPosition - 1);

  // Agrupar etiquetas por página
  const pages = [];
  selectedLabels.forEach((label, i) => {
    const absPos    = startPos0 + i;
    const pageIdx   = Math.floor(absPos / labelsPerPage);
    const posOnPage = absPos % labelsPerPage;
    const col       = posOnPage % columns;
    const row       = Math.floor(posOnPage / columns);
    const leftMm    = marginLeftMm + col * (labelWidthMm + horizontalGapMm) + offsetXmm;
    const topMm     = marginTopMm  + row * (labelHeightMm + verticalGapMm)  + offsetYmm;

    if (!pages[pageIdx]) pages[pageIdx] = [];
    pages[pageIdx].push({ label, leftMm, topMm });
  });

  const pagesHtml = pages.map((pageLabels, pageIdx) => {
    const isLast    = pageIdx === pages.length - 1;
    const labelsHtml = (pageLabels || []).map(({ label, leftMm, topMm }) => {
      const svg  = label.accessionNumber
        ? generateCode128SVG(label.accessionNumber, { moduleWidth: 1.2, barHeight: 18, fontSize: 7 })
        : "";
      const spec = specimenLabel(label.specimenType);
      const cont = containerLabel(label.containerType);
      return `<div class="lbl" style="left:${leftMm.toFixed(2)}mm;top:${topMm.toFixed(2)}mm;width:${labelWidthMm}mm;height:${labelHeightMm}mm;">
  <div class="p">${esc(request.patientName || request.patientId)}</div>
  ${request.patientBirthDate ? `<div class="d">DN: ${esc(request.patientBirthDate)}</div>` : ""}
  <div class="e">${esc(label.examName)}</div>
  <div class="s">${esc(spec)}${cont ? ` · ${esc(cont)}` : ""}</div>
  ${svg ? `<div class="b">${svg}</div><div class="a">${esc(label.accessionNumber)}</div>` : ""}
  ${request.scheduledDate ? `<div class="dt">${esc(request.scheduledDate)}</div>` : ""}
</div>`;
    }).join("\n");

    return `<div class="pg${isLast ? "" : " pb"}" style="width:${pageWidthMm}mm;height:${pageHeightMm}mm;">\n${labelsHtml}\n</div>`;
  }).join("\n");

  const pageSize = orientation === "landscape"
    ? `${pageHeightMm}mm ${pageWidthMm}mm landscape`
    : `${pageWidthMm}mm ${pageHeightMm}mm portrait`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Etiquetas VITRAS</title>
<style>
@page{size:${pageSize};margin:0;}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#fff;}
.pg{position:relative;overflow:hidden;font-family:Arial,Helvetica,sans-serif;}
.pb{page-break-after:always;}
.lbl{position:absolute;display:flex;flex-direction:column;justify-content:center;gap:0.3mm;padding:1.5mm 2mm;overflow:hidden;}
.p{font-size:7pt;font-weight:700;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.d,.dt{font-size:5.5pt;color:#555;line-height:1.2;}
.e{font-size:6.5pt;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.s{font-size:5.5pt;color:#555;line-height:1.2;}
.b svg{max-width:100%;height:auto;display:block;}
.a{font-size:5.5pt;color:#444;text-align:center;letter-spacing:0.02em;}
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
