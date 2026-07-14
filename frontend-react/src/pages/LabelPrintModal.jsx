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
 * Formatos suportados: 50×30mm, 50×25mm, A4
 */
import { useState, useEffect, useCallback } from "react";
import { generateCode128SVG } from "../utils/barcode128";
import { prepareLaboratoryLabels, printLaboratoryLabels } from "../api";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";

// Specimen type labels
const SPECIMEN_LABELS = {
  sangue_digital:    "Sangue (ponta de dedo)",
  sangue_venoso:     "Sangue venoso",
  urina:             "Urina",
  celulas_cervicais: "Células cervicais",
  fezes:             "Fezes",
};

// Container type labels
const CONTAINER_LABELS = {
  microtubo_capilar:     "Microtubo capilar",
  tubo_vacutainer:       "Tubo vacutainer",
  tubo_edta:             "Tubo com EDTA",
  copo_coletor:          "Copo coletor",
  lamina_frasco:         "Lâmina / frasco",
  frasco_coletor_fezes:  "Frasco coletor (fezes)",
};

const LABEL_SIZE_OPTIONS = [
  { value: "50x30", label: "50×30 mm (padrão UBS)" },
  { value: "50x25", label: "50×25 mm (compacto)" },
  { value: "a4",    label: "A4 (folha comum)" },
];

