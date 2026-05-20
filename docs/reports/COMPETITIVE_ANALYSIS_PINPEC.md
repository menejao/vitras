# Análise Estratégica Competitiva — SIGUS vs. PinPec

**Data:** 2026-05-14  
**Escopo:** Gestão municipal de saúde, APS, UBS, prontuário eletrônico, SUS/e-SUS, LGPD  
**Fontes:** Site público PinPec (pinpec.com.br), auditoria SIGUS 2026-05-13, README e docs de governança

---

## 1. Comparativo Funcional

### 1.1 Tabela de Funcionalidades

| Funcionalidade | PinPec | SIGUS (nosso) | Ausente em nós | Diferencial PinPec | Diferencial SIGUS |
|---|---|---|---|---|---|
| **Monitoramento de indicadores Previne Brasil** | ✅ Core produto | ⚠️ Parcial (via protocolo) | Painel ISF/quadrimestral dedicado | Dashboard específico por portaria | — |
| **Prontuário eletrônico (PEC)** | ✅ Integração e-SUS PEC | ✅ Prontuário próprio | — | — | Prontuário nativo, offline-capable |
| **Gestão de equipes (ESF/APS)** | ✅ Por equipe | ✅ Multi-equipe com papéis | — | — | Permissões granulares (ACS/Médica/Enfermeira) |
| **Cadastro de pacientes** | ⚠️ Via e-SUS | ✅ Nativo + categorias clínicas | — | — | Categorias: gestante, puérpera, crônico, idosa, puericultura |
| **Visitas ACS + territorialização** | ✅ e-SUS AB Território | ✅ Registro de visita + microárea | — | Peso de captura territorializada | Filtro por microárea + ACS |
| **Histórico clínico completo** | ⚠️ Via e-SUS externo | ✅ Consultas, vacinas, procedimentos, observações | — | — | Histórico unificado em sistema próprio |
| **Protocolos clínicos** | ❌ Não mencionado | ✅ Templates por categoria + metas | — | — | Protocolos nativos com meta x realizado |
| **Tarefas para ACS** | ❌ Não mencionado | ✅ CRUD completo de tarefas | — | — | Fluxo enfermeira → ACS com acompanhamento |
| **Mural por paciente** | ❌ Não mencionado | ✅ Comunicação interna por paciente | — | — | Mural de mensagens por paciente |
| **IA assistida** | ❌ Não mencionado | ✅ Resumo, alertas, priorização, chat, draft de evolução, sugestão de categoria | — | — | IA clínica local (sem LLM externo obrigatório) |
| **Analytics de demanda** | ⚠️ Indicadores gerais | ✅ Demanda programada vs. espontânea mensal | — | ISF ranking inter-municipal | Fórmula por portaria (50–70%) |
| **Auditoria técnica** | ❌ Não mencionado | ✅ Hash SHA-256 encadeado, exportação JSON/CSV | — | — | Trilha imutável com integridade verificável |
| **LGPD nativo** | ❌ Não mencionado | ✅ Anonimização, direitos do titular, retenção, workflow de aprovação | — | — | Kit governança + política + playbook incidente |
| **2FA (TOTP)** | ❌ Não mencionado | ✅ Por perfil clínico | — | — | 2FA obrigatório para médica e enfermeira |
| **Criptografia em repouso** | ❌ Não mencionado | ✅ AES-256-GCM (CPF, CNS, segredo 2FA) | — | — | Campos sensíveis sempre criptografados |
| **Backup automatizado** | ❌ Não mencionado | ✅ GitHub Actions nightly + artifact 30 dias | — | — | Snapshot diário criptografado |
| **Validação de conselho profissional** | ❌ Não mencionado | ✅ Webhook externo (n8n/Make) | — | — | Validação CRM/COREN na entrada |
| **Multi-tenant (por equipe)** | ⚠️ Por município | ✅ Por equipe dentro do município | — | Visão consolidada municipal | Isolamento por equipe no mesmo município |
| **Cloud** | ✅ AWS | ✅ Render + Neon + Cloudflare Workers | — | AWS alta disponibilidade (confiança) | Custo zero inicial; edge para frontend |
| **Treinamento de equipes** | ✅ Serviço dedicado | ❌ Apenas documentação | Programa de capacitação | Professionals experientes | — |
| **e-SUS nativo** | ✅ Servidor e-SUS próprio na AWS | ⚠️ Sem integração direta ainda | Servidor/sync e-SUS | Substitui necessidade de infra própria | — |
| **Ranking ISF inter-municipal** | ✅ Municípios no TOP 10 por estado | ❌ Sem benchmarking externo | Benchmarking de mercado | Prova social competitiva | — |

