import { useState } from "react";
import { getPatientHistory, createRecord } from "../api";
import { parseLocalDate } from "../utils/dates";
import { gestationalAgeInfo, ageInMonths, getBaseAgeGroup, matchesPatientSearch } from "../utils/clinical";
import { initials, fmtDate } from "../utils/formatting";
import { VACCINE_OPTIONS } from "../config/constants";
import { printVaccineCard } from "../utils/printDoc";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import Avatar from "../components/ui/Avatar";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";

const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconSyringe = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M10 2l4 4-1.5 1.5-1-1-5 5 1 1L6 14l-4-4 1.5-1.5 1 1 5-5-1-1L10 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M2 14l2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M8 4v4l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const IconCheck = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
    <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconPending = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 5.5v2.5M8 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

// Cada entrada: { id, name, doses, ageGroup, ageMinMonths, ageMaxMonths, aliases, note? }
const PNI_CALENDAR = [
  // ── Ao nascer (0–1m)
  { id:"bcg",         name:"BCG",               doseLabel:"Ao nascer",      ageGroup:"Criança", ageMinMonths:0,  ageMaxMonths:1,   windowMin:0,  windowMax:1,  aliases:["bcg"] },
  { id:"hepb-rn",     name:"Hepatite B",         doseLabel:"Ao nascer",      ageGroup:"Criança", ageMinMonths:0,  ageMaxMonths:1,   windowMin:0,  windowMax:1,  aliases:["hepatite b","hepb"] },

  // ── 2 meses
  { id:"penta-1",     name:"Pentavalente D1",    doseLabel:"D1 (2m)",        ageGroup:"Criança", ageMinMonths:2,  ageMaxMonths:3,   windowMin:2,  windowMax:3,  aliases:["penta","pentavalente","dtp"] },
  { id:"vip-1",       name:"Polio (VIP) D1",     doseLabel:"D1 (2m)",        ageGroup:"Criança", ageMinMonths:2,  ageMaxMonths:3,   windowMin:2,  windowMax:3,  aliases:["vip","polio inativada","poliomielite","polio"] },
  { id:"pneumo-1",    name:"Pneumo 10 D1",        doseLabel:"D1 (2m)",        ageGroup:"Criança", ageMinMonths:2,  ageMaxMonths:3,   windowMin:2,  windowMax:3,  aliases:["pneumo 10","pneumococica 10","pneumo10","pneumococica"] },
  { id:"rota-1",      name:"Rotavírus D1",        doseLabel:"D1 (2m)",        ageGroup:"Criança", ageMinMonths:2,  ageMaxMonths:3,   windowMin:2,  windowMax:3,  aliases:["rota","rotavirus","vorh"] },

  // ── 3 meses
  { id:"meningo-1",   name:"Meningocócica C D1",  doseLabel:"D1 (3m)",        ageGroup:"Criança", ageMinMonths:3,  ageMaxMonths:4,   windowMin:3,  windowMax:4,  aliases:["meningo","meningococica c","meningococica"] },

  // ── 4 meses
  { id:"penta-2",     name:"Pentavalente D2",    doseLabel:"D2 (4m)",        ageGroup:"Criança", ageMinMonths:4,  ageMaxMonths:5,   windowMin:4,  windowMax:5,  aliases:["penta","pentavalente","dtp"] },
  { id:"vip-2",       name:"Polio (VIP) D2",     doseLabel:"D2 (4m)",        ageGroup:"Criança", ageMinMonths:4,  ageMaxMonths:5,   windowMin:4,  windowMax:5,  aliases:["vip","polio inativada","poliomielite","polio"] },
  { id:"pneumo-2",    name:"Pneumo 10 D2",        doseLabel:"D2 (4m)",        ageGroup:"Criança", ageMinMonths:4,  ageMaxMonths:5,   windowMin:4,  windowMax:5,  aliases:["pneumo 10","pneumococica 10","pneumo10","pneumococica"] },
  { id:"rota-2",      name:"Rotavírus D2",        doseLabel:"D2 (4m)",        ageGroup:"Criança", ageMinMonths:4,  ageMaxMonths:5,   windowMin:4,  windowMax:5,  aliases:["rota","rotavirus","vorh"] },

  // ── 5 meses
  { id:"meningo-2",   name:"Meningocócica C D2",  doseLabel:"D2 (5m)",        ageGroup:"Criança", ageMinMonths:5,  ageMaxMonths:6,   windowMin:5,  windowMax:6,  aliases:["meningo","meningococica c","meningococica"] },

  // ── 6 meses
  { id:"penta-3",     name:"Pentavalente D3",    doseLabel:"D3 (6m)",        ageGroup:"Criança", ageMinMonths:6,  ageMaxMonths:7,   windowMin:6,  windowMax:7,  aliases:["penta","pentavalente","dtp"] },
  { id:"vip-3",       name:"Polio (VIP) D3",     doseLabel:"D3 (6m)",        ageGroup:"Criança", ageMinMonths:6,  ageMaxMonths:7,   windowMin:6,  windowMax:7,  aliases:["vip","polio inativada","poliomielite","polio"] },
  { id:"influenza-1", name:"Influenza D1",        doseLabel:"D1 (6m)",        ageGroup:"Criança", ageMinMonths:6,  ageMaxMonths:7,   windowMin:6,  windowMax:7,  aliases:["influenza","gripe"] },
  { id:"covid-1",     name:"COVID-19 D1",         doseLabel:"D1 (6m)",        ageGroup:"Criança", ageMinMonths:6,  ageMaxMonths:7,   windowMin:6,  windowMax:7,  aliases:["covid","covid-19","pfizer baby"] },

  // ── 7 meses
  { id:"covid-2",     name:"COVID-19 D2",         doseLabel:"D2 (7m)",        ageGroup:"Criança", ageMinMonths:7,  ageMaxMonths:8,   windowMin:7,  windowMax:8,  aliases:["covid","covid-19","pfizer baby"] },

  // ── 9 meses
  { id:"covid-3",     name:"COVID-19 D3",         doseLabel:"D3 (9m)",        ageGroup:"Criança", ageMinMonths:9,  ageMaxMonths:10,  windowMin:9,  windowMax:10, aliases:["covid","covid-19","pfizer baby"] },
  { id:"fa-1",        name:"Febre Amarela D1",    doseLabel:"D1 (9m)",        ageGroup:"Criança", ageMinMonths:9,  ageMaxMonths:10,  windowMin:9,  windowMax:10, aliases:["febre amarela"] },

  // ── 12 meses
  { id:"pneumo-ref",  name:"Pneumo 10 Reforço",   doseLabel:"Reforço (12m)",  ageGroup:"Criança", ageMinMonths:12, ageMaxMonths:13,  windowMin:12, windowMax:13, aliases:["pneumo 10","pneumococica 10","pneumo10","pneumococica"] },
  { id:"meningo-acwy",name:"Meningocócica ACWY",  doseLabel:"Reforço (12m)",  ageGroup:"Criança", ageMinMonths:12, ageMaxMonths:13,  windowMin:12, windowMax:13, aliases:["acwy","meningococica acwy"] },
  { id:"scr-1",       name:"Tríplice Viral D1",   doseLabel:"D1 (12m)",       ageGroup:"Criança", ageMinMonths:12, ageMaxMonths:13,  windowMin:12, windowMax:13, aliases:["triplice viral","src","scr","sarampo caxumba rubeola"] },

  // ── 15 meses
  { id:"dtp-1r",      name:"DTP 1º Reforço",      doseLabel:"1º Ref (15m)",   ageGroup:"Criança", ageMinMonths:15, ageMaxMonths:18,  windowMin:15, windowMax:18, aliases:["dtp","triple bacteriana"] },
  { id:"vip-ref",     name:"Polio (VIP) Reforço", doseLabel:"Reforço (15m)",  ageGroup:"Criança", ageMinMonths:15, ageMaxMonths:18,  windowMin:15, windowMax:18, aliases:["vip","polio inativada","poliomielite","polio"] },
  { id:"scrv",        name:"Tríplice Viral D2",    doseLabel:"D2 (15m)",       ageGroup:"Criança", ageMinMonths:15, ageMaxMonths:18,  windowMin:15, windowMax:18, aliases:["triplice viral","src","scr","sarampo caxumba rubeola","tetra viral","scrv"] },
  { id:"varicela-1",  name:"Varicela D1",          doseLabel:"D1 (15m)",       ageGroup:"Criança", ageMinMonths:15, ageMaxMonths:18,  windowMin:15, windowMax:18, aliases:["varicela","catapora"] },
  { id:"hepa-c",      name:"Hepatite A",           doseLabel:"Dose única (15m)",ageGroup:"Criança", ageMinMonths:15, ageMaxMonths:18,  windowMin:15, windowMax:18, aliases:["hepatite a","hepa"] },

  // ── 4 anos
  { id:"dtp-2r",      name:"DTP 2º Reforço",      doseLabel:"2º Ref (4a)",    ageGroup:"Criança", ageMinMonths:48, ageMaxMonths:60,  windowMin:48, windowMax:60, aliases:["dtp reforco","dtp 2","triple bacteriana","dtp"] },
  { id:"varicela-2",  name:"Varicela D2",          doseLabel:"D2 (4a)",        ageGroup:"Criança", ageMinMonths:48, ageMaxMonths:60,  windowMin:48, windowMax:60, aliases:["varicela","catapora"] },

  // ── Adolescente (9–19 anos)
  { id:"hpv",              name:"HPV Quadrivalente",    doseLabel:"Dose única (9–14a)", ageGroup:"Adolescente", ageMinMonths:108, ageMaxMonths:180, windowMin:108, windowMax:180, aliases:["hpv","papilomavirus"] },
  { id:"meningo-acwy-adol",name:"Meningocócica ACWY",   doseLabel:"Dose única (11–14a)",ageGroup:"Adolescente", ageMinMonths:132, ageMaxMonths:168, windowMin:132, windowMax:168, aliases:["acwy","meningococica acwy"] },

  // ── Adulto (20–59 anos)
  { id:"hepb-a",  name:"Hepatite B",        doseLabel:"3 doses",              ageGroup:"Adulto",  ageMinMonths:240, ageMaxMonths:719, windowMin:240, windowMax:719, aliases:["hepatite b","hepb"] },
  { id:"dt-a",    name:"Dupla Adulto (dT)", doseLabel:"3 doses ou reforço",   ageGroup:"Adulto",  ageMinMonths:240, ageMaxMonths:719, windowMin:240, windowMax:719, aliases:["dt","dupla adulto","difteria tetano"] },
  { id:"fa-a",    name:"Febre Amarela",     doseLabel:"Dose única",           ageGroup:"Adulto",  ageMinMonths:240, ageMaxMonths:719, windowMin:240, windowMax:719, aliases:["febre amarela"] },
  { id:"scr-a",   name:"Tríplice Viral",    doseLabel:"2 doses/1 dose",       ageGroup:"Adulto",  ageMinMonths:240, ageMaxMonths:719, windowMin:240, windowMax:719, aliases:["triplice viral","scr","src"] },

  // ── Gestante
  { id:"hepb-g",     name:"Hepatite B",  doseLabel:"3 doses",   ageGroup:"Gestante", ageMinMonths:0, ageMaxMonths:999, windowMin:0, windowMax:999, aliases:["hepatite b","hepb"] },
  { id:"dt-g",       name:"dT / dTpa",   doseLabel:"Reforço",   ageGroup:"Gestante", ageMinMonths:0, ageMaxMonths:999, windowMin:0, windowMax:999, aliases:["dt","dtpa","difteria tetano","dTpa"] },
  { id:"influenza-g",name:"Influenza",   doseLabel:"1/gestação",ageGroup:"Gestante", ageMinMonths:0, ageMaxMonths:999, windowMin:0, windowMax:999, aliases:["influenza","gripe"] },
  { id:"covid-g",    name:"COVID-19",    doseLabel:"1/gestação",ageGroup:"Gestante", ageMinMonths:0, ageMaxMonths:999, windowMin:0, windowMax:999, aliases:["covid","covid-19"] },

  // ── Idoso (60+)
  { id:"hepb-i",     name:"Hepatite B",        doseLabel:"3 doses",     ageGroup:"Idoso", ageMinMonths:720, ageMaxMonths:null, windowMin:720, windowMax:9999, aliases:["hepatite b","hepb"] },
  { id:"dt-i",       name:"Dupla Adulto (dT)", doseLabel:"Reforço",     ageGroup:"Idoso", ageMinMonths:720, ageMaxMonths:null, windowMin:720, windowMax:9999, aliases:["dt","dupla adulto","difteria tetano"] },
  { id:"influenza-i",name:"Influenza",         doseLabel:"1 dose anual",ageGroup:"Idoso", ageMinMonths:720, ageMaxMonths:null, windowMin:720, windowMax:9999, aliases:["influenza","gripe"] },
  { id:"covid-i",    name:"COVID-19",           doseLabel:"Reforços",    ageGroup:"Idoso", ageMinMonths:720, ageMaxMonths:null, windowMin:720, windowMax:9999, aliases:["covid","covid-19"] },
];

