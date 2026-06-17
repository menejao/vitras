import Input from "../ui/Input";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import Checkbox from "../ui/Checkbox";

function PatientDetailsPanel({ patient, users, templates, catLabel, displayText, isChildCategory, fmtDate, calcAge }) {
  if (!patient) return null;

  return (
    <div className="field-grid patient-details-panel">
      <Input label="Grupo / Categoria" value={catLabel(templates, patient.careCategory)} disabled />
      <Input label="ACS responsável" value={users.find((u) => u.id === patient.assignedAcsId)?.name || "Não atribuído"} disabled />

      <div className="field-span-2 patient-details__chronic">
        <span className="field__label">Condição crônica</span>
        <div className="patient-details__chronic-list">
          {[["diabetes", "Diabetes"], ["hypertension", "Hipertensão"]].map(([val, lbl]) => (
            <Checkbox key={val} className="patient-details__checkbox" checked={(patient.chronicConditions || []).includes(val)} disabled label={lbl} />
          ))}
        </div>
      </div>

      {patient.nomeSocial && (
        <Input className="field-span-2" label="Nome social / Nome preferido" value={displayText(patient.nomeSocial)} disabled />
      )}
      <Input className="field-span-2" label="Nome civil" value={displayText(patient.name)} disabled />
      {isChildCategory(patient.careCategory) ? (
        <Input className="field-span-2" label="Nome do responsável" value={displayText(patient.guardianName || patient.motherName)} disabled />
      ) : null}
      <Input label="Data de nascimento" value={patient.birthDate ? `${fmtDate(patient.birthDate)}${calcAge(patient.birthDate) ? " · " + calcAge(patient.birthDate) : ""}` : "-"} disabled />
      <Input label="Sexo" value={displayText(patient.sex)} disabled />
      <Input label="Município de nascimento" value={displayText(patient.birthCity)} disabled />
      <Input label="UF de nascimento" value={displayText(patient.birthState)} disabled />
      <Input label="Raça / Cor" value={displayText(patient.raceColor)} disabled />

      {!isChildCategory(patient.careCategory) ? (
        <Select label="Estado civil" value={patient.maritalStatus || ""} disabled>
          <option value="">Não informado</option>
          <option value="solteiro">Solteiro(a)</option>
          <option value="casado">Casado(a)</option>
          <option value="uniao_estavel">União estável</option>
          <option value="divorciado">Divorciado(a)</option>
          <option value="separado">Separado(a)</option>
          <option value="viuvo">Viúvo(a)</option>
        </Select>
      ) : null}

      <Input label="CPF" value={displayText(patient.cpf)} disabled />
      <Input label="CNS" value={displayText(patient.cns)} disabled />
      <Input label="Telefone" value={displayText(patient.phone)} disabled />
      <Input label="Telefone 2" value={displayText(patient.phoneAlt)} disabled />
      <Input label="CEP" value={displayText(patient.zipCode)} disabled />
      <Input label="Rua" value={displayText(patient.address)} disabled />
      <Input label="Número" value={displayText(patient.number)} disabled />
      <Input label="Complemento" value={displayText(patient.complement)} disabled />
      <Input label="Bairro" value={displayText(patient.neighborhood)} disabled />
      <Input label="Cidade" value={displayText(patient.city)} disabled />
      <Input label="Estado (UF)" value={displayText(patient.state)} disabled />
      <Input label="Código familiar" value={displayText(patient.familyCode)} disabled />
      <Input label="Frequência de visita domiciliar" value={displayText(patient.homeVisitFreq)} disabled />
      <Input label="Tipo de moradia" value={displayText(patient.housingType)} disabled />
      <Input label="Abastecimento de água" value={displayText(patient.waterSupply)} disabled />
      <Input label="Esgotamento sanitário" value={displayText(patient.sewage)} disabled />
      <Input label="Coleta de lixo" value={displayText(patient.garbage)} disabled />
      <Input label="Energia elétrica" value={displayText(patient.electricity)} disabled />

      {String(patient.careCategory || "").toLowerCase() === "pregnant" ? (
        <>
          <Input label="DUM" value={fmtDate(patient.pregnancyStartDate)} disabled />
          <Input label="DPP" value={fmtDate(patient.expectedDeliveryDate)} disabled />
          <Input label="IG DUM (sem)" value={displayText(patient.gestationalAgeDumWeeks)} disabled />
          <Input label="IG DUM (dias)" value={displayText(patient.gestationalAgeDumDays)} disabled />
          <Input label="Data 1ª USG" value={fmtDate(patient.usgDate1)} disabled />
          <Input label="IG USG (sem)" value={displayText(patient.gestationalAgeUsgWeeks)} disabled />
          <Input label="IG USG (dias)" value={displayText(patient.gestationalAgeUsgDays)} disabled />
          <Input label="Data 2ª USG" value={fmtDate(patient.usgDate2)} disabled />
          <Input label="Data 3ª USG" value={fmtDate(patient.usgDate3)} disabled />
        </>
      ) : null}

      <Textarea className="field-span-2" label="Alergias conhecidas" value={displayText(patient.allergies)} rows={3} disabled />
      <Textarea className="field-span-2" label="Comorbidades" value={displayText(patient.comorbidities)} rows={3} disabled />
      <Textarea className="field-span-2" label="Medicamentos em uso contínuo" value={displayText(patient.medications)} rows={3} disabled />
    </div>
  );
}

export default PatientDetailsPanel;