### 1.2 Síntese Funcional

**PinPec faz bem:** gestão macro de indicadores Previne Brasil, benchmarking municipal, serviço de e-SUS na AWS, treinamento.

**SIGUS faz bem:** prontuário clínico profundo, IA assistida, LGPD operacional, auditoria técnica, protocolos nativos, gestão de equipe granular.

**Lacuna crítica do SIGUS:** sem integração e-SUS, sem painel de indicadores Previne Brasil, sem treinamento formal, sem benchmarking municipal.

**Lacuna crítica do PinPec:** sem prontuário próprio, sem IA, sem LGPD técnico visível, sem gestão clínica profunda.

---

## 2. Comparativo Técnico

| Dimensão | PinPec | SIGUS (nosso) | Avaliação |
|---|---|---|---|
| **Arquitetura** | Não divulgada; inferido: servidores e-SUS encapsulados | Monólito Node.js (server.js 5688 linhas) + React (App.jsx ~11k linhas) | ⚠️ Nós: monólito grande; PinPec desconhecida |
| **Cloud** | AWS (explicitamente declarado) | Render (backend) + Neon (Postgres) + Cloudflare Workers (frontend) | ⚠️ AWS tem mais credibilidade institucional; nossa stack é válida mas menor |
| **Banco de dados** | Não divulgado | Neon PostgreSQL — mas estrutura JSONB único (antipadrão crítico) | ❌ JSONB único é bloqueador de escala |
| **Índices / Queries** | Não divulgado | Zero índices (impossível sobre JSONB sem colunas extraídas) | ❌ Risco grave de performance sob carga |
| **Migrações** | Não divulgado | Ausentes — schema em runtime (`ensureDbShape`) | ❌ Sem versionamento de banco |
| **Segurança — Auth** | Não divulgado | JWT HS256 com issuer/audience + scrypt para senhas | ✅ Bom baseline |
| **Refresh token** | Não divulgado | Ausente — tokens de 12h sem renovação, sem revogação | ❌ Falha operacional |
| **Rate limiting** | Não divulgado | Em memória (Map) — perde estado no restart | ❌ Frágil em produção |
| **LGPD técnico** | Não divulgado | AES-256-GCM, anonimização, direitos do titular, workflow aprovação | ✅ Implementação acima da média |
| **Auditoria** | Não divulgado | Hash SHA-256 encadeado — detecta adulteração | ✅ Forte; raro em concorrentes |
| **CSP / Headers** | Não divulgado | Helmet sem CSP; HSTS ausente; headers manuais parciais | ⚠️ Incompleto |
| **Criptografia em repouso** | Não divulgado | AES-256-GCM nos campos sensíveis | ✅ Diferencial |
| **2FA** | Não divulgado | TOTP (implementação própria — risco; recomendado otplib) | ⚠️ Funcional mas não auditado |
| **Performance** | Não divulgado | Cold start 50-60s (Render free); sem paginação; sem índices | ❌ Inaceitável em produção clínica |
| **Escalabilidade** | AWS implica escala gerenciada | Bloqueada por JSONB único (serializa writes) e monólito | ❌ Não escala hoje |
| **Multi-tenant** | Por município | Por equipe (dentro de uma instalação) | ⚠️ Falta isolamento entre municípios/instâncias |
| **Observabilidade** | Não divulgado | console.log sem estrutura JSON; sem APM; sem alertas | ❌ Não observável em produção |
| **Deploy / CI-CD** | Não divulgado | Sem CI/CD; git-snapshot manual; sem testes pré-deploy | ❌ Deploy manual sem safety net |
| **Integração e-SUS / RNDS** | ✅ Core (servidores próprios) | ❌ Ausente | ❌ Gap estratégico |
| **Frontend** | Não divulgado | React + Vite + Cloudflare Workers edge | ✅ Stack moderna com entrega na edge |
| **TypeScript** | Não divulgado | Ausente (JavaScript puro) | ⚠️ Risco de manutenção em escala |
| **Testes automatizados** | Não divulgado | Ausentes | ❌ Risco para iteração rápida |

