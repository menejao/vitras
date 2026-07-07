import { useState, useMemo } from "react";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { FieldLabel } from "../shared.jsx";

const CID10 = [
  { code: "Z12.4", desc: "Exame de rastreamento — neoplasia do colo uterino" },
  { code: "N87.0", desc: "Displasia leve do colo uterino (NIC I)" },
  { code: "N87.1", desc: "Displasia moderada do colo uterino (NIC II)" },
  { code: "N87.9", desc: "Displasia do colo uterino, não especificada" },
  { code: "D06.9", desc: "Carcinoma in situ do colo uterino, parte não especificada" },
  { code: "C53.9", desc: "Neoplasia maligna do colo uterino, parte não especificada" },
  { code: "N72",   desc: "Doença inflamatória do colo uterino" },
  { code: "N76.0", desc: "Vaginite aguda" },
  { code: "N89.0", desc: "Displasia vaginal leve" },
  { code: "A59.0", desc: "Tricomoníase urogenital" },
  { code: "B37.3", desc: "Candidíase da vulva e vagina" },
  { code: "A54.0", desc: "Infecção gonocócica do trato geniturinário inferior" },
  { code: "A63.0", desc: "Condiloma acuminado (HPV)" },
  { code: "Z34.0", desc: "Supervisão de primeira gravidez normal" },
  { code: "Z34.8", desc: "Supervisão de outras gravidez normais" },
  { code: "Z30.0", desc: "Aconselhamento sobre contracepção" },
  { code: "N95.1", desc: "Menopausa e estados climatéricos femininos" },
  { code: "I10",   desc: "Hipertensão essencial (primária)" },
  { code: "E11.9", desc: "Diabetes mellitus tipo 2 sem complicações" },
  { code: "E66.0", desc: "Obesidade por excesso de calorias" },
  { code: "F32.9", desc: "Episódio depressivo não especificado" },
  { code: "Z00.0", desc: "Exame médico geral" },
  { code: "Z71.1", desc: "Visita para fins de saúde / orientação" },
];

const LINHA_OPTS = [
  { value: "saude_mulher", label: "Saúde da Mulher" },
  { value: "dst_ist", label: "DST/IST" },
  { value: "doenca_cronica", label: "Doenças Crônicas" },
  { value: "saude_mental", label: "Saúde Mental" },
  { value: "outra", label: "Outra" },
];

export default function DiagnosticosStep({ data, onChange }) {
  const [q, setQ] = useState("");
  const itens = data.itens || [];
  const principalCode = data.principalCode || "";

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return CID10.filter(c =>
      c.code.toLowerCase().includes(t) || c.desc.toLowerCase().includes(t)
    ).slice(0, 10);
  }, [q]);

  function add(item) {
    if (itens.some(i => i.code === item.code)) { setQ(""); return; }
    const next = [...itens, item];
    onChange({ ...data, itens: next, principalCode: principalCode || item.code });
    setQ("");
  }

  function remove(code) {
    const next = itens.filter(i => i.code !== code);
    onChange({ ...data, itens: next, principalCode: principalCode === code ? (next[0]?.code || "") : principalCode });
  }

  function setPrincipal(code) {
    onChange({ ...data, principalCode: code });
  }

  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Problemas e Diagnósticos</div>

        <div className="pap-field">
          <FieldLabel>Buscar CID-10</FieldLabel>
          <div style={{ position: "relative", maxWidth: 480 }}>
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Ex: N87, displasia, candida..."
            />
            {results.length > 0 && (
              <div className="ins-pat-results">
                {results.map(r => (
                  <Button key={r.code} variant="ghost" className="ins-pat-opt" onClick={() => add(r)} type="button">
                    <div className="ins-pat-opt__name">
                      <span className="pap-code" style={{ marginRight: "var(--s-2)" }}>{r.code}</span>
                      {r.desc}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {itens.length > 0 && (
          <div className="pap-field">
            <FieldLabel>Diagnósticos selecionados</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {itens.map(item => (
                <div key={item.code} className={`wf-diag-item${item.code === principalCode ? " is-principal" : ""}`}>
                  <label className="wf-diag-radio">
                    <input
                      type="radio"
                      name="principalCode"
                      checked={item.code === principalCode}
                      onChange={() => setPrincipal(item.code)}
                    />
                    <span className="pap-code">{item.code}</span>
                    <span>{item.desc}</span>
                    {item.code === principalCode && (
                      <span className="badge badge--primary" style={{ marginLeft: "auto" }}>Principal</span>
                    )}
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    style={{ color: "var(--danger)", marginLeft: "auto" }}
                    onClick={() => remove(item.code)}
                    iconOnly
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pap-field">
          <FieldLabel>Linha de cuidado</FieldLabel>
          <div className="pap-field__opts">
            {LINHA_OPTS.map(o => (
              <label key={o.value} className={`pap-opt${data.linhaCuidado === o.value ? " is-active" : ""}`}>
                <input type="radio" name="linhaCuidado" value={o.value} checked={data.linhaCuidado === o.value} onChange={() => set("linhaCuidado", o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
