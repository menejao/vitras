import { v4 as uuidv4 } from "uuid";
import {
  canonicalRole,
  normalizeDemandType,
  councilTypeForRole,
  getCapabilitiesForUser,
  isBreakGlassSessionActive
} from "./helpers.js";

/* ── DB array guard ── */

function ensureArray(db, key) {
  if (!Array.isArray(db[key])) {
    db[key] = [];
  }
}

/* ── Protocol constants ── */

const DEFAULT_CARE_PROTOCOLS = {
  general: {
    category: "general",
    label: "Geral",
    targets: { visits: 2, consultations: 2, vaccines: 1 },
    deadlines: { visits: 0, consultations: 0, vaccines: 0 },
    vaccines: ["Influenza"]
  },
  pregnant: {
    category: "pregnant",
    label: "Gestante",
    targets: { visits: 3, consultations: 7, vaccines: 4 },
    deadlines: { visits: 0, consultations: 0, vaccines: 0 },
    vaccines: ["dTpa", "Influenza", "COVID-19", "Hepatite B"]
  },
  puerperal: {
    category: "puerperal",
    label: "Puérpera",
    targets: { visits: 1, consultations: 1, vaccines: 0 },
    deadlines: { visits: 0, consultations: 0, vaccines: 0 },
    vaccines: []
  },
  child_followup: {
    category: "child_followup",
    label: "Puericultura",
    targets: { visits: 2, consultations: 10, vaccines: 0 },
    deadlines: { visits: 0, consultations: 0, vaccines: 0 },
    vaccines: [
      "BCG", "Hepatite B", "Penta", "VIP", "Pneumo 10", "Rotavírus",
      "Meningocócica", "Influenza", "COVID", "Febre amarela", "ACWY",
      "Tríplice viral", "DTP", "Varicela", "Hepatite A"
    ]
  },
  chronic: {
    category: "chronic",
    label: "Condição Crônica",
    targets: { visits: 3, consultations: 3, vaccines: 2 },
    deadlines: { visits: 0, consultations: 0, vaccines: 0 },
    vaccines: ["Influenza", "COVID-19"]
  },
  elderly: {
    category: "elderly",
    label: "Pessoa Idosa",
    targets: { visits: 2, consultations: 1, vaccines: 1 },
    deadlines: { visits: 0, consultations: 0, vaccines: 0 },
    vaccines: ["Influenza"]
  }
};

const DEFAULT_TEAM_COLORS = ["Rosa", "Azul", "Cinza", "Marrom", "Amarela"];
const DEMO_POPULATE_SIZE_COMPLETE = 50;
const DEMO_POPULATE_SIZE_INCOMPLETE = 10;

function normalizeUnitCnes(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (normalized === "CNES_PLACEHOLDER") return null;
  return /^\d{7}$/.test(normalized) ? normalized : null;
}

function buildDefaultProtocolTemplates() {
  const ministryRefs = {
    general: {
      reference: "https://bvsms.saude.gov.br/bvs/publicacoes/politica_nacional_atencao_basica_2017.pdf",
      version: "PNAB-2017"
    },
    pregnant: {
      reference: "https://bvsms.saude.gov.br/bvs/saudelegis/gm/2011/prt1459_24_06_2011.html",
      version: "Rede Cegonha"
    },
    puerperal: {
      reference: "https://bvsms.saude.gov.br/bvs/saudelegis/gm/2011/prt1459_24_06_2011.html",
      version: "Rede Cegonha"
    },
    child_followup: {
      reference: "https://www.gov.br/saude/pt-br/vacinacao/calendario",
      version: "Calendário PNI"
    },
    chronic: {
      reference:
        "https://bvsms.saude.gov.br/bvs/publicacoes/plano_acoes_estrategicas_enfrentamento_dc_nt_2021_2030.pdf",
      version: "DCNT 2021-2030"
    },
    elderly: {
      reference: "https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/saude-da-pessoa-idosa",
      version: "Cuidado da Pessoa Idosa"
    }
  };

  return Object.values(DEFAULT_CARE_PROTOCOLS).map((template) => ({
    category: template.category,
    label: template.label,
    targets: {
      visits: Number(template.targets?.visits || 0),
      consultations: Number(template.targets?.consultations || 0),
      vaccines: Number(template.targets?.vaccines || 0)
    },
    deadlines: {
      visits: Number(template.deadlines?.visits || 0),
      consultations: Number(template.deadlines?.consultations || 0),
      vaccines: Number(template.deadlines?.vaccines || 0)
    },
    vaccines: Array.isArray(template.vaccines) ? template.vaccines : [],
    authority: "Ministério da Saúde",
    reference: ministryRefs[template.category]?.reference || "",
    version: ministryRefs[template.category]?.version || "1.0"
  }));
}