---

## 3. Pontos Fortes do SIGUS

### 3.1 Onde somos mais modernos

| Ponto | Detalhe |
|---|---|
| **IA clínica integrada** | Resumo automático, priorização de pacientes, draft de evolução, sugestão de categoria — funciona sem LLM externo obrigatório |
| **Auditoria imutável** | Hash SHA-256 encadeado é raro no segmento; detecta adulteração posterior ao registro |
| **LGPD operacional** | Kit completo: política, workflow de direitos, anonimização técnica, playbook de incidente — prontos para uso real |
| **Criptografia de dados sensíveis** | AES-256-GCM para CPF, CNS, segredo 2FA — padrão acima do mínimo legal |
| **Frontend na edge** | Cloudflare Workers distribui assets globalmente; carregamento inicial rápido mesmo em municípios com internet lenta |
| **Protocolos clínicos nativos** | Templates por categoria + meta x realizado + checklist de vacinas — nível de profundidade clínica raro em ferramentas de gestão |
| **Gestão granular de equipe** | ACS/Médica/Enfermeira com permissões distintas no mesmo sistema; fluxo de tarefas ACS nativo |

### 3.2 Onde temos melhor potencial

- **IA**: fundação construída; expansão para análise preditiva de risco, geração de relatórios SIAB/GAB, integração com LLMs externos
- **Protocolo clínico**: dados estruturados por categoria permitem analytics de cohort e benchmarking interno sem dependência de e-SUS
- **LGPD como produto**: compliance como feature comercial — poucos concorrentes têm; pode ser argumento decisivo para municípios com TCE apertado
- **Personalização por município**: arquitetura multi-equipe pode evoluir para multi-tenant real sem reescrever lógica de negócio

### 3.3 Onde podemos superar concorrentes rapidamente

| Ação | Impacto | Prazo estimado |
|---|---|---|
| Painel Previne Brasil (indicadores ISF/quadrimestral) | Fecha gap principal com PinPec | 2–4 semanas |
| Migração JSONB → tabelas relacionais | Habilita escala, índices, paginação | 4–8 semanas |
| Integração básica e-SUS (importar FICHAS) | Credibilidade institucional | 6–10 semanas |
| Refresh token + revogação | Produção viável com segurança | 1–2 semanas |
| Dashboard analytics de demanda | Diferencial imediato para gestores | 1–2 semanas |

---

## 4. Pontos Fracos Atuais

Baseado na auditoria de 2026-05-13 (`AUDITORIA_PRODUCAO_SEGURANCA.md`):

### 4.1 Críticos (bloqueadores de produção)

| Problema | Impacto competitivo |
|---|---|
| **JSONB único** — toda aplicação em uma linha | Serializa writes, impossibilita índices, explode sob carga. Não escala para >200 pacientes ativos. |
| **Credencial demo hardcoded** (`ana@clinica.local/123456`) | Risco de acesso não autorizado em produção; inaceitável em ambiente clínico real |
| **Rotas sem `requireAuth`** | Vazamento de dados ou crash 500 sem token — vetor de DoS trivial |
| **Rate limiting em memória** | Brute-force reinicia a cada deploy; bypass trivial |
| **Token sem expiração gerenciada** | `JWT_EXPIRES_IN` ausente no render.yaml → tokens eternos |