const ROSA_INDICATOR_IDS = new Set([
  "bcg", "hepb-rn",
  "penta-1","vip-1","rota-1","pneumo-1",
  "meningo-1",
  "penta-2","vip-2","rota-2","pneumo-2",
  "meningo-2",
  "penta-3","vip-3",
  "fa-1",
  "pneumo-ref","scr-1",
  "dtp-1r","vip-ref","scrv",
]);

function vgClass(group) {
  const map = { "Criança":"crianca", "Adolescente":"adolescente", "Adulto":"adulto", "Gestante":"gestante", "Idoso":"idoso" };
  return map[group] || "adulto";
}

function getConditionGroup(careCategory) {
  const c = String(careCategory || "").toLowerCase();
  if (c === "pregnant") return "Gestante";
  return null;
}

function getAgeGroup(ageMonths, careCategory) {
  const cond = getConditionGroup(careCategory);
  if (cond) return cond;
  return getBaseAgeGroup(ageMonths);
}

function getAllLifetimeVaccines(ageMonths) {
  const base = getBaseAgeGroup(ageMonths);
  const order = ["Criança","Adolescente","Adulto","Idoso"];
  const idx = order.indexOf(base);
  const groupsToShow = [];
  for (let i = 0; i <= idx; i++) groupsToShow.push(order[i]);
  return PNI_CALENDAR.filter(v => groupsToShow.includes(v.ageGroup) && v.ageGroup !== "Gestante");
}

