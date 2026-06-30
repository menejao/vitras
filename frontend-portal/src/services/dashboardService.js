/**
 * dashboardService.js — Agregador do Dashboard do Portal
 *
 * A Home nunca chama múltiplos serviços diretamente.
 * Este service reúne tudo e entrega um objeto coerente.
 *
 * Cada módulo falha de forma isolada — o Dashboard nunca cai todo por causa de um módulo.
 */

import { getAgendamentos }                   from "./agendamentosService.js";
import { getMinhaSaude }                     from "./minhaSaudeService.js";
import { getNotificacoes, countUnread }      from "./notificacoesService.js";
import { getMinhaUbs }                       from "./ubsService.js";
import { fetchPortalConfig, isModuloAtivo }  from "./configService.js";

/** Executa fn sem lançar — retorna { ok, data } ou { ok: false, error } */
async function safe(fn) {
  try   { return { ok: true,  data: await fn() }; }
  catch (e) { return { ok: false, error: e.message || "Erro desconhecido" }; }
}

const PRIORITY_ORDER = { alta: 0, media: 1, baixa: 2 };

function buildPendencias(agend, saude, notifs) {
  const list = [];

  // Consulta hoje ou amanhã → ALTA
  if (agend) {
    const now   = new Date();
    const futura = agend
      .filter(a => a.data && new Date(a.data) >= new Date(now.toDateString()))
      .sort((a, b) => new Date(a.data) - new Date(b.data))[0];
    if (futura) {
      const diff = Math.ceil((new Date(futura.data) - now) / 86_400_000);
      if (diff <= 1) {
        list.push({
          id:        "consulta-urgente",
          prioridade: "alta",
          icone:     "📅",
          descricao: diff === 0
            ? `Consulta hoje: ${futura.tipo}`
            : `Consulta amanhã: ${futura.tipo}`,
          rota: "/agendamentos",
        });
      }
    }
  }

  // Resultado de exame disponível → ALTA
  if (saude?.exames?.some(e => e.resultado)) {
    const n = saude.exames.filter(e => e.resultado).length;
    list.push({ id: "exame-resultado", prioridade: "alta", icone: "🔬", descricao: `${n} resultado(s) de exame disponível(is)`, rota: "/minha-saude" });
  }

  // Vacinas pendentes → MÉDIA
  if (saude?.vacinas) {
    const n = saude.vacinas.filter(v => v.status === "pendente").length;
    if (n > 0) list.push({ id: "vacina-pendente", prioridade: "media", icone: "💉", descricao: `${n} vacina(s) pendente(s)`, rota: "/minha-saude" });
  }

  // Receitas ativas → MÉDIA
  if (saude?.receitas?.length > 0) {
    list.push({ id: "receita-ativa", prioridade: "media", icone: "💊", descricao: `${saude.receitas.length} receita(s) ativa(s)`, rota: "/minha-saude" });
  }

  // Avisos não lidos → BAIXA
  if (notifs) {
    const n = countUnread(notifs);
    if (n > 0) list.push({ id: "notif-nao-lida", prioridade: "baixa", icone: "🔔", descricao: `${n} aviso(s) não lido(s)`, rota: "/notificacoes" });
  }

  return list.sort((a, b) => PRIORITY_ORDER[a.prioridade] - PRIORITY_ORDER[b.prioridade]);
}

/**
 * Carrega todos os módulos em paralelo.
 * Retorna objeto com resultado individual por módulo + pendências + quickLinks.
 * Nunca lança exceção.
 */
export async function loadDashboard(cidadao) {
  const [agendRes, saudeRes, notifRes, ubsRes, configRes] = await Promise.all([
    safe(getAgendamentos),
    safe(getMinhaSaude),
    safe(getNotificacoes),
    safe(getMinhaUbs),
    safe(() => fetchPortalConfig(cidadao?.unitId || null)),
  ]);

  const config = configRes.ok ? configRes.data : null;
  const agend  = agendRes.ok  ? agendRes.data  : null;
  const saude  = saudeRes.ok  ? saudeRes.data  : null;
  const notifs = notifRes.ok  ? notifRes.data  : null;

  const pendencias = buildPendencias(agend, saude, notifs);

  // Quick links respeitam configuração do município/UBS
  const quickLinks = [
    { id: "agendamentos", label: "Agendar",     rota: "/agendamentos", modulo: "agendamentos" },
    { id: "minha-saude",  label: "Minha Saúde", rota: "/minha-saude",  modulo: null },
    { id: "minha-ubs",    label: "Minha UBS",   rota: "/minha-ubs",    modulo: "minhaUbs"     },
    { id: "notificacoes", label: "Avisos",       rota: "/notificacoes", modulo: "notificacoes" },
    { id: "perfil",       label: "Perfil",       rota: "/perfil",       modulo: null           },
  ].filter(l => !l.modulo || isModuloAtivo(config, l.modulo));

  return {
    config,
    pendencias,
    quickLinks,
    modulos: {
      agendamentos: agendRes,
      saude:        saudeRes,
      notificacoes: notifRes,
      ubs:          ubsRes,
    },
  };
}

/** Retorna próxima consulta futura ou a mais recente */
export function getProximaConsulta(agend) {
  if (!agend?.length) return null;
  const now    = new Date();
  const futura = agend.filter(a => new Date(a.data) >= now).sort((a, b) => new Date(a.data) - new Date(b.data));
  return futura[0] || agend[0];
}
