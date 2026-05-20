import { useState } from "react";
import { createPatient, updatePatient } from "../api";
import { emptyPatientForm } from "../utils/clinical";
import { onlyDigits } from "../utils/formatting";

function buildPatientFormState(p) {
  if (!p) return emptyPatientForm();
  return {
    name: String(p?.name || ""),
    motherName: String(p?.motherName || ""),
    motherUnknown: p?.motherUnknown || false,
    guardianName: String(p?.guardianName || ""),
    cpf: String(p?.cpf || ""),
    cns: String(p?.cns || ""),
    birthDate: String(p?.birthDate || ""),
    birthCity: String(p?.birthCity || ""),
    birthState: String(p?.birthState || ""),
    phone: String(p?.phone || ""),
    phoneAlt: String(p?.phoneAlt || ""),
    careCategory: String(p?.careCategory || "general"),
    chronicConditions: Array.isArray(p?.chronicConditions) ? p.chronicConditions : [],
    assignedAcsId: String(p?.assignedAcsId || ""),
    zipCode: String(p?.zipCode || ""),
    address: String(p?.address || ""),
    number: String(p?.number || ""),
    complement: String(p?.complement || ""),
    neighborhood: String(p?.neighborhood || ""),
    city: String(p?.city || ""),
    state: String(p?.state || ""),
    sex: String(p?.sex || ""),
    raceColor: String(p?.raceColor || ""),
    maritalStatus: String(p?.maritalStatus || ""),
    allergies: String(p?.allergies || ""),
    comorbidities: String(p?.comorbidities || ""),
    medications: String(p?.medications || ""),
    microArea: String(p?.microArea || ""),
    familyCode: String(p?.familyCode || ""),
    homeVisitFreq: String(p?.homeVisitFreq || ""),
    housingType: String(p?.housingType || ""),
    waterSupply: String(p?.waterSupply || ""),
    sewage: String(p?.sewage || ""),
    garbage: String(p?.garbage || ""),
    electricity: String(p?.electricity || ""),
    pregnancyStartDate: String(p?.pregnancyStartDate || ""),
    expectedDeliveryDate: String(p?.expectedDeliveryDate || ""),
    gestationalAgeDumWeeks: String(p?.gestationalAgeDumWeeks ?? ""),
    gestationalAgeDumDays: String(p?.gestationalAgeDumDays ?? ""),
    gestationalAgeUsgWeeks: String(p?.gestationalAgeUsgWeeks ?? ""),
    gestationalAgeUsgDays: String(p?.gestationalAgeUsgDays ?? ""),
    usgDate1: String(p?.usgDate1 || ""),
    usgDate2: String(p?.usgDate2 || ""),
    usgDate3: String(p?.usgDate3 || ""),
    educationLevel: String(p?.educationLevel || ""),
    occupation: String(p?.occupation || ""),
    familySituation: String(p?.familySituation || ""),
    familySupport: String(p?.familySupport || ""),
    socialVulnerability: String(p?.socialVulnerability || ""),
    socialBenefit: String(p?.socialBenefit || ""),
    substanceDependency: String(p?.substanceDependency || ""),
    domesticViolence: String(p?.domesticViolence || ""),
  };
}

