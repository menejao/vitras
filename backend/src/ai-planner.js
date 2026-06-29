// AI Planner — multi-intent detection, tool orchestration, explainable responses.
// Entry point: planAndExecute(question, db)
// Returns { intent, answer, references, plan?, toolsUsed?, sources? }

import {
  toolCountPatients,
  toolCountByCategory,
  toolCountHypertensive,
  toolCountDiabetic,
  toolCountFamilies,
  toolCountVisits,
  toolCountVisitsTotal,
  toolGetPatientsWithoutVisit,
  toolGetIncompletePatients,
  toolCountOpenTasks,
  toolGetExportHistory,
  toolGetLastExport,
  toolSearchPatient,
} from "./ai-tools.js";

// ── text normalization ────────────────────────────────────────────────────────

function normalize(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/-/g, "")
    .toLowerCase()
    .trim();
}

// ── out-of-scope guard ────────────────────────────────────────────────────────

const OUT_OF_SCOPE_PATTERN =
  /antibiotico|antimicrobiano|posologia|prescri[çc]|conduta clinica|diagnostico diferencial|indicac[aã]o de medica|qual medica|trat[ae]r com|dose de|esquema de tratamento/;

// ── system help knowledge base (FASE 5 — expanded) ───────────────────────────

const HELP_KB = [
  // e-SUS export — require explicit "como" or "gerar/enviar" prefix to avoid matching operational queries like "quantas exportações?"
  {
    keys: /como.*export|como.*enviar.*esus|gerar.*lote|lote.*esus|cds.*export|como.*esus/,
    answer: `Para exportar dados ao e-SUS APS:
1. Acesse Relatórios no menu principal.
2. Abra a aba e-SUS APS.
3. Selecione mês e ano da competência.
4. Clique em Validar lote e corrija pendências indicadas.
5. Clique em Gerar exportação.
6. Baixe o arquivo ZIP gerado.
7. No PEC e-SUS APS da unidade: Transmissão de dados → Importar → selecione o arquivo.

Atenção: CNES, INE, CNS e CBO do profissional devem estar configurados.`
  },
  // e-SUS validation
  {
    keys: /valida.*lote|lote.*valid|inconsistencia.*esus|esus.*inconsistencia|bloqueador/,
    answer: `Para validar o lote antes de exportar:
1. Acesse Relatórios → aba e-SUS APS.
2. Selecione a competência (mês/ano).
3. Clique em Validar lote.
4. Bloqueadores (campos obrigatórios ausentes): devem ser corrigidos antes de exportar.
5. Avisos (campos recomendados): não impedem a exportação, mas afetam a qualidade.

Campos obrigatórios: nome, data de nascimento, sexo biológico do paciente; CNS, CBO e CNES do profissional.`
  },
  // export history
  {
    keys: /historico.*export|export.*histor|lotes anterior|exportacoes anterior|ver exportacoes/,
    answer: `Para consultar o histórico de exportações e-SUS:
1. Acesse Relatórios → aba e-SUS APS.
2. Role a página até a seção Histórico de exportações.

O histórico exibe: data, competência, quantidade de fichas exportadas, status (sucesso/parcial) e responsável.`
  },
  // patient registration
  {
    keys: /como.*cadastr.*paciente|como.*adicionar paciente|como.*registrar paciente|novo paciente/,
    answer: `Para cadastrar um paciente:
1. Acesse Pacientes no menu principal.
2. Clique em Novo Paciente.
3. Preencha: nome, data de nascimento, sexo biológico.
4. Informe documentos (CNS ou CPF), endereço, microárea e ACS responsável.
5. Salve o cadastro.

Campos obrigatórios para o e-SUS: nome, data de nascimento, sexo biológico (campo sexo ao nascer).`
  },
  // family registration
  {
    keys: /como.*cadastr.*familia|como.*criar.*familia|como.*registrar.*familia|grupo familiar/,
    answer: `Para cadastrar uma família (grupo familiar):
1. Acesse Pacientes.
2. Abra o cadastro do paciente responsável pela família.
3. Na seção Família, clique em Criar grupo familiar.
4. Adicione os demais membros da família.
5. Salve.

O grupo familiar é usado para relatórios de cobertura territorial e exportação do Cadastro Domiciliar (FCD).`
  },
  // ACS visit registration
  {
    keys: /como.*registr.*visita|como.*lancar.*visita|como.*nova.*visita|como.*visita.*acs|lancar visita|registrar visita domiciliar/,
    answer: `Para registrar uma visita domiciliar ACS:
1. Acesse o cadastro do paciente.
2. Clique em Nova visita / Registrar visita ACS.
3. Informe: data da visita, motivo(s) da visita e desfecho.
4. Salve.

A visita é exportada na Ficha de Visita Domiciliar (FVD) do e-SUS APS.
Campos obrigatórios no e-SUS: data, motivo da visita, profissional ACS.`
  },
  // reports / indicators
  {
    keys: /como.*relatorio|gerar relatorio|relatorio executivo|como ver indicadores|como.*painel|como.*usar.*relatorio/,
    answer: `Para gerar relatórios gerenciais:
1. Acesse Relatórios no menu principal.
2. Opções disponíveis:
   - Análise por IA → Relatório executivo: sumário com totais de pacientes, risco e tarefas.
   - Análise por IA → Prioridades do dia: lista classificada por risco clínico.
   - Análise por IA → Qualidade de dados: inconsistências de cadastro.
   - e-SUS APS: exportação e histórico de lotes.

Também é possível fazer consultas em linguagem natural na caixa "Consulta em linguagem natural".`
  },
  // tasks
  {
    keys: /como.*criar.*tarefa|como.*registrar.*tarefa|como.*ver.*tarefa|como.*tarefa/,
    answer: `Para criar e acompanhar tarefas:
1. Acesse o cadastro do paciente.
2. Na seção Tarefas, clique em Nova tarefa.
3. Informe: título, descrição, data de vencimento e responsável.
4. Salve.

Tarefas vencidas aparecem na análise de Prioridades do dia e no Relatório executivo.
Para ver todas as tarefas pendentes da equipe: use a consulta "Quantas tarefas estão pendentes?"  na análise de IA.`
  },
  // audit
  {
    keys: /auditoria|trilha.*auditoria|log.*auditoria|como ver.*auditoria|historico.*acoes/,
    answer: `O VITRAS mantém trilha de auditoria automática para todas as operações sensíveis.

Registros de auditoria incluem: quem fez, o quê, quando e qual recurso foi afetado.
Auditoria cobre: login, logout, alteração de paciente, exportação e-SUS, acesso de emergência (break glass), gestão de usuários.

Para consultar logs de auditoria: requer perfil Gestor ou Break Glass Admin. Acesse as configurações da unidade e consulte os registros de auditoria disponíveis.`
  },
  // permissions / RBAC
  {
    keys: /permiss|perfil.*usuario|como dar.*acesso|configurar.*usuario|papel.*usuario|rbac|como criar.*usuario|como gerenciar.*usuario/,
    answer: `Perfis de usuário disponíveis no VITRAS:

• Médico / Enfermeiro: atendimento clínico, evolução, prescrição de exames.
• ACS (Agente Comunitário de Saúde): visitas domiciliares, cadastro de pacientes.
• Gestor: acesso completo, exportação e-SUS, relatórios, auditoria.
• Break Glass Admin: acesso de emergência com registro obrigatório.

Para criar ou editar usuários:
1. Acesse Configurações → Usuários (requer perfil Gestor).
2. Clique em Novo usuário ou selecione um existente.
3. Defina nome, e-mail, perfil e unidade.
4. Salve.`
  },
  // unit management
  {
    keys: /configurar.*unidade|configuracao.*unidade|cnes|ine.*equipe|configurar.*cbo|configurar.*cns|configurar.*equipe/,
    answer: `Para configurar a unidade de saúde:
1. Acesse Configurações → Unidade (requer perfil Gestor).
2. Preencha: CNES da unidade (7 dígitos), nome, endereço.
3. Em Equipes: configure INE da equipe (10 dígitos).
4. Em Profissionais: configure CNS (15 dígitos) e CBO de cada profissional.

Essas configurações são obrigatórias para exportar dados ao e-SUS APS.`
  },
  // indicators - AI assisted
  {
    keys: /como usar.*ia|ia.*funciona|inteligencia.*clinica|analise.*ia|copiloto|o que a ia faz/,
    answer: `A Análise Assistida por IA do VITRAS oferece:

• Consulta em linguagem natural: faça perguntas sobre os dados da unidade.
  Exemplos: "Quantas gestantes existem?", "Quais pacientes estão sem visita há 30 dias?", "Qual foi a última exportação?"

• Prioridades do dia: lista de pacientes ordenados por risco clínico calculado.

• Qualidade de dados: detecta cadastros incompletos e inconsistências.

• Relatório executivo: sumário gerencial com indicadores operacionais.

A IA usa dados reais da unidade e informa sempre os critérios e fontes das respostas.
Não toma decisões clínicas — apoia a gestão e a organização do trabalho.`
  },
];