### 4.2 Altos (limitam competitividade)

| Problema | Impacto competitivo |
|---|---|
| **Sem refresh token** | Usuário deslogado a cada 12h; inaceitável para ACS em campo |
| **`const session = null`** bug | Usuário deslogado em qualquer F5; UX destruída |
| **Cold start 50-60s** (Render free) | UBS abre sistema e espera 1 minuto — inadmissível |
| **Monólito App.jsx ~11k linhas** | Iteração lenta, bundle gigante, sem code splitting |
| **Monólito server.js 5688 linhas** | Sem modularidade; code review impossível; regressões frequentes |
| **CSP desativado** | XSS não mitigado pelo browser |

### 4.3 Estruturais (limitam escala)

| Problema | Impacto |
|---|---|
| **Sem migrações de banco** | Impossível evoluir schema com segurança em produção |
| **Sem TypeScript** | Bugs de runtime em vez de compile-time; onboarding lento |
| **Sem testes automatizados** | Cada deploy é manual e arriscado |
| **Sem CI/CD** | Não escala para múltiplos devs ou múltiplos municípios |
| **Sem e-SUS integration** | Barreira de entrada em municípios que já usam PEC/e-SUS |
| **Sem observabilidade** | Falha silenciosa em produção; sem alertas |
| **Dados clínicos em plaintext no JSONB** | CPF/CNS criptografados, mas prontuários não — risco LGPD |

---

## 5. Oportunidades de Mercado

### 5.1 Segmentos prioritários

| Segmento | Oportunidade | Por que SIGUS pode ganhar |
|---|---|---|
| **Municípios pequenos (< 20k hab.)** | 3.500+ municípios brasileiros; maioria usa planilhas ou sistemas desatualizados | Implantação simples (Render free viável), custo baixo, sem licitação obrigatória abaixo de certos valores |
| **APS / ESF sem e-SUS funcional** | Muitos municípios têm e-SUS instalado mas não alimentado corretamente | Sistema mais simples e intuitivo pode capturar quem abandona o e-SUS |
| **Clínicas populares / UPAS privadas** | Mercado sem regulação obrigatória de prontuário; adoção mais livre | Prontuário nativo + IA pode ser argumento de modernidade |
| **Saúde domiciliar / SAD** | Crescimento pós-pandemia; ACS e equipes multidisciplinares em campo | App mobile-first + tarefas ACS + mural = fluxo de campo natural |
| **Equipes multidisciplinares (eMulti)** | Portaria 2023 expandiu equipes multi; sistemas não acompanharam | Perfis distintos (ACS, médico, enfermeira) já mapeados; fácil expandir para NASF/eMulti |
| **Analytics e indicadores municipais** | Secretarias buscam dashboards; Excel ainda domina | Dados clínicos estruturados já existem; dashboard é camada de apresentação |
| **IA em saúde pública** | Mercado inexplorado no nível municipal; PinPec não tem | Fundação de IA já construída; expansão incremental |
| **Auditoria LGPD como serviço** | TCEs e ANPD aumentando fiscalização | Kit governança pronto; criptografia, auditoria e workflow de direitos diferenciam |

### 5.2 Dinâmica de mercado

- **PinPec**: 65 municípios, ~615k pessoas. Foco em indicadores macro (Previne Brasil), não em operação clínica diária.
- **Brecha**: ninguém atende bem o fluxo operacional completo (prontuário + ACS + protocolo + IA + LGPD) em sistema unificado barato.
- **Janela**: Portaria GM/MS 3.493/2024 criou pressão para municípios monitorarem indicadores quadrimestrais — quem der ferramenta completa (indicadores + operação) ganha o contrato inteiro.

---

## 6. Roadmap Competitivo

### 6.1 Curto Prazo — "Pronto para Produção Real" (0–8 semanas)