export function usePatientModal({
  token,
  user,
  handleApiError,
  setBusy,
  setError,
  loadAll,
  selectedPatientId,
  setSelectedPatientId,
}) {
  const [editingPatient, setEditingPatient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [patientModalMode, setPatientModalMode] = useState("edit");
  const [form, setForm] = useState(emptyPatientForm);

  function openEditPatient(p) {
    return () => {
      setEditingPatient(p);
      setPatientModalMode("edit");
      setForm(buildPatientFormState(p));
      setShowModal(true);
    };
  }

  function openViewPatient(p) {
    setEditingPatient(p || null);
    setPatientModalMode("view");
    setForm(buildPatientFormState(p));
    setShowModal(true);
  }

  async function lookupCepAndFillAddress() {
    const digits = onlyDigits(form.zipCode);
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data?.erro) return;
      setForm((s) => ({
        ...s,
        address: s.address || String(data.logradouro || ""),
        neighborhood: s.neighborhood || String(data.bairro || ""),
        city: s.city || String(data.localidade || ""),
        state: s.state || String(data.uf || ""),
      }));
    } catch {}
  }

  async function submitPatient(e) {
    e.preventDefault();
    if (!token) return;
    if (!form.name.trim() || !form.phone.trim()) { setError("Nome e telefone são obrigatórios."); return; }
    setBusy(true); setError("");
    try {
      const payload = {
        name: form.name.trim(),
        motherName: form.motherUnknown ? "Desconhecida" : form.motherName.trim(),
        motherUnknown: form.motherUnknown || false,
        guardianName: (form.guardianName || "").trim(),
        cpf: form.cpf.trim(), cns: form.cns.trim(),
        birthDate: form.birthDate || "", birthCity: form.birthCity.trim(), birthState: form.birthState.trim().toUpperCase(),
        phone: form.phone.trim(), phoneAlt: form.phoneAlt.trim(),
        careCategory: form.careCategory || "general",
        chronicConditions: Array.isArray(form.chronicConditions) ? form.chronicConditions : [],
        incompleteProfile: false, assignedAcsId: form.assignedAcsId || "",
        zipCode: form.zipCode.trim(), address: form.address.trim(), number: form.number.trim(),
        complement: form.complement.trim(), neighborhood: form.neighborhood.trim(),
        city: form.city.trim(), state: form.state.trim().toUpperCase(),
        sex: form.sex.trim(), raceColor: form.raceColor || "", maritalStatus: form.maritalStatus.trim(),
        allergies: form.allergies.trim(), comorbidities: form.comorbidities.trim(), medications: form.medications.trim(),
        microArea: (form.microArea || "").trim(), familyCode: (form.familyCode || "").trim(),
        homeVisitFreq: (form.homeVisitFreq || "").trim(), housingType: form.housingType || "",
        waterSupply: form.waterSupply || "", sewage: form.sewage || "",
        garbage: form.garbage || "", electricity: form.electricity || "",
        pregnancyStartDate: form.pregnancyStartDate || "", expectedDeliveryDate: form.expectedDeliveryDate || "",
        gestationalAgeDumWeeks: form.gestationalAgeDumWeeks === "" ? null : Number(form.gestationalAgeDumWeeks),
        gestationalAgeDumDays: form.gestationalAgeDumDays === "" ? null : Number(form.gestationalAgeDumDays),
        gestationalAgeUsgWeeks: form.gestationalAgeUsgWeeks === "" ? null : Number(form.gestationalAgeUsgWeeks),
        gestationalAgeUsgDays: form.gestationalAgeUsgDays === "" ? null : Number(form.gestationalAgeUsgDays),
        usgDate1: form.usgDate1 || "", usgDate2: form.usgDate2 || "", usgDate3: form.usgDate3 || "",
        educationLevel: form.educationLevel || "", occupation: (form.occupation || "").trim(),
        familySituation: form.familySituation || "", familySupport: form.familySupport || "",
        socialVulnerability: form.socialVulnerability || "", socialBenefit: (form.socialBenefit || "").trim(),
        substanceDependency: form.substanceDependency || "", domesticViolence: form.domesticViolence || "",
      };
      if (editingPatient?.id) {
        await updatePatient(token, editingPatient.id, payload);
      } else {
        await createPatient(token, payload);
      }
      setShowModal(false);
      await loadAll();
    } catch (e) {
      if (!(await handleApiError(e))) setError(e.message || "Erro ao salvar paciente");
    } finally {
      setBusy(false);
    }
  }

  async function removePatient(p) {
    if (!token || !p) return;
    setBusy(true); setError("");
    try {
      if (p._deactivate) {
        await updatePatient(token, p.id, {
          inactive: true,
          inactivationReason: String(p._justification || "").trim(),
          inactivatedBy: user?.name || "",
          inactivatedAt: new Date().toISOString(),
        });
      } else {
        return;
      }
      if (selectedPatientId === p.id) setSelectedPatientId("");
      await loadAll();
    } catch (e) {
      setError(e.message || "Erro ao desativar");
    } finally {
      setBusy(false);
    }
  }

  return {
    editingPatient,
    showModal, setShowModal,
    patientModalMode,
    form, setForm,
    openEditPatient, openViewPatient,
    lookupCepAndFillAddress,
    submitPatient,
    removePatient,
  };
}
