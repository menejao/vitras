import { useState } from "react";
import Button from "../../../components/ui/Button";
import Textarea from "../../../components/ui/Textarea";
import { FieldLabel } from "../shared.jsx";

export default function DocumentosStep({ data, onChange }) {
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("laudo");
  const arquivos = data.arquivos || [];

  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  function addArquivo() {
    const name = fileName.trim();
    if (!name) return;
    const item = {
      name,
      type: fileType,
      registeredAt: new Date().toISOString(),
    };
    onChange({ ...data, arquivos: [...arquivos, item] });
    setFileName("");
    setFileType("laudo");
  }

  function remove(i) {
    const next = arquivos.filter((_, idx) => idx !== i);
    onChange({ ...data, arquivos: next });
  }

  const FILE_TYPE_LABELS = {
    laudo: "Laudo",
    imagem: "Imagem",
    receita: "Receita",
    atestado: "Atestado",
    outro: "Outro",
  };

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Documentos do Atendimento</div>

        <div className="pap-field__hint" style={{ marginBottom: "var(--s-4)" }}>
          Registre os documentos relacionados a este atendimento. O envio de arquivos físicos será integrado futuramente.
        </div>

        <div className="pap-row" style={{ alignItems: "flex-end" }}>
          <div className="pap-field" style={{ flex: 1 }}>
            <FieldLabel>Nome / descrição do documento</FieldLabel>
            <input
              className="input"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              placeholder="Ex: Laudo citopatológico 06/2026"
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addArquivo())}
            />
          </div>
          <div className="pap-field">
            <FieldLabel>Tipo</FieldLabel>
            <select className="select" value={fileType} onChange={e => setFileType(e.target.value)}>
              {Object.entries(FILE_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <Button variant="secondary" size="sm" type="button" onClick={addArquivo} style={{ marginBottom: 1 }}>
            + Registrar
          </Button>
        </div>

        {arquivos.length > 0 && (
          <div className="pap-field">
            <FieldLabel>Documentos registrados</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {arquivos.map((a, i) => (
                <div key={i} className="wf-proc-item">
                  <span style={{ flex: 1 }}>{a.name}</span>
                  <span className="badge">{FILE_TYPE_LABELS[a.type] || a.type}</span>
                  <Button variant="ghost" size="sm" type="button" iconOnly style={{ color: "var(--danger)" }} onClick={() => remove(i)}>×</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pap-field">
          <FieldLabel>Observações sobre documentos</FieldLabel>
          <Textarea
            value={data.observacoes || ""}
            onChange={e => set("observacoes", e.target.value)}
            placeholder="Observações sobre os documentos deste atendimento..."
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}