function findHelp(q) {
  const qn = q.replace(/-/g, "");
  for (const entry of HELP_KB) {
    if (entry.keys.test(qn)) return { answer: entry.answer };
  }
  return null;
}

function helpFallback() {
  return {
    answer: `Não encontrei um tutorial específico para essa dúvida.

Tópicos disponíveis:
• Como exportar o e-SUS APS
• Como validar o lote e-SUS
• Como ver o histórico de exportações
• Como cadastrar um paciente
• Como cadastrar uma família
• Como registrar uma visita ACS
• Como criar tarefas
• Como gerar relatórios e indicadores
• Como configurar a unidade e equipe
• Como gerenciar usuários e permissões
• Como funciona a Análise por IA`
  };
}

// ── intent detectors (tool dispatch table) ────────────────────────────────────

const DETECTORS = [
  {
    id: "count_pregnant",
    pattern: /gestante|gravida|prenatal|gestacao/,
    run: (db) => toolCountByCategory(db, "pregnant"),
    summarize: (r) => `${r.count} gestante(s) cadastrada(s)`,
    detail: (r) =>
      r.count > 0
        ? `Gestantes: ${r.items.map((i) => i.name).slice(0, 10).join(", ")}${r.count > 10 ? ` e mais ${r.count - 10}` : ""}.`
        : "Não há gestantes cadastradas no momento.",
  },
  {
    id: "count_puerperal",
    pattern: /puerper/,
    run: (db) => toolCountByCategory(db, "puerperal"),
    summarize: (r) => `${r.count} paciente(s) em puerpério`,
    detail: (r) =>
      r.count > 0
        ? `Em puerpério: ${r.items.map((i) => i.name).slice(0, 10).join(", ")}.`
        : "Não há pacientes em puerpério.",
  },
  {
    id: "count_elderly",
    pattern: /idos[ao]|pessoa idosa|geriatra/,
    run: (db) => toolCountByCategory(db, "elderly"),
    summarize: (r) => `${r.count} paciente(s) idoso(s)`,
    detail: (r) =>
      r.count > 0
        ? `Idosos: ${r.items.map((i) => i.name).slice(0, 10).join(", ")}.`
        : "Não há pacientes com categoria Pessoa Idosa.",
  },
  {
    id: "count_chronic",
    pattern: /cronico|dcnt/,
    run: (db) => toolCountByCategory(db, "chronic"),
    summarize: (r) => `${r.count} paciente(s) crônico(s)/DCNT`,
    detail: (r) =>
      r.count > 0
        ? `Crônicos/DCNT: ${r.items.map((i) => i.name).slice(0, 10).join(", ")}.`
        : "Não há pacientes na categoria DCNT/crônico.",
  },
  {
    id: "count_hypertensive",
    pattern: /hiperten/,
    run: (db) => toolCountHypertensive(db),
    summarize: (r) => `${r.count} paciente(s) com hipertensão registrada`,
    detail: (r) =>
      r.count > 0
        ? `Hipertensos: ${r.items.map((i) => i.name).slice(0, 10).join(", ")}${r.count > 10 ? ` e mais ${r.count - 10}` : ""}.`
        : "Nenhum paciente com hipertensão registrada nas comorbidades.",
  },
  {
    id: "count_diabetic",
    pattern: /diabet/,
    run: (db) => toolCountDiabetic(db),
    summarize: (r) => `${r.count} paciente(s) com diabetes registrada`,
    detail: (r) =>
      r.count > 0
        ? `Diabéticos: ${r.items.map((i) => i.name).slice(0, 10).join(", ")}${r.count > 10 ? ` e mais ${r.count - 10}` : ""}.`
        : "Nenhum paciente com diabetes registrada nas comorbidades.",
  },
  {
    id: "count_patients",
    pattern: /total de paciente|quantos paciente|numero de paciente/,
    run: (db) => toolCountPatients(db),
    summarize: (r) => `${r.count} paciente(s) ativo(s) cadastrado(s)`,
    detail: () => "Total de pacientes ativos (não inativos) registrados na unidade.",
  },
  {
    id: "count_families",
    pattern: /familia|grupo familiar/,
    run: (db) => toolCountFamilies(db),
    summarize: (r) => `${r.count} família(s)/grupo(s) familiar(es)`,
    detail: () => "Total de grupos familiares cadastrados na unidade.",
  },
  {
    id: "count_visits_month",
    pattern: /visita.*mes|mes.*visita|visitas.*este mes|quantas visitas/,
    run: (db, q) => {
      const m = q.match(/\b(\d{4}-\d{2})\b/);
      return toolCountVisits(db, m ? { month: m[1] } : {});
    },
    summarize: (r) => `${r.count} visita(s) domiciliar(es) ACS em ${r.period}`,
    detail: (r) => `Total histórico de visitas: ${r.total}. No período (${r.period}): ${r.count}.`,
  },
  {
    id: "count_visits_total",
    pattern: /total.*visita|visita.*total|visita domiciliar|visitas.*acs|acs.*visitas/,
    run: (db) => toolCountVisitsTotal(db),
    summarize: (r) => `${r.count} visita(s) domiciliar(es) ACS (total histórico)`,
    detail: () => "Contagem total de visitas domiciliares ACS registradas no sistema.",
  },
  {
    id: "count_tasks",
    pattern: /tarefa.*pendent|pendent.*tarefa|tarefa.*aberta|tarefa.*atras|tarefas pendentes/,
    run: (db) => toolCountOpenTasks(db),
    summarize: (r) => `${r.count} tarefa(s) em aberto, ${r.overdueCount} vencida(s)`,
    detail: (r) => `Tarefas abertas: ${r.count}. Tarefas vencidas: ${r.overdueCount}.`,
  },
  {
    id: "export_history",
    pattern: /historico.*exportacao|exportacoes.*realizadas|quantas.*exportacao|lista.*exportacao/,
    run: (db) => toolGetExportHistory(db, 5),
    summarize: (r) => `${r.count} exportação(ões) e-SUS APS registrada(s) no histórico`,
    detail: (r) => {
      if (!r.recent.length) return "Nenhuma exportação registrada ainda.";
      return `Recentes: ${r.recent.map((e) => `${e.competencia} — ${e.patientsExported} fichas (${e.status})`).join("; ")}.`;
    },
  },
  {
    id: "last_export",
    pattern: /ultima.*exportacao|exportacao.*recente|quando.*exportou|ultima.*esus/,
    run: (db) => toolGetLastExport(db),
    summarize: (r) =>
      r.last
        ? `Última exportação: competência ${r.last.competencia}, ${r.last.patientsExported} fichas`
        : "Nenhuma exportação registrada",
    detail: (r) => {
      if (!r.last) return "Nenhuma exportação encontrada no histórico.";
      const date = r.last.date ? new Date(r.last.date).toLocaleDateString("pt-BR") : "-";
      return `Competência: ${r.last.competencia}. Data: ${date}. Fichas: ${r.last.patientsExported}. Ignoradas: ${r.last.patientsSkipped ?? 0}. Status: ${r.last.status}. Responsável: ${r.last.exportedBy || "-"}.`;
    },
  },
  {
    id: "without_visit",
    pattern: /sem visita|sem.*visita.*dias|(\d+)\s*dias.*sem.*visita|visita.*(\d+)\s*dias/,
    run: (db, q) => {
      const m = q.match(/(\d+)\s*dias/);
      return toolGetPatientsWithoutVisit(db, m ? parseInt(m[1], 10) : 30);
    },
    summarize: (r) => `${r.count} paciente(s) sem visita ACS há mais de ${r.days} dias`,
    detail: (r) =>
      r.items.length
        ? `Pacientes: ${r.items.slice(0, 8).map((i) => `${i.name} (última visita: ${i.lastVisit})`).join("; ")}${r.count > 8 ? ` e mais ${r.count - 8}` : ""}.`
        : "Todos os pacientes receberam visita no período.",
  },
  {
    id: "incomplete_patients",
    pattern: /incompleto|cadastro.*incompleto|dado.*ausente|sem.*telefone|sem.*endereco|sem.*documento|sem.*acs.*vinculado/,
    run: (db) => toolGetIncompletePatients(db),
    summarize: (r) => `${r.count} de ${r.total} paciente(s) com cadastro incompleto`,
    detail: (r) =>
      r.items.length
        ? `Exemplos: ${r.items.slice(0, 6).map((i) => `${i.name} (falta: ${i.missing.join(", ")})`).join("; ")}${r.count > 6 ? ` e mais ${r.count - 6}` : ""}.`
        : "Todos os cadastros estão completos.",
  },
];

