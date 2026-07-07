import { useState, useEffect, useRef } from "react";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { FieldLabel } from "../shared.jsx";
import { api } from "../../../api.js";

export default function ProcedimentosStep({ data, onChange, user, token, users }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const itens = data.itens || [];

  const clinicians = (users || []).filter(u =>
    ["nurse_manager", "nursing_tech", "doctor"].includes(u.role)
  );

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api(
          `/catalog/items?q=${encodeURIComponent(q.trim())}&domain=procedure`,
          {}, token
        );
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [q, token]);

  function add(item) {
    if (itens.some(i => i.code === item.code)) { setQ(""); setResults([]); return; }
    onChange({ ...data, itens: [...itens, { code: item.code, name: item.name, category: item.category }] });
    setQ("");
    setResults([]);
  }

  function remove(code) {
    onChange({ ...data, itens: itens.filter(i => i.code !== code) });
  }

  function set(field, val) {
    onChange({ ...data, [field]: val });
  }

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Procedimentos Realizados</div>

        <div className="pap-row">
          <div className="pap-field">
            <FieldLabel required>Data da coleta / procedimento</FieldLabel>
            <Input
              type="date"
              value={data.dataColeta || ""}
              onChange={e => set("dataColeta", e.target.value)}
              style={{ maxWidth: 200 }}
            />
          </div>
          <div className="pap-field" style={{ flex: 1 }}>
            <FieldLabel required>Profissional responsável</FieldLabel>
            <select
              className="select"
              value={data.responsavelId || ""}
              onChange={e => set("responsavelId", e.target.value)}
              style={{ maxWidth: 400 }}
            >
              <option value="">Selecionar...</option>
              {clinicians.map(u => (
                <option key={u.id} value={u.id}>{u.name || u.username}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pap-field">
          <FieldLabel>Buscar procedimento</FieldLabel>
          <div style={{ position: "relative", maxWidth: 480 }}>
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Ex: citopatológico, HIV, curativo..."
            />
            {loading && <div className="muted small" style={{ padding: "var(--s-2)" }}>Buscando...</div>}
            {results.length > 0 && (
              <div className="ins-pat-results">
                {results.map(r => (
                  <Button key={r.code} variant="ghost" className="ins-pat-opt" onClick={() => add(r)} type="button">
                    <div className="ins-pat-opt__name">
                      <span className="pap-code" style={{ marginRight: "var(--s-2)" }}>{r.code}</span>
                      {r.name}
                    </div>
                    <div className="ins-pat-opt__sub">{r.category}</div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {itens.length > 0 && (
          <div className="pap-field">
            <FieldLabel>Procedimentos selecionados</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {itens.map(item => (
                <div key={item.code} className="wf-proc-item">
                  <span className="pap-code">{item.code}</span>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <span className="muted small">{item.category}</span>
                  <Button variant="ghost" size="sm" type="button" iconOnly style={{ color: "var(--danger)" }} onClick={() => remove(item.code)}>×</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {itens.length === 0 && (
          <div className="empty" style={{ padding: "2rem 1rem" }}>
            <p className="empty__desc">Nenhum procedimento selecionado. Use a busca acima.</p>
          </div>
        )}

        <div className="pap-field">
          <label className={`pap-opt${data.siscan ? " is-active" : ""}`} style={{ display: "inline-flex" }}>
            <input type="checkbox" checked={!!data.siscan} onChange={e => set("siscan", e.target.checked)} />
            Registrado no SISCAN
          </label>
        </div>
      </div>
    </div>
  );
}