| # | Item | Justificativa |
|---|---|---|
| 1 | Corrigir `const session = null` | Bug que derruba sessão em F5; UX inaceitável |
| 2 | Adicionar `requireAuth` em todas as rotas | Segurança básica; pré-requisito para qualquer dado real |
| 3 | Remover credencial demo de produção | Crítico de segurança |
| 4 | Rate limiting persistente (Redis/Upstash) | Brute-force viável hoje |
| 5 | Configurar todas as env vars no render.yaml | CORS, JWT, criptografia inoperantes sem elas |
| 6 | Implementar refresh token | Sessão contínua para profissionais em campo |
| 7 | Upgrade Render para plano pago | Eliminar cold start de 60s |
| 8 | Corrigir SSL (`rejectUnauthorized: true`) | MITM no banco |
| 9 | Error boundary no React | Crash total da UI por qualquer erro |

### 6.2 Médio Prazo — "Competitivo no Mercado" (2–6 meses)

| # | Item | Justificativa |
|---|---|---|
| 1 | **Migrar JSONB → tabelas relacionais** | Habilita escala, índices, paginação, concorrência real |
| 2 | **Painel Previne Brasil / ISF** | Fecha gap principal com PinPec; argumento comercial imediato |
| 3 | Sistema de migrações (Drizzle/node-pg-migrate) | Deploy seguro em produção sem perda de dados |
| 4 | Refatorar server.js em módulos | Reduz risco de regressão, viabiliza CI/CD |
| 5 | Refatorar App.jsx com code splitting | Performance em conexões lentas de UBS |
| 6 | CI/CD com testes (GitHub Actions) | Múltiplos municípios = múltiplos ambientes = automação obrigatória |
| 7 | CSP enforced + HSTS | Compliance de segurança completo |
| 8 | Logging estruturado JSON + ingestão (Grafana/Papertrail) | Observabilidade real em produção |
| 9 | Paginação em listagens | Viabiliza times grandes (1000+ pacientes) |
| 10 | TypeScript progressivo (backend primeiro) | Reduz bugs de runtime; onboarding mais rápido |

### 6.3 Longo Prazo — "Líder no Segmento" (6–18 meses)

| # | Item | Justificativa |
|---|---|---|
| 1 | **Integração e-SUS / RNDS** | Credibilidade institucional; requisito em licitações maiores |
| 2 | **Multi-tenant real** (por município, não por equipe) | Escala SaaS horizontal; precificação por tenant |
| 3 | **App mobile nativo** (React Native ou PWA offline) | ACS em campo sem internet; diferencial em municípios rurais |
| 4 | **IA preditiva** (risco de abandono, priorização automática, detecção de outliers) | Diferencial de produto que nenhum concorrente tem |
| 5 | **Analytics municipais** (dashboard secretaria + relatórios SIAB/GAB automáticos) | Vende para secretaria, não só para a UBS |
| 6 | **Marketplace de integrações** (laboratórios, farmácias populares, SIGA, Horus) | Ecossistema difícil de replicar |
| 7 | **Certificação SBIS / CFM** | Obrigatório para escala em hospitais e ambientes regulados |
| 8 | **White-label por município** | Personalização sem custo alto; fidelização |

---

## 7. Estratégia de Diferenciação

### Princípio: não competir por preço — competir por completude e confiança operacional

| Dimensão | Nossa posição | Como comunicar |
|---|---|---|
| **UX / Simplicidade** | Interface focada em ACS e enfermeira (não só gestor) | "Feito para quem opera, não só para quem gerencia" |
| **Implantação rápida** | Deploy em horas (Render + Neon + Cloudflare); sem infra própria | "Em funcionamento no mesmo dia; sem servidor, sem IT local" |
| **IA operacional** | Única ferramenta com IA em UBS no segmento | "Resumo automático, alertas e draft de evolução — IA que poupa tempo clínico real" |
| **LGPD como feature** | Kit governança pronto + auditoria técnica + criptografia | "LGPD não é só política: é criptografia, auditoria imutável e workflow de direitos — já prontos" |
| **Auditoria imutável** | Hash SHA-256 encadeado — detecta adulteração | "Cada ação registrada com integridade verificável — prova em caso de sindicância ou TCE" |
| **Custo total de propriedade** | Zero infraestrutura local; sem licença de SO/servidor | "Custo mensal previsível, sem surpresa de infra" |
| **Suporte clínico** | Conhecimento de protocolo ESF/APS embutido no produto | "Não é software genérico adaptado — nasceu para APS" |
| **Customização municipal** | Templates de protocolo, categorias clínicas, perfis — configuráveis | "Adapta ao fluxo do município, não o contrário" |
| **Velocidade de iteração** | Stack moderna (Node + React + Vite + Cloudflare) | "Novas funcionalidades em dias, não meses" |

