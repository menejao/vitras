import { useState } from "react";
import Button from "../ui/Button";
import Checkbox from "../ui/Checkbox";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import AppSelect from "../ui/AppSelect";
import AppDatePicker from "../ui/AppDatePicker";
import Textarea from "../ui/Textarea";
import { maskCpf } from "../../utils/formatting";
import { cpfReveal } from "../../api";

const TABS = [
  { id: "identity", label: "Identificação" },
  { id: "contact",  label: "Contato e Endereço" },
  { id: "clinical", label: "Dados Clínicos" },
  { id: "social",   label: "Dados Sociais" },
];

const CHRONIC_CONDITIONS = [
  { value: "diabetes",        label: "Diabetes" },
  { value: "hypertension",    label: "Hipertensão" },
  { value: "asthma",          label: "Asma" },
  { value: "copd",            label: "DPOC" },
  { value: "obesity",         label: "Obesidade" },
  { value: "heart_disease",   label: "Cardiopatia" },
  { value: "renal_disease",   label: "D. Renal" },
  { value: "stroke",          label: "AVC/Sequela" },
  { value: "tuberculosis",    label: "Tuberculose" },
  { value: "hanseniasis",     label: "Hanseníase" },
  { value: "mental_disorder", label: "Transtorno Mental" },
];