function getConditionVaccines(careCategory) {
  const cond = getConditionGroup(careCategory);
  if (!cond) return [];
  return PNI_CALENDAR.filter(v => v.ageGroup === cond);
}

export function getRosaIndicatorVaccines() {
  return PNI_CALENDAR.filter(v => ROSA_INDICATOR_IDS.has(v.id));
}

export function getRosaGestanteVaccines(gestWeeks) {
  if (gestWeeks === null || gestWeeks < 20) return [];
  return PNI_CALENDAR.filter(v => v.id === "dt-g");
}

export function getRosaIdosoVaccines() {
  return PNI_CALENDAR.filter(v => v.id === "influenza-i");
}

export function getRosaHpvVaccines(ageMonths, sex) {
  const isFemale = String(sex || "").toLowerCase().includes("f");
  if (!isFemale || ageMonths < 108 || ageMonths > 168) return [];
  return PNI_CALENDAR.filter(v => v.id === "hpv");
}

function vaccineApplied(vaccine, appliedList, birthDate) {
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g," ").replace(/\s+/g," ").trim();
  return appliedList.some(a => {
    // Exact name match: covers explicit registrations including catch-up doses
    if (norm(a.title) === norm(vaccine.name)) return true;
    const nameMatch = vaccine.aliases.some(alias => norm(a.title).includes(norm(alias)));
    if (!nameMatch) return false;
    if (vaccine.ageGroup !== "Criança" || !birthDate || !a.date) return true;
    const birth = parseLocalDate(birthDate);
    const applied = parseLocalDate(a.date);
    if (isNaN(birth.getTime()) || isNaN(applied.getTime())) return true;
    const appliedAgeMonths = (applied - birth) / (1000 * 60 * 60 * 24 * 30.44);
    const wMin = vaccine.windowMin ?? 0;
    const wMax = vaccine.windowMax ?? 9999;
    return appliedAgeMonths >= (wMin - 1) && appliedAgeMonths <= (wMax + 1);
  });
}