// ── planner core ──────────────────────────────────────────────────────────────

function buildAnswer(results, matched) {
  const ok = results.filter((r) => r.ok);
  if (!ok.length) {
    return "Não foi possível consultar os dados no momento.";
  }

  const summaries = ok.map((r) => r.detector.summarize(r.data));
  const details = ok.map((r) => r.detector.detail(r.data)).filter(Boolean);
  const sources = [...new Set(ok.map((r) => r.data.source))];
  const criteria = ok.map((r) => r.data.criteria);
  const periods = [...new Set(ok.map((r) => r.data.period).filter(Boolean))];
  const limitations = ok.filter((r) => r.data.limitations).map((r) => r.data.limitations);

  const lines = [
    summaries.join(". ") + ".",
    "",
    ...details,
    "",
    `Fonte: ${sources.join(", ")}.`,
    `Critério: ${criteria.join("; ")}.`,
    periods.length ? `Período: ${periods.join(", ")}.` : null,
    limitations.length ? `Nota: ${limitations.join("; ")}.` : null,
  ].filter((l) => l !== null);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── main entry ────────────────────────────────────────────────────────────────

export function planAndExecute(question, db) {
  const originalQ = String(question || "").trim();
  const q = normalize(originalQ);

  if (!q) {
    return { intent: "EMPTY", answer: "Envie uma pergunta para o assistente.", references: [] };
  }

  // 1. Out-of-scope guard
  if (OUT_OF_SCOPE_PATTERN.test(q)) {
    return {
      intent: "OUT_OF_SCOPE",
      answer:
        "Não posso indicar conduta clínica individualizada. Use os protocolos vigentes e avalie com o profissional responsável.",
      references: [],
    };
  }

  // 2. System help check
  const helpResult = findHelp(q);
  if (helpResult) {
    return { intent: "SYSTEM_HELP_QUERY", answer: helpResult.answer, references: [] };
  }

  // 3. System help intent (no specific topic found)
  if (/^como |como (export|cadastr|registr|gerar|criar|acess|valida|importa|us[ao]r|abrir|localiz|config|baixar|enviar|ver |ativar)|onde (fica|encontr|acesso|vejo)|passo a passo|tutorial|ajuda com|instrucao/.test(q)) {
    return { intent: "SYSTEM_HELP_QUERY", ...helpFallback(), references: [] };
  }

  // 4. Detect intents — run ALL matching detectors (composite support)
  const matched = DETECTORS.filter((d) => d.pattern.test(q));

  if (!matched.length) {
    return {
      intent: "UNKNOWN",
      answer: `Não encontrei dados suficientes para responder essa pergunta.

Exemplos de perguntas que posso responder:
• Quantas gestantes tenho cadastradas?
• Quantos hipertensos existem?
• Quais pacientes estão sem visita há 30 dias?
• Quantas famílias existem?
• Quantas visitas ACS ocorreram este mês?
• Qual foi a última exportação e-SUS?
• Quantas tarefas estão pendentes?
• Como exportar o e-SUS?
• Como cadastrar um paciente?`,
      references: [],
    };
  }

  // 5. Execute tools (plan = list of detector IDs)
  const plan = matched.map((d) => d.id);
  const results = matched.map((d) => {
    try {
      const data = d.run(db, q);
      return { detector: d, data, ok: true };
    } catch (err) {
      return { detector: d, data: null, ok: false, error: err.message };
    }
  });

  // 6. Build answer with explainability
  const answer = buildAnswer(results, matched);
  const sources = [...new Set(results.filter((r) => r.ok).map((r) => r.data.source))];
  const references = results
    .filter((r) => r.ok && Array.isArray(r.data.items))
    .flatMap((r) => r.data.items.map((i) => (typeof i === "string" ? i : i.name)))
    .filter(Boolean)
    .slice(0, 20);

  return {
    intent: matched.length > 1 ? "COMPOSITE_OPERATIONAL" : "OPERATIONAL_DATA_QUERY",
    answer,
    references,
    plan,
    toolsUsed: plan,
    sources,
  };
}