function ChronicPills({ values = [], onChange, readOnly }) {
  function toggle(v) {
    if (readOnly || !onChange) return;
    onChange(values.includes(v) ? values.filter((c) => c !== v) : [...values, v]);
  }
  return (
    <div className="chronic-pills">
      {CHRONIC_CONDITIONS.map(({ value, label }) => (
        <Button
          key={value}
          type="button"
          variant={values.includes(value) ? "primary" : "secondary"}
          size="sm"
          className={`chronic-pill${values.includes(value) ? " is-active" : ""}`}
          onClick={() => toggle(value)}
          disabled={readOnly}
          aria-pressed={values.includes(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function lockProps(readOnly) {
  return readOnly ? { readOnly: true, disabled: true } : {};
}

function Section({ title, children }) {
  return (
    <section className="form__section">
      <header className="form__section-header"><h3>{title}</h3></header>
      <div className="field-grid">{children}</div>
    </section>
  );
}

function Field({ label, span, children }) {
  return (
    <div className={`field${span === 2 ? " field--span-2" : ""}`}>
      <span className="field__label">{label}</span>
      {children}
    </div>
  );
}

export default function PatientModal({
  open,
  editingPatient,
  form,
  setForm,
  users,
  catOpts,
  isChildCategory,
  lookupCepAndFillAddress,
  formatPhone,
  formatCep,
  formatCpf,
  formatCns,
  error,
  busy,
  readOnly = false,
  onClose,
  onSubmit,
  token,
}) {
  const [activeTab, setActiveTab] = useState("identity");
  const [cpfRevealed, setCpfRevealed] = useState(false);

  async function handleRevealCpf() {
    if (cpfRevealed) { setCpfRevealed(false); return; }
    try {
      if (editingPatient?.id && token) {
        await cpfReveal(token, editingPatient.id);
      }
      setCpfRevealed(true);
    } catch { setCpfRevealed(true); } // reveal even if audit fails (access already verified)
  }

  if (!open) return null;

  const title = readOnly
    ? "Visualizar paciente"
    : editingPatient
      ? "Editar paciente"
      : "Novo paciente";

  const isPregnant = String(form.careCategory || "").toLowerCase() === "pregnant";
  const isChild = isChildCategory(form.careCategory);

  function upd(field) {
    return readOnly ? undefined : (e) => setForm((s) => ({ ...s, [field]: e.target.value }));
  }

  function updUpper(field) {
    return readOnly ? undefined : (e) => setForm((s) => ({ ...s, [field]: e.target.value.toUpperCase().slice(0, 2) }));
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      className="modal--xl modal--tabbed"
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!readOnly && (
            <Button type="submit" form="patient-modal-form" variant="primary" disabled={busy}>
              {busy ? "Salvando..." : "Salvar paciente"}
            </Button>
          )}
        </>
      }
    >
      <nav className="patient-modal-nav">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            className={`patient-modal-nav__tab${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </nav>

      {error && <p className="field__error patient-modal-nav__error">{error}</p>}

      <form id="patient-modal-form" className="patient-modal-form" onSubmit={onSubmit}>

        {activeTab === "identity" && (
          <>
            <Section title="Vínculo e equipe">
              <AppSelect label="Grupo / Categoria *" value={form.careCategory} onChange={upd("careCategory")} disabled={readOnly}>
                {(catOpts.length ? catOpts.filter((c) => c.value !== "chronic") : [{ value: "general", label: "Geral" }]).map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </AppSelect>
              <AppSelect label="ACS responsável" value={form.assignedAcsId} onChange={upd("assignedAcsId")} disabled={readOnly}>
                <option value="">Não atribuído</option>
                {users.filter((u) => u.role === "acs").map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </AppSelect>
              <div className="field field--span-2">
                <span className="field__label">Condições crônicas</span>
                <ChronicPills
                  values={form.chronicConditions || []}
                  onChange={readOnly ? undefined : (next) => setForm((s) => ({ ...s, chronicConditions: next }))}
                  readOnly={readOnly}
                />
              </div>
            </Section>

            <Section title="Identificação">
              <Field label="Nome completo *" span={2}>
                <Input value={form.name} onChange={upd("name")} placeholder="Nome completo do paciente" {...lockProps(readOnly)} />
              </Field>

              <Field label="Nome social / Nome preferido" span={2}>
                <Input value={form.nomeSocial || ""} onChange={upd("nomeSocial")} placeholder="Como a pessoa prefere ser chamada" {...lockProps(readOnly)} />
              </Field>

              <div className="field field--span-2">
                <span className="field__label">Nome da mãe</span>
                <div className="patient-modal__inline">
                  <Input
                    value={form.motherName}
                    onChange={upd("motherName")}
                    placeholder="Nome completo da mãe"
                    disabled={readOnly || form.motherUnknown || false}
                  />
                  <Checkbox
                    className="patient-modal__checkbox patient-modal__checkbox--compact"
                    label="Mãe desconhecida"
                    checked={form.motherUnknown || false}
                    onChange={readOnly ? undefined : (e) => setForm((s) => ({
                      ...s,
                      motherUnknown: e.target.checked,
                      motherName: e.target.checked ? "Desconhecida" : s.motherName === "Desconhecida" ? "" : s.motherName,
                    }))}
                    {...lockProps(readOnly)}
                  />
                </div>
              </div>

              {isChild && (
                <Field label="Nome do responsável" span={2}>
                  <Input value={form.guardianName || ""} onChange={upd("guardianName")} placeholder="Nome do responsável legal" {...lockProps(readOnly)} />
                </Field>
              )}

              <AppDatePicker label="Data de nascimento" value={form.birthDate} onChange={upd("birthDate")} disabled={readOnly} />
              <AppSelect label="Sexo biológico" value={form.sex} onChange={upd("sex")} disabled={readOnly}>
                <option value="">Não informado</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
                <option value="intersexo">Intersexo</option>
              </AppSelect>
              <AppSelect label="Raça / Cor" value={form.raceColor} onChange={upd("raceColor")} disabled={readOnly}>
                <option value="">Não informado</option>
                <option value="branca">Branca</option>
                <option value="preta">Preta</option>
                <option value="parda">Parda</option>
                <option value="amarela">Amarela</option>
                <option value="indigena">Indígena</option>
                <option value="nao_declarado">Não declarado</option>
              </AppSelect>
              {!isChild && (
                <AppSelect label="Estado civil" value={form.maritalStatus} onChange={upd("maritalStatus")} disabled={readOnly}>
                  <option value="">Não informado</option>
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="uniao_estavel">União estável</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="separado">Separado(a)</option>
                  <option value="viuvo">Viúvo(a)</option>
                </AppSelect>
              )}
              <Field label="Município de nascimento">
                <Input value={form.birthCity} onChange={upd("birthCity")} {...lockProps(readOnly)} />
              </Field>
              <Field label="UF de nascimento">
                <Input value={form.birthState} maxLength={2} onChange={updUpper("birthState")} {...lockProps(readOnly)} />
              </Field>
              <Field label="CPF">
                <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
                  <Input
                    value={editingPatient ? (cpfRevealed ? form.cpf : maskCpf(form.cpf)) : form.cpf}
                    onChange={editingPatient && !cpfRevealed ? undefined : (readOnly ? undefined : (e) => setForm((s) => ({ ...s, cpf: formatCpf(e.target.value) })))}
                    placeholder="000.000.000-00"
                    readOnly={editingPatient ? (!cpfRevealed || readOnly) : readOnly}
                    disabled={readOnly && !editingPatient}
                    style={{ flex: 1 }}
                  />
                  {editingPatient && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRevealCpf}>
                      {cpfRevealed ? "Ocultar" : "Revelar"}
                    </Button>
                  )}
                </div>
              </Field>
              <Field label="CNS">
                <Input value={form.cns} onChange={readOnly ? undefined : (e) => setForm((s) => ({ ...s, cns: formatCns(e.target.value) }))} placeholder="000 0000 0000 0000" {...lockProps(readOnly)} />
              </Field>
            </Section>
          </>
        )}

        {activeTab === "contact" && (
          <>
            <div className="patient-modal-acs-banner">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7.5v4M8 5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              Contato e endereço são coletados pelo ACS na visita domiciliar. Atualize pelo módulo <strong>ACS → Cadastro Domiciliar</strong> para manter a sincronia.
            </div>
            <Section title="Contato">
              <Field label="Telefone principal *">
                <Input value={form.phone} onChange={readOnly ? undefined : (e) => setForm((s) => ({ ...s, phone: formatPhone(e.target.value) }))} {...lockProps(readOnly)} />
              </Field>
              <Field label="Telefone alternativo">
                <Input value={form.phoneAlt} onChange={readOnly ? undefined : (e) => setForm((s) => ({ ...s, phoneAlt: formatPhone(e.target.value) }))} {...lockProps(readOnly)} />
              </Field>
            </Section>

            <Section title="Endereço">
              <Field label="CEP">
                <Input
                  value={form.zipCode}
                  onBlur={readOnly ? undefined : lookupCepAndFillAddress}
                  onChange={readOnly ? undefined : (e) => setForm((s) => ({ ...s, zipCode: formatCep(e.target.value) }))}
                  {...lockProps(readOnly)}
                />
              </Field>
              <Field label="Número">
                <Input value={form.number} onChange={upd("number")} {...lockProps(readOnly)} />
              </Field>
              <Field label="Rua / Logradouro" span={2}>
                <Input value={form.address} onChange={upd("address")} {...lockProps(readOnly)} />
              </Field>
              <Field label="Complemento">
                <Input value={form.complement} onChange={upd("complement")} {...lockProps(readOnly)} />
              </Field>
              <Field label="Bairro">
                <Input value={form.neighborhood} onChange={upd("neighborhood")} {...lockProps(readOnly)} />
              </Field>
              <Field label="Cidade">
                <Input value={form.city} onChange={upd("city")} {...lockProps(readOnly)} />
              </Field>
              <Field label="Estado (UF)">
                <Input value={form.state} maxLength={2} onChange={updUpper("state")} {...lockProps(readOnly)} />
              </Field>
            </Section>
          </>
        )}

        {activeTab === "clinical" && (
          <>
            {isPregnant && (
              <Section title="Dados gestacionais">
                <AppDatePicker label="DUM" value={form.pregnancyStartDate} onChange={upd("pregnancyStartDate")} disabled={readOnly} />
                <AppDatePicker label="DPP" value={form.expectedDeliveryDate} onChange={upd("expectedDeliveryDate")} disabled={readOnly} />
                <Field label="IG DUM — Semanas">
                  <Input type="number" min="0" max="45" value={form.gestationalAgeDumWeeks} onChange={upd("gestationalAgeDumWeeks")} {...lockProps(readOnly)} />
                </Field>
                <Field label="IG DUM — Dias">
                  <Input type="number" min="0" max="6" value={form.gestationalAgeDumDays} onChange={upd("gestationalAgeDumDays")} {...lockProps(readOnly)} />
                </Field>
                <AppDatePicker label="Data 1ª USG" value={form.usgDate1} onChange={upd("usgDate1")} disabled={readOnly} />
                <Field label="IG USG — Semanas">
                  <Input type="number" min="0" max="45" value={form.gestationalAgeUsgWeeks} onChange={upd("gestationalAgeUsgWeeks")} {...lockProps(readOnly)} />
                </Field>
                <Field label="IG USG — Dias">
                  <Input type="number" min="0" max="6" value={form.gestationalAgeUsgDays} onChange={upd("gestationalAgeUsgDays")} {...lockProps(readOnly)} />
                </Field>
                <AppDatePicker label="Data 2ª USG" value={form.usgDate2} onChange={upd("usgDate2")} disabled={readOnly} />
                <AppDatePicker label="Data 3ª USG" value={form.usgDate3} onChange={upd("usgDate3")} disabled={readOnly} />
              </Section>
            )}
            <Section title="Dados clínicos">
              <Field label="Alergias conhecidas" span={2}>
                <Textarea value={form.allergies} onChange={upd("allergies")} rows={2} {...lockProps(readOnly)} />
              </Field>
              <Field label="Comorbidades" span={2}>
                <Textarea value={form.comorbidities} onChange={upd("comorbidities")} rows={2} {...lockProps(readOnly)} />
              </Field>
              <Field label="Medicamentos em uso contínuo" span={2}>
                <Textarea value={form.medications} onChange={upd("medications")} rows={2} {...lockProps(readOnly)} />
              </Field>
            </Section>
          </>
        )}

        {activeTab === "social" && (
          <>
            <div className="patient-modal-acs-banner">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7.5v4M8 5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              Dados sociais e territoriais são responsabilidade do ACS. Atualize pelo módulo <strong>ACS → Cadastro Domiciliar</strong>.
            </div>
            <Section title="Dados territoriais">
              <Field label="Microárea">
                <Input value={form.microArea || ""} disabled readOnly />
              </Field>
              <Field label="Código de família">
                <Input value={form.familyCode || ""} disabled readOnly />
              </Field>
              <Field label="Frequência de visita ACS">
                <Input value={form.homeVisitFreq || ""} disabled readOnly />
              </Field>
              <AppSelect label="Tipo de moradia" value={form.housingType || ""} disabled>
                <option value="">Não informado</option>
                {["Alvenaria", "Madeira", "Taipa", "Improvisada", "Outro"].map((o) => <option key={o} value={o}>{o}</option>)}
              </AppSelect>
              <AppSelect label="Abastecimento de água" value={form.waterSupply || ""} disabled>
                <option value="">Não informado</option>
                {["Rede pública", "Poço/nascente", "Outros"].map((o) => <option key={o} value={o}>{o}</option>)}
              </AppSelect>
              <AppSelect label="Esgotamento sanitário" value={form.sewage || ""} disabled>
                <option value="">Não informado</option>
                {["Rede pública", "Fossa séptica", "Fossa rudimentar", "Céu aberto", "Outro"].map((o) => <option key={o} value={o}>{o}</option>)}
              </AppSelect>
              <AppSelect label="Destino do lixo" value={form.garbage || ""} disabled>
                <option value="">Não informado</option>
                {["Coletado", "Queimado", "Enterrado", "Céu aberto", "Outro"].map((o) => <option key={o} value={o}>{o}</option>)}
              </AppSelect>
              <AppSelect label="Energia elétrica" value={form.electricity || ""} disabled>
                <option value="">Não informado</option>
                {["Sim", "Não", "Irregular"].map((o) => <option key={o} value={o}>{o}</option>)}
              </AppSelect>
            </Section>

            <Section title="Informações psicossociais">
              <AppSelect label="Escolaridade" value={form.educationLevel || ""} disabled>
                <option value="">Não informado</option>
                <option value="sem_escolaridade">Sem escolaridade</option>
                <option value="fundamental_incompleto">Fundamental incompleto</option>
                <option value="fundamental_completo">Fundamental completo</option>
                <option value="medio_incompleto">Médio incompleto</option>
                <option value="medio_completo">Médio completo</option>
                <option value="superior_incompleto">Superior incompleto</option>
                <option value="superior_completo">Superior completo</option>
                <option value="pos_graduacao">Pós-graduação</option>
              </AppSelect>
              <Field label="Ocupação">
                <Input value={form.occupation || ""} placeholder="Ex.: agricultor, estudante, aposentado..." disabled readOnly />
              </Field>
              <AppSelect label="Situação familiar" value={form.familySituation || ""} disabled>
                <option value="">Não informado</option>
                <option value="mora_sozinho">Mora sozinho</option>
                <option value="familia_nuclear">Família nuclear</option>
                <option value="familia_extensa">Família extensa</option>
                <option value="unipessoal">Unipessoal</option>
                <option value="outro">Outro</option>
              </AppSelect>
              <AppSelect label="Apoio familiar" value={form.familySupport || ""} disabled>
                <option value="">Não informado</option>
                <option value="adequado">Adequado</option>
                <option value="parcial">Parcial</option>
                <option value="ausente">Ausente</option>
              </AppSelect>
              <AppSelect label="Vulnerabilidade social" value={form.socialVulnerability || ""} disabled>
                <option value="">Não informado</option>
                <option value="baixa">Baixa</option>
                <option value="moderada">Moderada</option>
                <option value="alta">Alta</option>
              </AppSelect>
              <Field label="Benefício social">
                <Input value={form.socialBenefit || ""} placeholder="Ex.: Bolsa Família, BPC, LOAS..." disabled readOnly />
              </Field>
              <AppSelect label="Dependência química" value={form.substanceDependency || ""} disabled>
                <option value="">Não informado</option>
                <option value="nao">Não</option>
                <option value="alcool">Álcool</option>
                <option value="tabaco">Tabaco</option>
                <option value="outras_drogas">Outras drogas</option>
                <option value="multiplas">Múltiplas substâncias</option>
              </AppSelect>
              <AppSelect label="Situação de violência" value={form.domesticViolence || ""} disabled>
                <option value="">Não informado</option>
                <option value="nao">Não</option>
                <option value="suspeita">Suspeita</option>
                <option value="confirmada">Confirmada</option>
              </AppSelect>
            </Section>
            <Section title="Triagem de Risco Alimentar (TRIA)">
              <AppSelect label="Alimentos acabaram antes de ter dinheiro para comprar?" value={form.triaAlimentosAcabaram === true ? "sim" : form.triaAlimentosAcabaram === false ? "nao" : ""} disabled>
                <option value="">Não informado</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </AppSelect>
              <AppSelect label="Precisou consumir só um tipo de alimento por falta de recursos?" value={form.triaTipoUnico === true ? "sim" : form.triaTipoUnico === false ? "nao" : ""} disabled>
                <option value="">Não informado</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </AppSelect>
            </Section>
          </>
        )}

      </form>
    </Modal>
  );
}