export default function LabelPrintModal({ request, token, onClose }) {
  const [labelData, setLabelData] = useState(null);
  const [loading, setLoading] = useState(true); // true so modal shows loading immediately
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [selectedSize, setSelectedSize] = useState("50x30");
  const [selectedExams, setSelectedExams] = useState([]);

  const examRequestId = request?.id;

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
      setSelectedExams((res?.labels || []).map(l => l.id));
    } catch (e) {
      setError(e.message || "Não foi possível preparar as etiquetas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [token, examRequestId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { prepare(); }, [prepare]);

  function toggleExam(id) {
    setSelectedExams(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handlePrint() {
    setPrinting(true);
    setError("");
    try {
      await printLaboratoryLabels(token, examRequestId, {
        labelIds: selectedExams,
        labelSize: selectedSize,
      });
      doPrint();
    } catch (e) {
      setError(e.message || "Erro ao registrar impressão. Tente novamente.");
    } finally {
      setPrinting(false);
    }
  }

  function doPrint() {
    const labels = (labelData?.labels || []).filter(l => selectedExams.includes(l.id));
    const html = buildPrintHtml(labels, request, selectedSize);
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) { setError("Popup bloqueado. Permita popups para imprimir."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.onafterprint = () => win.close();
  }

  const labels = labelData?.labels || [];

  return (
    <Modal
      title="Imprimir etiquetas de coleta"
      onClose={onClose}
      className="modal--label-print"
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={printing}>Fechar</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            disabled={printing || loading || selectedExams.length === 0}
          >
            {printing ? "Imprimindo..." : `Imprimir${selectedExams.length > 0 ? ` (${selectedExams.length})` : ""}`}
          </Button>
        </>
      }
    >
      <div className="label-print-body">
        {loading && (
          <p className="label-print__loading">Preparando etiquetas...</p>
        )}

        {!loading && error && (
          <div className="label-print__error">
            <div className="alert alert--danger" role="alert">{error}</div>
            <Button variant="secondary" size="sm" onClick={prepare} style={{ marginTop: "var(--s-3)" }}>
              Tentar novamente
            </Button>
          </div>
        )}

        {!loading && !error && labels.length === 0 && (
          <p className="label-print__empty">Nenhuma etiqueta disponível para este pedido.</p>
        )}

        {!loading && !error && labels.length > 0 && (
          <>
            {/* Format selector */}
            <div className="label-print__section">
              <label className="label-print__section-title">Formato de etiqueta</label>
              <div className="label-print__sizes">
                {LABEL_SIZE_OPTIONS.map(opt => (
                  <label key={opt.value} className="label-print__size-option">
                    <input
                      type="radio"
                      name="label_size"
                      value={opt.value}
                      checked={selectedSize === opt.value}
                      onChange={() => setSelectedSize(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Label previews */}
            <div className="label-print__section">
              <label className="label-print__section-title">
                Selecionar etiquetas ({selectedExams.length}/{labels.length})
              </label>
              <div className="label-print__previews">
                {labels.map(label => (
                  <LabelPreview
                    key={label.id}
                    label={label}
                    request={request}
                    selected={selectedExams.includes(label.id)}
                    onToggle={() => toggleExam(label.id)}
                    size={selectedSize}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function LabelPreview({ label, request, selected, onToggle }) {
  const barcodeSvg = generateCode128SVG(label.accessionNumber || "", {
    moduleWidth: 1.5,
    barHeight: 30,
    fontSize: 9,
  });

  const specimenLabel = SPECIMEN_LABELS[label.specimenType] || label.specimenType || "Amostra";
  const containerLabel = CONTAINER_LABELS[label.containerType] || label.containerType || "";

  return (
    <label className={`label-preview${selected ? " label-preview--selected" : ""}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="label-preview__checkbox"
      />
      <div className="label-preview__card">
        {/* Patient identifier — no CPF per LGPD */}
        <div className="label-preview__patient">{request.patientName || request.patientId}</div>
        <div className="label-preview__dob">
          {request.patientBirthDate ? `DN: ${request.patientBirthDate}` : ""}
        </div>

        {/* Exam name */}
        <div className="label-preview__exam">{label.examName}</div>

        {/* Specimen info */}
        <div className="label-preview__specimen">
          {specimenLabel}{containerLabel ? ` · ${containerLabel}` : ""}
        </div>

        {/* Accession number + barcode */}
        {label.accessionNumber && (
          <div className="label-preview__barcode">
            <div dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
          </div>
        )}

        {/* Scheduled date/time */}
        <div className="label-preview__date">
          {request.scheduledDate} {request.scheduledTime || ""}
        </div>
      </div>
    </label>
  );
}

// Build self-contained HTML for the print window
function buildPrintHtml(labels, request, size) {
  const mm = size === "50x30" ? { w: 50, h: 30 } :
             size === "50x25" ? { w: 50, h: 25 } :
             { w: 210, h: 297 }; // A4

  const isA4 = size === "a4";

  const labelItems = labels.map(label => {
    const svg = generateCode128SVG(label.accessionNumber || "", {
      moduleWidth: isA4 ? 2 : 1.5,
      barHeight:   isA4 ? 40 : 22,
      fontSize:    isA4 ? 10 : 8,
    });
    const specimenLabel = SPECIMEN_LABELS[label.specimenType] || label.specimenType || "Amostra";
    const containerLabel = CONTAINER_LABELS[label.containerType] || label.containerType || "";
    return `
      <div class="label">
        <div class="patient">${esc(request.patientName || request.patientId)}</div>
        ${request.patientBirthDate ? `<div class="dob">DN: ${esc(request.patientBirthDate)}</div>` : ""}
        <div class="exam">${esc(label.examName)}</div>
        <div class="specimen">${esc(specimenLabel)}${containerLabel ? ` · ${esc(containerLabel)}` : ""}</div>
        ${label.accessionNumber ? `<div class="barcode">${svg}</div>` : ""}
        <div class="date">${esc(request.scheduledDate)}${request.scheduledTime ? " " + esc(request.scheduledTime) : ""}</div>
      </div>
    `;
  }).join(isA4 ? "" : "");

  const pageSize = isA4 ? "a4 portrait" : `${mm.w}mm ${mm.h}mm`;
  const labelSize = isA4
    ? "width:100%;margin-bottom:8mm;border:0.3mm solid #ccc;padding:4mm;"
    : `width:${mm.w}mm;height:${mm.h}mm;overflow:hidden;page-break-after:always;`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Etiquetas — VITRAS</title>
<style>
@page { size: ${pageSize}; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
body { background: #fff; }
.label { ${labelSize} display:flex;flex-direction:column;justify-content:center;gap:0.8mm;padding:${isA4?"0":"1.5mm"}; }
.patient { font-size:${isA4?"11":"7"}pt; font-weight:700; }
.dob, .date, .specimen { font-size:${isA4?"9":"6.5"}pt; color:#444; }
.exam { font-size:${isA4?"10":"7"}pt; font-weight:600; }
.barcode svg { max-width:100%; height:auto; }
</style>
</head>
<body>
${labelItems}
</body>
</html>`;
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