### Posicionamento de mensagem

> *"PinPec monitora indicadores. SIGUS opera a saúde."*

PinPec é ferramenta de gestão macro para secretaria. SIGUS é plataforma de operação clínica diária para quem atende o paciente. São posicionamentos diferentes — e podem até ser complementares no mesmo município.

---

## 8. Avaliação Final

### 8.1 Estamos próximos de produção com dados reais?

**Não.** Há 5 bloqueadores críticos ativos (credencial demo, JSONB único, rotas sem auth, rate limit frágil, tokens sem expiração). Estimativa para produção mínima viável: **2–3 semanas de trabalho focado** nas correções da Fase 1 da auditoria.

Com Render pago + correções críticas: sistema pode entrar em produção para **1 equipe piloto em UBS** com segurança aceitável.

### 8.2 Estamos próximos de competir com PinPec?

**Parcialmente.** No segmento de operação clínica (prontuário, protocolos, tarefas, IA, LGPD): **sim, já somos mais completos**. No segmento de indicadores municipais (Previne Brasil, ISF, benchmarking): **não**, há gap claro.

Para competir diretamente: precisa do painel de indicadores Previne Brasil (2–4 semanas após correções críticas) e migração do JSONB (4–8 semanas).

### 8.3 Qual o maior gargalo?

**JSONB único.** É o único ponto que bloqueia escala técnica, performance, indexação e múltiplos municípios simultaneamente. Toda outra dívida técnica é pagável com iteração; o JSONB exige migração estrutural.

Segundo gargalo: **sem integração e-SUS**. Municípios que já usam e-SUS não vão abandoná-lo — precisamos importar/sincronizar, não substituir.

### 8.4 O que pode virar diferencial real?

| Diferencial | Potencial | Tempo para ativar |
|---|---|---|
| **IA clínica operacional** | Alto — nenhum concorrente direto tem | Já existe; refinar e comunicar |
| **LGPD técnico como produto** | Alto — fiscalização crescente, municípios vulneráveis | Kit pronto; add auditoria de acesso e relatório ANPD |
| **Painel Previne Brasil integrado à operação clínica** | Muito alto — une gestão macro + micro em um sistema | 2–4 semanas após correções críticas |
| **Implantação em horas** | Alto — concorrentes têm processo de onboarding longo | Já possível; documentar e automatizar |
| **Protocolo clínico + IA preditiva de risco** | Muito alto longo prazo | 6–12 meses; dados precisam estar em tabelas antes |

---

## Apêndice: Perfil PinPec (dados públicos 2026-05-14)

| Campo | Valor |
|---|---|
| Municípios clientes | 65+ |
| Equipes atendidas | 270+ |
| População beneficiada | 615.000+ |
| Produto core | Gestão de indicadores Previne Brasil + e-SUS na AWS |
| Tecnologia declarada | AWS, e-SUS AB Território |
| Integração regulatória | Portaria GM/MS 3.493/2024 |
| Preço | Não divulgado |
| IA | Não mencionado |
| LGPD técnico | Não mencionado |
| Prontuário próprio | Não (usa e-SUS externo) |
| Treinamento | Serviço dedicado com profissionais experientes |
| Canais de venda | WhatsApp + telefone direto CEO/Comercial |

---

*Análise baseada em dados públicos e auditoria interna. Nenhum código foi alterado. Nenhum commit foi criado.*