function inferVaccineDoseTitle(genericName, applicationDate, birthDate) {
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g," ").replace(/\s+/g," ").trim();
  const normName = norm(genericName);
  if (!applicationDate || !birthDate) return genericName;
  const birth = parseLocalDate(birthDate);
  const applied = parseLocalDate(applicationDate);
  if (isNaN(birth.getTime()) || isNaN(applied.getTime())) return genericName;
  const appliedAgeMonths = (applied - birth) / (1000 * 60 * 60 * 24 * 30.44);
  const candidates = PNI_CALENDAR.filter(v =>
    v.ageGroup === "Criança" &&
    v.aliases.some(alias => normName.includes(norm(alias)) || norm(alias).includes(normName)) &&
    appliedAgeMonths >= (v.windowMin - 1) &&
    appliedAgeMonths <= ((v.windowMax ?? 9999) + 1)
  );
  if (!candidates.length) return genericName;
  candidates.sort((a, b) => {
    const midA = (a.windowMin + (a.windowMax ?? a.windowMin)) / 2;
    const midB = (b.windowMin + (b.windowMax ?? b.windowMin)) / 2;
    return Math.abs(appliedAgeMonths - midA) - Math.abs(appliedAgeMonths - midB);
  });
  return `${candidates[0].name} — ${candidates[0].doseLabel}`;
}

