import { RadioGroup } from "../shared.jsx";

const PELE_OPTS = [
  { value: "normal", label: "Normal" },
  { value: "espessada", label: "Espessada" },
  { value: "retraida", label: "Retraída" },
  { value: "sem_informacao", label: "Sem informação" },
];

const TIPO_MAMA_OPTS = [
  { value: "densa", label: "Densa" },
  { value: "adiposa", label: "Adiposa" },
  { value: "predominantemente_densa", label: "Predominantemente densa" },
  { value: "predominantemente_adiposa", label: "Predominantemente adiposa" },
  { value: "parenquima_deslocado_implante", label: "Parênquima deslocado anteriormente pelo implante" },
  { value: "mama_reconstruida", label: "Mama reconstruída" },
  { value: "sem_informacao", label: "Sem informação" },
];

const LINFONODO_OPTS = [
  { value: "normais", label: "Normais" },
  { value: "nao_visualizados", label: "Não visualizados" },
  { value: "aumentados", label: "Aumentados" },
  { value: "densos", label: "Densos" },
  { value: "confluentes", label: "Confluentes" },
  { value: "dilatacao_ductal_retroareolar", label: "Dilatação ductal isolada na região retroareolar" },
];

const SIM_NAO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

export default function ImagemStep({ data, onChange }) {
  function set(field, val) { onChange({ ...data, [field]: val }); }

  return (
    <div className="pap-form">
      <div className="pap-section">
        <div className="pap-section__title">Pele</div>
        <RadioGroup label="Pele" name="pele" value={data.pele || ""} onChange={set} options={PELE_OPTS} />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Tipo de Mama</div>
        <RadioGroup label="Tipo de mama" name="tipoMama" value={data.tipoMama || ""} onChange={set} options={TIPO_MAMA_OPTS} />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Achados Gerais</div>
        <RadioGroup label="Nódulo identificado?" name="noduloIdentificado" value={data.noduloIdentificado || ""} onChange={set} options={SIM_NAO} />
        <RadioGroup label="Microcalcificação identificada?" name="microcalcificacaoIdentificada" value={data.microcalcificacaoIdentificada || ""} onChange={set} options={SIM_NAO} />
        <RadioGroup label="Assimetria focal identificada?" name="assimetriaFocalIdentificada" value={data.assimetriaFocalIdentificada || ""} onChange={set} options={SIM_NAO} />
        <RadioGroup label="Assimetria difusa identificada?" name="assimetriaDifusaIdentificada" value={data.assimetriaDifusaIdentificada || ""} onChange={set} options={SIM_NAO} />
      </div>

      <div className="pap-section">
        <div className="pap-section__title">Linfonodos Axilares</div>
        <RadioGroup label="Linfonodos axilares" name="linfonodosAxilares" value={data.linfonodosAxilares || ""} onChange={set} options={LINFONODO_OPTS} />
      </div>
    </div>
  );
}
