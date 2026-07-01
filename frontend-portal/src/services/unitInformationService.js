/**
 * unitInformationService.js — Central de Relacionamento: Minha UBS e Rede Municipal
 *
 * Este é o ÚNICO service utilizado pela MinhaUbsPage.
 * A UI nunca consulta múltiplos endpoints diretamente.
 *
 * Agrega em paralelo:
 *   - UBS + equipe + profissionais  (/citizen-portal/my-unit)
 *   - Serviços habilitados          (/citizen-portal/unit-services)
 *   - Avisos institucionais         (/citizen-portal/unit-notices)
 *   - Campanhas municipais          (/citizen-portal/campaigns)
 *   - Rede municipal                (/citizen-portal/network)
 *
 * Falhas por módulo são isoladas — um módulo falhando não derruba os demais.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function getToken() {
  try {
    const s = JSON.parse(sessionStorage.getItem("portal_cidadao") || "null");
    return s?.token || null;
  } catch { return null; }
}

async function apiGet(path) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

async function safe(label, fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    console.warn(`[unitInformationService] ${label} falhou:`, e.message);
    return { ok: false, error: e.message };
  }
}

/** Carrega todos os dados da central de relacionamento em paralelo */
export async function loadUnitInformation() {
  const [unitRes, servicesRes, noticesRes, campaignsRes, networkRes] = await Promise.all([
    safe("my-unit",       () => apiGet("/citizen-portal/my-unit")),
    safe("unit-services", () => apiGet("/citizen-portal/unit-services")),
    safe("unit-notices",  () => apiGet("/citizen-portal/unit-notices")),
    safe("campaigns",     () => apiGet("/citizen-portal/campaigns")),
    safe("network",       () => apiGet("/citizen-portal/network")),
  ]);

  return {
    ubs:           unitRes.ok      ? unitRes.data.ubs           : null,
    equipe:        unitRes.ok      ? unitRes.data.equipe        : null,
    profissionais: unitRes.ok      ? (unitRes.data.profissionais || []) : [],
    contatos:      unitRes.ok      ? unitRes.data.contatos      : null,
    servicos:      servicesRes.ok  ? servicesRes.data.servicos  : null,
    farmaciaBreve: servicesRes.ok  ? servicesRes.data.farmaciaBreve : true,
    avisos:        noticesRes.ok   ? noticesRes.data.avisos     : null,
    campanhas:     campaignsRes.ok ? campaignsRes.data.campanhas : null,
    rede: {
      permitido: networkRes.ok ? networkRes.data.permitido : false,
      unidades:  networkRes.ok ? (networkRes.data.unidades || []) : [],
    },
    // Erros por módulo — para exibição granular em cards
    _erros: {
      unit:      unitRes.ok      ? null : unitRes.error,
      services:  servicesRes.ok  ? null : servicesRes.error,
      notices:   noticesRes.ok   ? null : noticesRes.error,
      campaigns: campaignsRes.ok ? null : campaignsRes.error,
      network:   networkRes.ok   ? null : networkRes.error,
    },
  };
}

/** Formata horário de funcionamento para exibição */
export function formatarHorario(horario) {
  return horario || "Horário não informado";
}

/** Formata endereço completo */
export function formatarEndereco(contatos) {
  if (!contatos) return null;
  const partes = [
    contatos.endereco,
    contatos.bairro,
    contatos.municipio && contatos.uf ? `${contatos.municipio}/${contatos.uf}` : contatos.municipio,
    contatos.cep ? `CEP ${contatos.cep}` : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : null;
}
