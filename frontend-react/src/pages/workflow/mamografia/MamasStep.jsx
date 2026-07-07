import { CheckboxGroup } from "../shared.jsx";

const ACHADOS_OPTS = [
  { value: "nodulo_gordura", label: "Nódulo com densidade de gordura (sugere lipoma)" },
  { value: "nodulo_calcificado", label: "Nódulo calcificado (sugere fibroadenoma)" },
  { value: "nodulo_heterogeneo", label: "Nódulo com densidade heterogênea (sugere fibroadenolipoma)" },
  { value: "cisto_oleoso", label: "Cisto oleoso (esteatonecrose)" },
  { value: "calcificacoes_vasculares", label: "Calcificações vasculares" },
  { value: "calcificacoes_benignas", label: "Calcificações tipicamente benignas" },
  { value: "linfonodos_intramamarios", label: "Linfonodos intramamários" },
  { value: "distorcao_cirurgia", label: "Distorção arquitetural por cirurgia" },
  { value: "implante_sem_ruptura", label: "Implante sem sinais de ruptura" },
  { value: "implante_com_ruptura", label: "Implante com sinais de ruptura" },
  { value: "ectasia_ductal", label: "Ectasia ductal" },
  { value: "ginecomastia", label: "Ginecomastia" },
];

export default function MamasStep({ data, onChange }) {
  function set(field, val) { onChange({ ...data, [field]: val }); }

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Mama Direita</div>
        <CheckboxGroup
          label="Achados — Mama Direita"
          name="mamaDireita"
          value={data.mamaDireita || []}
          onChange={set}
          options={ACHADOS_OPTS}
        />
        {(data.mamaDireita || []).length === 0 && (
          <p className="muted small">Nenhum achado selecionado para a mama direita.</p>
        )}
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Mama Esquerda</div>
        <CheckboxGroup
          label="Achados — Mama Esquerda"
          name="mamaEsquerda"
          value={data.mamaEsquerda || []}
          onChange={set}
          options={ACHADOS_OPTS}
        />
        {(data.mamaEsquerda || []).length === 0 && (
          <p className="muted small">Nenhum achado selecionado para a mama esquerda.</p>
        )}
      </div>
    </div>
  );
}