const AGE_RANGE_LABEL = { "Criança":"0–9a", "Adolescente":"10–19a", "Adulto":"20–59a", "Idoso":"60+a" };

function VaccinesPage({ patients, users, templates, token, canManageUser, user }) {
  const [search, setSearch]         = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [card, setCard]             = useState(null);
  const [applying, setApplying]     = useState(false);
  const [applyForm, setApplyForm]   = useState({ vaccine:"", date:"", appliedBy:"", details:"" });
  const [applyError, setApplyError] = useState("");
  const [applyBusy, setApplyBusy]   = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedId) || null;

  async function openPatient(p) {
    if (selectedId === p.id) { setSelectedId(null); setCard(null); return; }
    setSelectedId(p.id);
    setCard({ history:[], loading:true });
    setApplying(false);
    setApplyError("");
    setApplyForm({ vaccine:"", date:"", appliedBy:"", details:"" });
    try {
      const data = await getPatientHistory(token, p.id);
      setCard({ history: Array.isArray(data) ? data : [], loading:false });
    } catch { setCard({ history:[], loading:false }); }
  }

  async function submitApply(e) {
    e.preventDefault();
    if (!applyForm.vaccine || !applyForm.date) { setApplyError("Vacina e data são obrigatórios."); return; }
    setApplyBusy(true); setApplyError("");
    try {
      const detailsParts = [
        applyForm.appliedBy ? `Aplicado por: ${applyForm.appliedBy}` : "",
        applyForm.details,
      ].filter(Boolean);
      await createRecord(token, selectedId, { type:"vaccine", title:applyForm.vaccine, date:applyForm.date, details:detailsParts.join(" — ") });
      const data2 = await getPatientHistory(token, selectedId);
      setCard({ history: Array.isArray(data2) ? data2 : [], loading:false });
      setApplying(false);
      setApplyForm({ vaccine:"", date:"", appliedBy:"", details:"" });
    } catch(err) { setApplyError(err.message); }
    finally { setApplyBusy(false); }
  }

  const appliedList = (card?.history || []).filter(h => String(h.type || "").toLowerCase() === "vaccine");
  const isEquipeRosa = String(user?.teamId || user?.teamName || "").toLowerCase().includes("rosa");

  let ageMonths = null, ageGroup = "Adulto", lifeVaccines = [], condVaccines = [];
  if (selectedPatient) {
    ageMonths = ageInMonths(selectedPatient.birthDate);
    ageGroup  = getAgeGroup(ageMonths, selectedPatient.careCategory);

    if (isEquipeRosa) {
      const cat       = String(selectedPatient.careCategory || "").toLowerCase();
      const isCrianca = ageMonths !== null && ageMonths < 120;
      const isIdoso   = ageMonths !== null && ageMonths >= 720;
      const isAdolesc = ageMonths !== null && ageMonths >= 108 && ageMonths < 240;
      const isGestante = cat === "pregnant";

      if (isGestante) {
        const gi = gestationalAgeInfo(selectedPatient);
        lifeVaccines = getRosaGestanteVaccines(gi ? gi.weeks : null);
        condVaccines = [];
      } else if (isCrianca) {
        lifeVaccines = getRosaIndicatorVaccines();
        condVaccines = [];
      } else if (isIdoso) {
        lifeVaccines = getRosaIdosoVaccines();
        condVaccines = [];
      } else if (isAdolesc) {
        lifeVaccines = getRosaHpvVaccines(ageMonths, selectedPatient.sex);
        condVaccines = [];
      } else {
        lifeVaccines = getAllLifetimeVaccines(ageMonths);
        condVaccines = getConditionVaccines(selectedPatient.careCategory);
      }
    } else {
      lifeVaccines = getAllLifetimeVaccines(ageMonths);
      condVaccines = getConditionVaccines(selectedPatient.careCategory);
    }
  }

  const lifePending  = lifeVaccines.filter(v => !vaccineApplied(v, appliedList, selectedPatient?.birthDate));
  const lifeDone     = lifeVaccines.filter(v =>  vaccineApplied(v, appliedList, selectedPatient?.birthDate));
  const condPending  = condVaccines.filter(v => !vaccineApplied(v, appliedList, selectedPatient?.birthDate));
  const condDone     = condVaccines.filter(v =>  vaccineApplied(v, appliedList, selectedPatient?.birthDate));
  const totalPending = lifePending.length + condPending.length;

  const rosaGestantePrecoce = isEquipeRosa &&
    selectedPatient &&
    String(selectedPatient.careCategory || "").toLowerCase() === "pregnant" &&
    lifeVaccines.length === 0;

  const filtered = patients
    .filter(p => !search.trim() || matchesPatientSearch(p, search))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g," ").trim();

  function printCard() {
    const allVaccines = [...lifeVaccines, ...condVaccines];
    const vaccineRows = allVaccines.map(v => {
      const applied = vaccineApplied(v, appliedList, selectedPatient?.birthDate);
      const records = appliedList.filter(a =>
        v.aliases.some(alias => norm(a.title).includes(norm(alias)))
      ).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const last = records[0];
      const by = last
        ? (String(last.details || "").match(/Aplicado por: ([^—\n]+)/)?.[1]?.trim() || null)
        : null;
      return { name: v.name, doseLabel: v.doseLabel, ageGroup: v.ageGroup, applied, date: last?.date ? fmtDate(last.date) : null, by };
    });
    const extraApplied = appliedList.filter(a =>
      !PNI_CALENDAR.some(v => v.aliases.some(alias => norm(a.title).includes(norm(alias))))
    );
    printVaccineCard({ patient: selectedPatient, vaccineRows, extraApplied });
  }

  function VaccRow({ v, applied, cond }) {
    const records = appliedList.filter(a =>
      v.aliases.some(alias => norm(a.title).includes(norm(alias)))
    ).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const last = records[0];
    const who = last
      ? (String(last.details || "").match(/Aplicado por: ([^—\n]+)/)?.[1]?.trim()
         || users.find(u => u.id === last.createdBy)?.name || null)
      : null;

    const rowClass = applied ? "vacc-row vacc-row--done" : cond ? "vacc-row vacc-row--cond" : "vacc-row";

    return (
      <div className={rowClass}>
        <div className="vacc-row__left">
          <div className="vacc-row__icon-wrap">
            {applied ? <IconCheck /> : <IconPending />}
          </div>
          <div>
            <div className="vacc-row__name">{v.name}</div>
            <div className="vacc-row__dose">{v.doseLabel}</div>
          </div>
        </div>
        <div className="vacc-row__right">
          {applied && last?.date ? (
            <div className="vacc-row__date">
              <span className="vacc-row__date-pill">{fmtDate(last.date)}</span>
              {who && <span className="vacc-row__date-by">por {who}</span>}
            </div>
          ) : (
            <span className="vacc-row__pending-pill">Não aplicada</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="vaccines-page">
      <PageHeader
        eyebrow="Calendário Nacional de Vacinação"
        title="Carteira de Vacinas"
        subtitle="Indicações baseadas no Calendário Nacional de Vacinação — Ministério da Saúde (PNI)."
      />

      <div className="vaccines-layout">

        {/* ── Patient list ── */}
        <div className="vacc-panel">
          <div className="card card--noPad overflow-hidden">
            <div className="vacc-panel__search">
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar paciente..." />
            </div>
            <div className="vacc-panel__list">
              {!filtered.length
                ? <p className="vacc-panel__empty">Nenhum paciente.</p>
                : filtered.map(p => {
                    const isOpen = selectedId === p.id;
                    const am = ageInMonths(p.birthDate);
                    const ag = getAgeGroup(am, p.careCategory);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`vacc-pat${isOpen ? " is-active" : ""}`}
                        onClick={() => openPatient(p)}
                      >
                        <Avatar name={p.name} size="sm" />
                        <div className="vacc-pat__copy">
                          <div className="vacc-pat__name">{p.name}</div>
                          <div className="vacc-pat__meta">
                            <span className={`vg-badge vg-badge--${vgClass(ag)}`}>{ag}</span>
                            {am !== null && (
                              <span className="vacc-pat__age">
                                {am < 24 ? `${am}m` : `${Math.floor(am / 12)}a`}
                              </span>
                            )}
                          </div>
                        </div>
                        <svg className="vacc-pat__chevron" width="11" height="11" viewBox="0 0 16 16" fill="none">
                          <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    );
                  })
              }
            </div>
          </div>
        </div>

        {/* ── Vaccine card ── */}
        <div className="vacc-main">
          {!selectedPatient ? (
            <div className="vacc-empty">
              <svg className="vacc-empty__icon" width="52" height="52" viewBox="0 0 16 16" fill="none">
                <path d="M10 2l4 4-1.5 1.5-1-1-5 5 1 1L6 14l-4-4 1.5-1.5 1 1 5-5-1-1L10 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M2 14l2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <p className="vacc-empty__label">Selecione um paciente para ver a carteira de vacinas.</p>
            </div>
          ) : (
            <div className="card card--noPad overflow-hidden">

              {/* Card header */}
              <div className="vacc-card-head">
                <div className="vacc-card-head__info">
                  <Avatar name={selectedPatient.name} />
                  <div>
                    <div className="vacc-card-head__name">{selectedPatient.name}</div>
                    <div className="vacc-card-head__meta">
                      {selectedPatient.birthDate && (
                        <span className="vacc-card-head__birthdate">Nasc. {fmtDate(selectedPatient.birthDate)}</span>
                      )}
                      <span className={`vg-badge vg-badge--${vgClass(ageGroup)}`}>
                        {ageGroup}{ageMonths !== null ? ` · ${ageMonths < 24 ? `${ageMonths}m` : `${Math.floor(ageMonths / 12)}a`}` : ""}
                      </span>
                      <span className={`vacc-status${totalPending ? "" : " vacc-status--ok"}`}>
                        {totalPending ? `${totalPending} pendente${totalPending > 1 ? "s" : ""}` : "Em dia"}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"var(--s-2)" }}>
                  <Button variant="ghost" size="sm" onClick={printCard}>Imprimir carteira</Button>
                  {canManageUser && (
                    <Button
                      variant={applying ? "ghost" : "primary"}
                      size="sm"
                      onClick={() => setApplying(v => !v)}
                    >
                      {applying ? "Cancelar" : "Registrar vacina"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Apply form */}
              {applying && (
                <div className="vacc-apply-zone">
                  <p className="vacc-apply-zone__title">Registrar aplicação</p>
                  <form onSubmit={submitApply} className="field-grid field-grid--no-pad">
                    <Select
                      label="Vacina"
                      value={applyForm.vaccine}
                      onChange={e => setApplyForm(s => ({ ...s, vaccine: e.target.value }))}
                    >
                      <option value="">Selecionar...</option>
                      {lifePending.length > 0 && (
                        <optgroup label="── Pendentes (calendário) ──">
                          {lifePending.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </optgroup>
                      )}
                      {condPending.length > 0 && (
                        <optgroup label="── Pendentes (condição) ──">
                          {condPending.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                        </optgroup>
                      )}
                      <optgroup label="── Todas as vacinas ──">
                        {VACCINE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                      </optgroup>
                    </Select>
                    <Input
                      label="Data de aplicação"
                      type="date"
                      value={applyForm.date}
                      onChange={e => setApplyForm(s => ({ ...s, date: e.target.value }))}
                    />
                    <Input
                      label="Aplicado por (opcional)"
                      placeholder="Profissional"
                      value={applyForm.appliedBy}
                      onChange={e => setApplyForm(s => ({ ...s, appliedBy: e.target.value }))}
                    />
                    <Input
                      label="Obs. (lote, fabricante...)"
                      placeholder="Opcional"
                      value={applyForm.details}
                      onChange={e => setApplyForm(s => ({ ...s, details: e.target.value }))}
                    />
                    {applyError && <p className="error field--span-2">{applyError}</p>}
                    <div className="field--span-2">
                      <Button type="submit" disabled={applyBusy}>
                        {applyBusy ? "Salvando..." : "Registrar"}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Loading */}
              {card?.loading ? (
                <p className="vacc-loading">Carregando...</p>
              ) : (
                <div className="vacc-body">

                  {/* Rosa precoce notice */}
                  {rosaGestantePrecoce && (
                    <div className="vacc-notice">
                      <span className="vacc-notice__icon" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M12 8c-2 0-4 1.5-4 4 0 1.5.5 3.5 1 5h6c.5-1.5 1-3.5 1-5 0-2.5-2-4-4-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                      </span>
                      <div>
                        <div className="vacc-notice__title">dTpa — aguardando 20ª semana</div>
                        <div>O indicador da Equipe Rosa prevê apenas a vacina dTpa para gestantes, a partir da 20ª semana de gestação. Registre a IG da paciente para liberar o indicador.</div>
                      </div>
                    </div>
                  )}

                  {/* No data */}
                  {!rosaGestantePrecoce && lifeVaccines.length === 0 && condVaccines.length === 0 && (
                    <p className="vacc-no-data">
                      {selectedPatient.birthDate
                        ? "Nenhuma vacina indicada no calendário PNI para esta faixa."
                        : "Cadastre a data de nascimento para ver as vacinas indicadas."}
                    </p>
                  )}

                  {/* ── Calendário base ── */}
                  {lifeVaccines.length > 0 && (() => {
                    const groups = ["Criança","Adolescente","Adulto","Idoso"].filter(g =>
                      lifeVaccines.some(v => v.ageGroup === g)
                    );
                    return (
                      <div>
                        <div className="vacc-section-head">
                          <IconSyringe />
                          <span className="vacc-section-head__title">Calendário vacinal</span>
                          <div className="vacc-section-head__legend">
                            {["Criança","Adolescente","Adulto","Idoso"].map(label => (
                              <span key={label} className={`vg-badge vg-badge--${vgClass(label)}`}>
                                {label} <span className="vg-badge__range">{AGE_RANGE_LABEL[label]}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        {groups.map(g => {
                          const gVaccines = lifeVaccines.filter(v => v.ageGroup === g);
                          return (
                            <div key={g} className="vacc-group">
                              <div className={`vacc-group__header vg-badge--${vgClass(g)}`}>
                                {g}
                                <span className="vacc-group__header-range">
                                  {AGE_RANGE_LABEL[g] || ""}
                                </span>
                              </div>
                              <div className="vacc-group__list">
                                {gVaccines.map(v => (
                                  <VaccRow
                                    key={v.id}
                                    v={v}
                                    applied={vaccineApplied(v, appliedList, selectedPatient?.birthDate)}
                                    cond={false}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* ── Vacinas por condição ── */}
                  {condVaccines.length > 0 && (() => {
                    const condGroup = getConditionGroup(selectedPatient.careCategory);
                    return (
                      <div className="vacc-cond-section">
                        <div className="vacc-cond-head">
                          <IconClock />
                          <span className="vacc-cond-head__title">Vacinas indicadas por condição —</span>
                          <span className={`vg-badge vg-badge--${vgClass(condGroup)}`}>{condGroup}</span>
                        </div>
                        <p className="vacc-cond-head__note">
                          Estas vacinas são indicadas especificamente em razão da condição atual do paciente e não fazem parte do calendário base por idade.
                        </p>
                        <div className="vacc-group__list">
                          {condVaccines.map(v => (
                            <VaccRow
                              key={v.id}
                              v={v}
                              applied={vaccineApplied(v, appliedList, selectedPatient?.birthDate)}
                              cond={true}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Outras aplicações (fora do PNI) ── */}
                  {(() => {
                    const extra = appliedList.filter(a =>
                      !PNI_CALENDAR.some(v => v.aliases.some(alias => norm(a.title).includes(norm(alias))))
                    );
                    if (!extra.length) return null;
                    return (
                      <div className="vacc-extra">
                        <p className="vacc-extra__title">Outras aplicações registradas</p>
                        <div className="vacc-extra__list">
                          {extra.map((a, i) => (
                            <div key={a.id || i} className="vacc-extra__row">
                              <span className="vacc-extra__name">{a.title}</span>
                              <span className="vacc-extra__date">{fmtDate(a.date)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export { VaccinesPage as default, inferVaccineDoseTitle, vaccineApplied };