/* ── Category normalization ── */

function normalizeCategory(value, templateMap = DEFAULT_CARE_PROTOCOLS) {
  if (!value) return "general";
  const next = String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (["pap_only", "somente_papanicolau"].includes(next)) return "general";
  if (next === "chronic") return "general";
  return templateMap[next] ? next : "general";
}

function normalizeChronicConditions(value) {
  const list = Array.isArray(value) ? value : [];
  const normalized = list
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => ["hypertension", "diabetes"].includes(item));
  return [...new Set(normalized)];
}

function normalizeLookupText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/* ── Catalog seed ── */

const CATALOG_SEED = [
  // Farmácia
  { code: "MED-0001", name: "Paracetamol 500mg", domain: "pharmacy", category: "Analgésico", unit: "comprimido", allowedUnits: ["comprimido", "cápsula"], controlsLote: false, controlsValidade: true, minQty: 100 },
  { code: "MED-0002", name: "Dipirona Sódica 500mg", domain: "pharmacy", category: "Analgésico", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 100 },
  { code: "MED-0003", name: "Ibuprofeno 600mg", domain: "pharmacy", category: "Anti-inflamatório", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "MED-0004", name: "Amoxicilina 500mg", domain: "pharmacy", category: "Antibiótico", unit: "cápsula", allowedUnits: ["cápsula", "comprimido"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "MED-0005", name: "Azitromicina 500mg", domain: "pharmacy", category: "Antibiótico", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 30 },
  { code: "MED-0006", name: "Enalapril 10mg", domain: "pharmacy", category: "Cardiovascular", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 100 },
  { code: "MED-0007", name: "Losartana Potássica 50mg", domain: "pharmacy", category: "Cardiovascular", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 100 },
  { code: "MED-0008", name: "Metformina 850mg", domain: "pharmacy", category: "Diabetes", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 100 },
  { code: "MED-0009", name: "Insulina NPH 100UI/mL", domain: "pharmacy", category: "Diabetes", unit: "frasco", allowedUnits: ["frasco"], controlsLote: true, controlsValidade: true, minQty: 10 },
  { code: "MED-0010", name: "Fluoxetina 20mg", domain: "pharmacy", category: "Saúde Mental", unit: "comprimido", allowedUnits: ["comprimido", "cápsula"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "MED-0011", name: "Salbutamol 100mcg Spray", domain: "pharmacy", category: "Respiratório", unit: "frasco", allowedUnits: ["frasco"], controlsLote: true, controlsValidade: true, minQty: 10 },
  { code: "MED-0012", name: "Sulfato Ferroso 40mg", domain: "pharmacy", category: "Gestante", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "MED-0013", name: "Ácido Fólico 5mg", domain: "pharmacy", category: "Gestante", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "MED-0014", name: "Omeprazol 20mg", domain: "pharmacy", category: "Gastrointestinal", unit: "cápsula", allowedUnits: ["cápsula"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "MED-0015", name: "Soro Fisiológico 0,9% 500mL", domain: "pharmacy", category: "Soro", unit: "bolsa", allowedUnits: ["bolsa", "frasco"], controlsLote: true, controlsValidade: true, minQty: 20 },
  { code: "MED-0016", name: "Captopril 25mg", domain: "pharmacy", category: "Cardiovascular", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "MED-0017", name: "Atenolol 50mg", domain: "pharmacy", category: "Cardiovascular", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "MED-0018", name: "Sinvastatina 20mg", domain: "pharmacy", category: "Cardiovascular", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "MED-0019", name: "Hidroclorotiazida 25mg", domain: "pharmacy", category: "Cardiovascular", unit: "comprimido", allowedUnits: ["comprimido"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "MED-0020", name: "Dexametasona 4mg", domain: "pharmacy", category: "Corticoide", unit: "ampola", allowedUnits: ["ampola", "comprimido"], controlsLote: true, controlsValidade: true, minQty: 20 },
  // Enfermagem
  { code: "ENF-0001", name: "Atadura de Crepe 6cm", domain: "nursing", category: "Curativo", unit: "unidade", allowedUnits: ["unidade", "caixa"], controlsLote: false, controlsValidade: false, minQty: 10 },
  { code: "ENF-0002", name: "Atadura de Crepe 10cm", domain: "nursing", category: "Curativo", unit: "unidade", allowedUnits: ["unidade", "caixa"], controlsLote: false, controlsValidade: false, minQty: 10 },
  { code: "ENF-0003", name: "Atadura de Crepe 15cm", domain: "nursing", category: "Curativo", unit: "unidade", allowedUnits: ["unidade", "caixa"], controlsLote: false, controlsValidade: false, minQty: 10 },
  { code: "ENF-0004", name: "Compressa de Gaze", domain: "nursing", category: "Curativo", unit: "unidade", allowedUnits: ["unidade", "caixa", "pacote"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "ENF-0005", name: "Clorexidina Degermante", domain: "nursing", category: "Antisséptico", unit: "frasco", allowedUnits: ["frasco"], controlsLote: true, controlsValidade: true, minQty: 2 },
  { code: "ENF-0006", name: "Luva de Procedimento P", domain: "nursing", category: "EPI", unit: "caixa", allowedUnits: ["caixa", "par"], controlsLote: false, controlsValidade: true, minQty: 1 },
  { code: "ENF-0007", name: "Luva de Procedimento M", domain: "nursing", category: "EPI", unit: "caixa", allowedUnits: ["caixa", "par"], controlsLote: false, controlsValidade: true, minQty: 1 },
  { code: "ENF-0008", name: "Luva de Procedimento G", domain: "nursing", category: "EPI", unit: "caixa", allowedUnits: ["caixa", "par"], controlsLote: false, controlsValidade: true, minQty: 1 },
  { code: "ENF-0009", name: "Seringa 20mL", domain: "nursing", category: "Seringa", unit: "unidade", allowedUnits: ["unidade", "caixa"], controlsLote: false, controlsValidade: true, minQty: 20 },
  { code: "ENF-0010", name: "Seringa 60mL", domain: "nursing", category: "Seringa", unit: "unidade", allowedUnits: ["unidade", "caixa"], controlsLote: false, controlsValidade: true, minQty: 10 },
  { code: "ENF-0011", name: "Micropore Pequeno", domain: "nursing", category: "Curativo", unit: "rolo", allowedUnits: ["rolo"], controlsLote: false, controlsValidade: false, minQty: 2 },
  { code: "ENF-0012", name: "Esparadrapo Impermeável P", domain: "nursing", category: "Curativo", unit: "rolo", allowedUnits: ["rolo"], controlsLote: false, controlsValidade: false, minQty: 2 },
  { code: "ENF-0013", name: "Tiras Reagentes Hemoanálise cx 50", domain: "nursing", category: "Diabetes", unit: "caixa", allowedUnits: ["caixa"], controlsLote: true, controlsValidade: true, minQty: 2 },
  { code: "ENF-0014", name: "Agulha para Caneta de Insulina", domain: "nursing", category: "Diabetes", unit: "unidade", allowedUnits: ["unidade", "caixa"], controlsLote: false, controlsValidade: true, minQty: 30 },
  { code: "ENF-0015", name: "Cloreto de Sódio 0,9% 500mL Curativo", domain: "nursing", category: "Soro/Curativo", unit: "frasco", allowedUnits: ["frasco"], controlsLote: true, controlsValidade: true, minQty: 5 },
  // Odontologia
  { code: "ODONT-0001", name: "Luva de Látex Tamanho M", domain: "dental", category: "EPI", unit: "par", allowedUnits: ["par", "caixa"], controlsLote: false, controlsValidade: true, minQty: 100 },
  { code: "ODONT-0002", name: "Máscara Cirúrgica", domain: "dental", category: "EPI", unit: "unidade", allowedUnits: ["unidade", "caixa"], controlsLote: false, controlsValidade: true, minQty: 200 },
  { code: "ODONT-0003", name: "Gorro Descartável", domain: "dental", category: "EPI", unit: "unidade", allowedUnits: ["unidade", "pacote"], controlsLote: false, controlsValidade: false, minQty: 100 },
  { code: "ODONT-0004", name: "Babador Descartável", domain: "dental", category: "Descartável", unit: "unidade", allowedUnits: ["unidade", "pacote"], controlsLote: false, controlsValidade: false, minQty: 100 },
  { code: "ODONT-0005", name: "Seringa Carpule", domain: "dental", category: "Anestesia", unit: "unidade", allowedUnits: ["unidade"], controlsLote: false, controlsValidade: false, minQty: 50 },
  { code: "ODONT-0006", name: "Agulha Curta Descartável", domain: "dental", category: "Anestesia", unit: "unidade", allowedUnits: ["unidade", "caixa"], controlsLote: false, controlsValidade: true, minQty: 50 },
  { code: "ODONT-0007", name: "Lidocaína 2% com Vasoconstritor", domain: "dental", category: "Anestesia", unit: "tubete", allowedUnits: ["tubete", "caixa"], controlsLote: true, controlsValidade: true, minQty: 20 },
  { code: "ODONT-0008", name: "Broca Alta Rotação Carbide", domain: "dental", category: "Instrumental", unit: "unidade", allowedUnits: ["unidade"], controlsLote: false, controlsValidade: false, minQty: 5 },
  { code: "ODONT-0009", name: "Resina Composta A2", domain: "dental", category: "Restauração", unit: "seringa", allowedUnits: ["seringa"], controlsLote: true, controlsValidade: true, minQty: 3 },
  { code: "ODONT-0010", name: "Ácido Fosfórico 37%", domain: "dental", category: "Restauração", unit: "bisnaga", allowedUnits: ["bisnaga"], controlsLote: true, controlsValidade: true, minQty: 2 },
  { code: "ODONT-0011", name: "Cimento de Ionômero de Vidro", domain: "dental", category: "Restauração", unit: "kit", allowedUnits: ["kit"], controlsLote: true, controlsValidade: true, minQty: 1 },
  { code: "ODONT-0012", name: "Algodão em Rolo", domain: "dental", category: "Descartável", unit: "pacote", allowedUnits: ["pacote"], controlsLote: false, controlsValidade: false, minQty: 5 },
  { code: "ODONT-0013", name: "Fio Dental", domain: "dental", category: "Higiene", unit: "rolo", allowedUnits: ["rolo", "caixa"], controlsLote: false, controlsValidade: false, minQty: 10 },
  { code: "ODONT-0014", name: "Gaze Estéril", domain: "dental", category: "Descartável", unit: "pacote", allowedUnits: ["pacote"], controlsLote: false, controlsValidade: true, minQty: 5 },
  { code: "ODONT-0015", name: "Sugador Descartável", domain: "dental", category: "Descartável", unit: "unidade", allowedUnits: ["unidade", "pacote"], controlsLote: false, controlsValidade: false, minQty: 50 },
];

function seedCatalog(db) {
  for (const item of CATALOG_SEED) {
    db.catalogItems.push({ ...item, active: true, obs: "" });
  }
}

/* ── DB shape enforcement ── */

function ensureDbShape(db) {
  ensureArray(db, "units");
  ensureArray(db, "teams");
  ensureArray(db, "users");
  // IAM-01: ensure new identity fields on all existing users
  db.users = db.users.map((u) => ({
    forcePasswordChange: false,
    passwordUpdatedAt: u.createdAt || null,
    temporaryPasswordIssuedAt: null,
    createdBySupport: false,
    createdByUserId: null,
    lastPasswordResetAt: null,
    passwordResetBy: null,
    ...u  // existing fields override defaults (preserves already-set values)
  }));
  ensureArray(db, "patients");
  ensureArray(db, "queueEntries");
  ensureArray(db, "agendaEntries");
  ensureArray(db, "referrals");
  ensureArray(db, "pharmacyStock");
  ensureArray(db, "pharmacyLogs");
  ensureArray(db, "suppliesStock");
  ensureArray(db, "suppliesLogs");
  ensureArray(db, "suppliesContinuous");
  ensureArray(db, "prescricoes");
  ensureArray(db, "dispensacoes");
  ensureArray(db, "dentalStock");
  ensureArray(db, "dentalLogs");
  ensureArray(db, "almoxRequisicoes");
  ensureArray(db, "catalogItems");
  if (!db.catalogItems.length) seedCatalog(db);
  ensureArray(db, "exams");
  ensureArray(db, "appointments");
  ensureArray(db, "tasks");
  ensureArray(db, "messages");
  ensureArray(db, "auditLogs");
  ensureArray(db, "auditLogChainAnchors");
  ensureArray(db, "auditPruneExports");
  ensureArray(db, "notifications");
  ensureArray(db, "familyGroups");
  ensureArray(db, "households");
  ensureArray(db, "acsVisits");
  ensureArray(db, "microAreas");
  ensureArray(db, "labIntegrations");
  ensureArray(db, "odontograms");
  ensureArray(db, "odontoProcedures");
  ensureArray(db, "dentalEncounters");
  ensureArray(db, "odontoPlanItems");
  ensureArray(db, "clinicalRecords");
  ensureArray(db, "protocolTemplates");
  ensureArray(db, "protocolTemplateVersions");
  ensureArray(db, "privacyRequests");
  ensureArray(db, "accessRequests");
  ensureArray(db, "registerVerifications");
  ensureArray(db, "loginChallenges");
  ensureArray(db, "refreshTokens");
  ensureArray(db, "exportHistory");

  if (!db.teams.length) {
    const defaultTeamId = "team-default";
    db.teams.push({
      id: defaultTeamId,
      name: "Equipe Enfermeira Ana",
      managerUserId: "u1",
      unitId: "unit-default",
      createdAt: new Date().toISOString()
    });
    db.users = db.users.map((u) => ({ ...u, teamId: u.teamId || defaultTeamId }));
  }

  // Ensure default unit exists (backward compat: existing deployments without units)
  if (!db.units.length) {
    // F4-06: CNES from deployment configuration — never hardcoded
    const defaultCnes = normalizeUnitCnes(process.env.DEFAULT_UNIT_CNES);
    db.units.push({
      id: "unit-default",
      name: "Unidade Padrão",
      cnes: defaultCnes,
      createdAt: new Date().toISOString()
    });
  }
  // Ensure all teams have unitId (assign default if missing — backward compat migration)
  db.units = db.units.map((unit) => ({
    ...unit,
    cnes: normalizeUnitCnes(unit.cnes)
  }));
  // F5-04: normalize legacy tipoEquipe values (EAP→EAPS, OUTRA→OUTROS)
  const TIPO_EQUIPE_LEGACY_MAP = { EAP: "EAPS", OUTRA: "OUTROS" };
  db.teams = db.teams.map((t) => {
    const normalized = t.tipoEquipe && TIPO_EQUIPE_LEGACY_MAP[t.tipoEquipe]
      ? { ...t, tipoEquipe: TIPO_EQUIPE_LEGACY_MAP[t.tipoEquipe] }
      : t;
    return normalized.unitId ? normalized : { ...normalized, unitId: "unit-default" };
  });
  // Ensure all users have unitId (derive from team or default — backward compat migration)
  db.users = db.users.map((u) => {
    if (u.unitId) return u;
    const team = db.teams.find((t) => t.id === u.teamId);
    return { ...u, unitId: team?.unitId || "unit-default" };
  });

  const byId = new Set(db.teams.map((t) => String(t.id || "").trim().toLowerCase()));
  const byName = new Set(db.teams.map((t) => String(t.name || "").trim().toLowerCase()));
  for (const color of DEFAULT_TEAM_COLORS) {
    const id = `team-${color.toLowerCase()}`;
    const name = `Equipe ${color}`;
    if (byId.has(id) || byName.has(name.toLowerCase())) continue;
    db.teams.push({ id, name, managerUserId: "", createdAt: new Date().toISOString() });
    byId.add(id);
    byName.add(name.toLowerCase());
  }

  if (!db.protocolTemplates.length) {
    db.protocolTemplates = buildDefaultProtocolTemplates();
  } else {
    const defaultTemplates = buildDefaultProtocolTemplates();
    const defaultsByCategory = Object.fromEntries(defaultTemplates.map((t) => [t.category, t]));
    const seenCategories = new Set();
    db.protocolTemplates = db.protocolTemplates
      .map((t) => {
        const category = normalizeCategory(t.category, DEFAULT_CARE_PROTOCOLS);
        return {
          ...t,
          category,
          label: defaultsByCategory[category]?.label || t.label || String(category || "Protocolo"),
          targets: {
            visits: Number(t.targets?.visits ?? defaultsByCategory[category]?.targets?.visits ?? 0),
            consultations: Number(
              t.targets?.consultations ?? defaultsByCategory[category]?.targets?.consultations ?? 0
            ),
            vaccines: Number(t.targets?.vaccines ?? defaultsByCategory[category]?.targets?.vaccines ?? 0)
          },
          deadlines: {
            visits: Number(t.deadlines?.visits ?? defaultsByCategory[category]?.deadlines?.visits ?? 0),
            consultations: Number(
              t.deadlines?.consultations ?? defaultsByCategory[category]?.deadlines?.consultations ?? 0
            ),
            vaccines: Number(t.deadlines?.vaccines ?? defaultsByCategory[category]?.deadlines?.vaccines ?? 0)
          },
          vaccines: Array.isArray(t.vaccines)
            ? t.vaccines
            : Array.isArray(defaultsByCategory[category]?.vaccines)
            ? defaultsByCategory[category].vaccines
            : [],
          authority: String(t.authority || "Ministério da Saúde"),
          reference: String(t.reference || defaultsByCategory[category]?.reference || ""),
          version: String(t.version || defaultsByCategory[category]?.version || "1.0")
        };
      })
      .filter((template) => {
        const key = `${String(template.teamId || "")}::${String(template.category || "")}`;
        if (seenCategories.has(key)) return false;
        seenCategories.add(key);
        return true;
      });

    const hasGlobalByCategory = new Set(
      db.protocolTemplates.filter((t) => !t.teamId).map((t) => String(t.category || ""))
    );
    for (const template of defaultTemplates) {
      if (hasGlobalByCategory.has(template.category)) continue;
      db.protocolTemplates.push({ ...template });
    }
  }

  db.patients = db.patients.map((p) => ({
    ...p,
    cpf: p.cpf ? String(p.cpf) : "",
    cns: p.cns ? String(p.cns) : "",

    careCategory: normalizeCategory(String(p.careCategory || "general")),
    incompleteProfile: Boolean(p.incompleteProfile),
    chronicConditions: normalizeChronicConditions(p.chronicConditions),
    motherName: p.motherName ? String(p.motherName) : "",
    phoneAlt: p.phoneAlt ? String(p.phoneAlt) : "",
    maritalStatus: p.maritalStatus ? String(p.maritalStatus) : "",
    sexAtBirth: p.sexAtBirth ? String(p.sexAtBirth) : "",
    genderIdentity: p.genderIdentity ? String(p.genderIdentity) : "",
    birthDate: p.birthDate ? String(p.birthDate) : "",
    pregnancyStartDate: p.pregnancyStartDate ? String(p.pregnancyStartDate) : "",
    expectedDeliveryDate: p.expectedDeliveryDate ? String(p.expectedDeliveryDate) : "",
    gestationalAgeDumWeeks: Number.isFinite(Number(p.gestationalAgeDumWeeks))
      ? Number(p.gestationalAgeDumWeeks)
      : "",
    gestationalAgeDumDays: Number.isFinite(Number(p.gestationalAgeDumDays))
      ? Number(p.gestationalAgeDumDays)
      : "",
    gestationalAgeUsgWeeks: Number.isFinite(Number(p.gestationalAgeUsgWeeks))
      ? Number(p.gestationalAgeUsgWeeks)
      : "",
    gestationalAgeUsgDays: Number.isFinite(Number(p.gestationalAgeUsgDays))
      ? Number(p.gestationalAgeUsgDays)
      : "",
    usgDate1: p.usgDate1 ? String(p.usgDate1) : "",
    usgDate2: p.usgDate2 ? String(p.usgDate2) : "",
    usgDate3: p.usgDate3 ? String(p.usgDate3) : "",
    prenatalStartDate: p.prenatalStartDate ? String(p.prenatalStartDate) : "",
    postpartumStartDate: p.postpartumStartDate ? String(p.postpartumStartDate) : ""
  }));

  db.clinicalRecords = db.clinicalRecords.map((record) => ({
    ...record,
    protocolTag: normalizeCategory(record?.protocolTag, DEFAULT_CARE_PROTOCOLS)
  }));

  db.protocolTemplateVersions = db.protocolTemplateVersions.map((item) => ({
    ...item,
    category: normalizeCategory(item?.category, DEFAULT_CARE_PROTOCOLS)
  }));

  db.appointments = db.appointments.map((a) => ({
    ...a,
    demandType: normalizeDemandType(a.demandType)
  }));

  db.users = db.users.map((u) => ({
    ...u,
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
    twoFactorSecret: String(u.twoFactorSecret || ""),
    twoFactorPendingSecret: String(u.twoFactorPendingSecret || ""),
    twoFactorPendingCreatedAt: String(u.twoFactorPendingCreatedAt || "")
  }));

  const now = Date.now();
  db.loginChallenges = db.loginChallenges
    .filter((item) => String(item.userId || "").trim())
    .filter((item) => {
      const exp = Date.parse(String(item.expiresAt || ""));
      if (!Number.isFinite(exp)) return false;
      return exp > now - 60 * 60 * 1000;
    })
    .map((item) => ({
      ...item,
      consumed: Boolean(item.consumed),
      attempts: Number.isFinite(Number(item.attempts)) ? Number(item.attempts) : 0
    }));
}

/* ── Team helpers ── */

function getTeamById(db, id) {
  return db.teams.find((t) => t.id === id);
}

function getTeamNameById(db, id) {
  return getTeamById(db, id)?.name || "Sem equipe";
}

/* ── User sanitization ── */

function sanitizeUser(user, db) {
  const {
    password: _password,
    twoFactorSecret: _twoFactorSecret,
    twoFactorPendingSecret: _twoFactorPendingSecret,
    ...safe
  } = user;
  const role = canonicalRole(safe.role);
  return {
    ...safe,
    role,
    twoFactorEnabled: Boolean(user?.twoFactorEnabled),
    councilType: safe.councilType || councilTypeForRole(role) || "",
    councilNumber: safe.councilNumber || "",
    councilUf: safe.councilUf || "",
    teamName: getTeamNameById(db, safe.teamId)
  };
}

function buildAccessContextUser(actorUser, db, options = {}) {
  const safeActor = sanitizeUser(actorUser, db);
  const scopeTeamId = String(options.scopeTeamId ?? safeActor.teamId ?? "").trim();
  const scopeTeamName = scopeTeamId ? getTeamNameById(db, scopeTeamId) : "";
  const capabilities = getCapabilitiesForUser(safeActor, {
    capabilities: options.capabilities,
    breakGlass: options.breakGlass
  });

  return {
    ...safeActor,
    teamId: scopeTeamId || safeActor.teamId || "",
    teamName: scopeTeamName || safeActor.teamName || "Sem equipe",
    unitId: String(safeActor?.unitId || ""),
    municipalityId: String(safeActor?.municipalityId || ""),
    capabilities,
    impersonation: options.impersonation ? {
      active: true,
      targetUserId: String(options.impersonation.targetUserId || ""),
      targetUserName: String(options.impersonation.targetUserName || ""),
      targetUserRole: canonicalRole(options.impersonation.targetUserRole || ""),
      targetTeamId: String(options.impersonation.targetTeamId || ""),
      targetTeamName: String(options.impersonation.targetTeamName || ""),
      reason: String(options.impersonation.reason || ""),
      startedAt: String(options.impersonation.startedAt || new Date().toISOString())
    } : null,
    breakGlass: options.breakGlass && isBreakGlassSessionActive(options.breakGlass) ? {
      active: true,
      reason: String(options.breakGlass.reason || ""),
      activatedAt: String(options.breakGlass.activatedAt || new Date().toISOString()),
      expiresAt: String(options.breakGlass.expiresAt || "")
    } : null
  };
}

/* ── Protocol template map ── */

function getProtocolTemplateMap(db, teamId = "") {
  ensureDbShape(db);
  const disabledByTeam = new Set(
    db.protocolTemplates
      .filter((t) => t.teamId === teamId && t.deleted)
      .map((t) => String(t.category || ""))
  );
  const map = {};
  const baseTemplates = db.protocolTemplates
    .filter((t) => !t.deleted && !t.teamId)
    .filter((t) => !disabledByTeam.has(String(t.category || "")));
  for (const item of baseTemplates) {
    map[String(item.category)] = item;
  }
  if (teamId) {
    const teamTemplates = db.protocolTemplates.filter((t) => !t.deleted && t.teamId === teamId);
    for (const item of teamTemplates) {
      map[String(item.category)] = item;
    }
  }
  if (!map.general) {
    const fallback = buildDefaultProtocolTemplates().find((t) => t.category === "general");
    if (fallback) map.general = fallback;
  }
  return map;
}

/* ── Protocol template payload sanitization ── */

function sanitizeProtocolTemplatePayload(payload, fallbackCategory = "") {
  const rawCategory = String(payload.category || fallbackCategory || "").trim().toLowerCase();
  const category = normalizeCategory(rawCategory.replace(/[^a-z0-9_]/g, "_"), DEFAULT_CARE_PROTOCOLS);
  const label = String(payload.label || "").trim();
  const targets = payload.targets && typeof payload.targets === "object" ? payload.targets : {};
  const deadlines = payload.deadlines && typeof payload.deadlines === "object" ? payload.deadlines : {};
  const visits = Number(targets.visits);
  const consultations = Number(targets.consultations);
  const vaccinesTarget = Number(targets.vaccines);
  const deadlineVisits = Number(deadlines.visits);
  const deadlineConsultations = Number(deadlines.consultations);
  const deadlineVaccines = Number(deadlines.vaccines);
  const vaccines = Array.isArray(payload.vaccines)
    ? payload.vaccines
    : String(payload.vaccines || "").split(",");
  const authority = String(payload.authority || "Ministério da Saúde").trim();
  const reference = String(payload.reference || "").trim();
  const version = String(payload.version || "").trim();
  const cleanVaccines = [...new Set(vaccines.map((v) => String(v || "").trim()).filter(Boolean))];

  if (!category || category.length < 2) {
    return { ok: false, error: "category inválida (use letras, numeros e _)" };
  }
  if (!label) {
    return { ok: false, error: "label é obrigatório" };
  }

  for (const [key, value] of [
    ["visits", visits],
    ["consultations", consultations],
    ["vaccines", vaccinesTarget]
  ]) {
    if (!Number.isFinite(value) || value < 0 || value > 99) {
      return { ok: false, error: `targets.${key} deve ser número entre 0 e 99` };
    }
  }

  for (const [key, value] of [
    ["visits", deadlineVisits],
    ["consultations", deadlineConsultations],
    ["vaccines", deadlineVaccines]
  ]) {
    if (!Number.isFinite(value) || value < 0 || value > 3650) {
      return { ok: false, error: `deadlines.${key} deve ser número entre 0 e 3650 dias` };
    }
  }

  return {
    ok: true,
    template: {
      category,
      label,
      targets: {
        visits: Math.floor(visits),
        consultations: Math.floor(consultations),
        vaccines: Math.floor(vaccinesTarget)
      },
      deadlines: {
        visits: Math.floor(deadlineVisits),
        consultations: Math.floor(deadlineConsultations),
        vaccines: Math.floor(deadlineVaccines)
      },
      vaccines: cleanVaccines,
      authority,
      reference,
      version
    }
  };
}

/* ── Protocol template version snapshot ── */

function snapshotProtocolTemplateVersion(db, actorUser, action, template) {
  ensureArray(db, "protocolTemplateVersions");
  db.protocolTemplateVersions.push({
    id: uuidv4(),
    category: String(template?.category || ""),
    teamId: String(template?.teamId || ""),
    action,
    actorUserId: actorUser?.id || "",
    actorUserName: actorUser?.name || "",
    actorRole: canonicalRole(actorUser?.role || ""),
    payload: template || {},
    createdAt: new Date().toISOString()
  });
}

/**
 * ITEM 7: Validate inputs for unit bootstrap operation.
 * Checks: unitId uniqueness, gestorUserId exists with correct role and no conflicting unitId.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUnitBootstrap(db, { unitId, unitName, gestorUserId }) {
  const cleanUnitId = String(unitId || "").trim();
  const cleanUnitName = String(unitName || "").trim();
  const cleanGestorId = String(gestorUserId || "").trim();

  if (!cleanUnitId || cleanUnitId.length > 50) {
    return { valid: false, error: "unitId inválido (máximo 50 caracteres)" };
  }
  if (!cleanUnitName || cleanUnitName.length > 200) {
    return { valid: false, error: "unitName inválido (máximo 200 caracteres)" };
  }
  if (!cleanGestorId) {
    return { valid: false, error: "gestorUserId obrigatório" };
  }

  // unitId must not already exist
  const existingUnit = (db.units || []).find((u) => String(u.id || "") === cleanUnitId);
  if (existingUnit) {
    return { valid: false, error: `unitId '${cleanUnitId}' já existe`, conflict: "unit_exists" };
  }

  // gestorUserId must exist
  const gestor = (db.users || []).find((u) => String(u.id || "") === cleanGestorId);
  if (!gestor) {
    return { valid: false, error: `Usuário '${cleanGestorId}' não encontrado` };
  }

  // gestorUserId must have role "gestor"
  const role = canonicalRole(gestor.role);
  if (role !== "gestor") {
    return { valid: false, error: `Usuário '${cleanGestorId}' não tem role 'gestor' (role atual: ${role})` };
  }

  // gestorUserId must not already be assigned to a DIFFERENT unit
  if (gestor.unitId && gestor.unitId !== cleanUnitId && gestor.unitId !== "unit-default") {
    return { valid: false, error: `Gestor '${cleanGestorId}' já está associado a outra unidade: ${gestor.unitId}` };
  }

  return { valid: true };
}

export {
  ensureArray,
  DEFAULT_CARE_PROTOCOLS,
  DEFAULT_TEAM_COLORS,
  DEMO_POPULATE_SIZE_COMPLETE,
  DEMO_POPULATE_SIZE_INCOMPLETE,
  buildDefaultProtocolTemplates,
  normalizeCategory,
  normalizeChronicConditions,
  ensureDbShape,
  getTeamById,
  getTeamNameById,
  sanitizeUser,
  buildAccessContextUser,
  getProtocolTemplateMap,
  sanitizeProtocolTemplatePayload,
  snapshotProtocolTemplateVersion,
  validateUnitBootstrap,
  normalizeUnitCnes
};
