// Política de Privacidade — VITRAS APS
// Página pública em /privacidade
// DPO: João Pedro Menegucci Benedito · lgpd@vitras.com.br
import { useEffect } from "react";
import { BrandLockup } from "../components/brand/BrandLockup";

const LAST_UPDATED = "18 de junho de 2026";
const DPO_NAME    = "João Pedro Menegucci Benedito";
const DPO_EMAIL   = "lgpd@vitras.com.br";
const PRIVACY_URL = "https://vitras.com.br/privacidade";

const NAV_ITEMS = [
  { id: "quem-somos",       label: "Quem somos" },
  { id: "papeis-lgpd",      label: "Papéis LGPD" },
  { id: "dados-tratados",   label: "Dados tratados" },
  { id: "dados-saude",      label: "Dados de saúde" },
  { id: "nome-social",      label: "Nome social" },
  { id: "finalidades",      label: "Finalidades" },
  { id: "compartilhamento", label: "Compartilhamento" },
  { id: "esus",             label: "Exportação e-SUS" },
  { id: "seguranca",        label: "Segurança" },
  { id: "retencao",         label: "Retenção" },
  { id: "direitos",         label: "Direitos dos titulares" },
  { id: "dpo",              label: "Encarregado (DPO)" },
  { id: "contato",          label: "Contato" },
];

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function PrivacyPage() {
  // SEO — atualiza <head> dinamicamente
  useEffect(() => {
    const prevTitle = document.title;
    const prevDesc  = document.querySelector('meta[name="description"]');
    const prevOgTitle = document.querySelector('meta[property="og:title"]');
    const prevOgDesc  = document.querySelector('meta[property="og:description"]');
    const prevOgUrl   = document.querySelector('meta[property="og:url"]');
    const prevCanon   = document.querySelector('link[rel="canonical"]');

    document.title = "Política de Privacidade | VITRAS APS";

    function setMeta(sel, val) {
      const el = document.querySelector(sel);
      if (el) el.setAttribute("content", val);
    }
    function setLink(sel, val) {
      const el = document.querySelector(sel);
      if (el) el.setAttribute("href", val);
    }

    setMeta('meta[name="description"]',
      "Política de Privacidade do VITRAS APS. Informações sobre tratamento de dados pessoais, dados sensíveis de saúde, LGPD, segurança e direitos dos titulares.");
    setMeta('meta[property="og:title"]',      "Política de Privacidade | VITRAS APS");
    setMeta('meta[property="og:description"]',
      "Como tratamos seus dados pessoais e de saúde. Conformidade com LGPD, dados sensíveis, exportação e-SUS e direitos dos titulares.");
    setMeta('meta[property="og:url"]', PRIVACY_URL);
    setLink('link[rel="canonical"]',   PRIVACY_URL);

    return () => {
      document.title = prevTitle;
      if (prevDesc)    prevDesc.setAttribute("content", prevDesc.getAttribute("content") || "");
      if (prevOgTitle) prevOgTitle.setAttribute("content", "VITRAS");
      if (prevOgDesc)  prevOgDesc.setAttribute("content", "Plataforma integrada para gestão da saúde pública.");
      if (prevOgUrl)   prevOgUrl.setAttribute("content", "https://app.vitras.com.br");
      if (prevCanon)   prevCanon.setAttribute("href", "https://app.vitras.com.br");
    };
  }, []);

  return (
    <div className="priv-root">
      {/* ── Topbar ── */}
      <header className="priv-topbar" role="banner">
        <div className="priv-topbar__inner container">
          <a href="/" className="priv-topbar__logo" aria-label="VITRAS — página inicial">
            <BrandLockup variant="primary-dark" className="priv-logo" />
          </a>
          <nav className="priv-topbar__nav" aria-label="Navegação principal">
            <a href="/" className="priv-topbar__link">Entrar na plataforma</a>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="priv-hero" aria-labelledby="priv-hero-title">
        <div className="priv-hero__glow-1" aria-hidden="true" />
        <div className="priv-hero__glow-2" aria-hidden="true" />
        <div className="container priv-hero__inner">
          <span className="priv-eyebrow">Privacidade e Proteção de Dados</span>
          <h1 id="priv-hero-title" className="priv-hero__title">
            Política de Privacidade
          </h1>
          <p className="priv-hero__sub">
            Transparência sobre como tratamos dados pessoais e dados sensíveis de saúde
            no VITRAS APS, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>
          <div className="priv-hero__meta">
            <span className="priv-badge">LGPD · Lei 13.709/2018</span>
            <span className="priv-badge">APS / e-SUS</span>
            <span className="priv-badge">Dados de saúde — Art. 11</span>
          </div>
          <p className="priv-hero__updated">
            Última atualização: <strong>{LAST_UPDATED}</strong>
          </p>
        </div>
      </section>

      {/* ── Body: sidebar + content ── */}
      <div className="container priv-body">
        {/* Sidebar de navegação — desktop */}
        <aside className="priv-sidebar" aria-label="Índice da política">
          <nav>
            <p className="priv-sidebar__label">Nesta página</p>
            <ul className="priv-sidebar__list" role="list">
              {NAV_ITEMS.map(item => (
                <li key={item.id}>
                  <button
                    className="priv-sidebar__link"
                    onClick={() => scrollTo(item.id)}
                    type="button"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Conteúdo principal */}
        <main className="priv-content" id="main-content">

          {/* 1. Quem somos */}
          <section id="quem-somos" className="priv-section" aria-labelledby="s-quem-somos">
            <h2 id="s-quem-somos">1. Quem somos</h2>
            <p>
              O <strong>VITRAS APS</strong> é uma plataforma de gestão para Atenção Primária à Saúde
              desenvolvida e operada pela <strong>VITRAS</strong>{" "}
              (CNPJ: [CNPJ será informado após formalização empresarial]),
              destinada a Municípios, Secretarias de Saúde e Unidades Básicas de Saúde (UBS).
            </p>
            <p>
              A plataforma viabiliza o cadastro de pacientes e domicílios, o registro de atendimentos
              clínicos e a exportação de fichas para o sistema e-SUS APS do Ministério da Saúde.
            </p>
          </section>

          {/* 2. Papéis LGPD */}
          <section id="papeis-lgpd" className="priv-section" aria-labelledby="s-papeis">
            <h2 id="s-papeis">2. Papéis na LGPD</h2>
            <p>
              O VITRAS APS opera dentro de uma cadeia de responsabilidades definida pela LGPD:
            </p>
            <div className="priv-table-wrap">
              <table className="priv-table" role="table" aria-label="Papéis LGPD">
                <thead>
                  <tr>
                    <th scope="col">Papel</th>
                    <th scope="col">Quem é</th>
                    <th scope="col">Responsabilidade principal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Controlador</strong></td>
                    <td>Município / Secretaria de Saúde / UBS</td>
                    <td>Define as finalidades e os meios do tratamento de dados dos pacientes</td>
                  </tr>
                  <tr>
                    <td><strong>Operador</strong></td>
                    <td>VITRAS</td>
                    <td>Trata dados em nome e sob instruções do Controlador</td>
                  </tr>
                  <tr>
                    <td><strong>Titular</strong></td>
                    <td>Pacientes, profissionais, responsáveis familiares</td>
                    <td>Pessoa a quem os dados se referem — titular dos direitos</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Para fins de gestão administrativa interna própria (dados de funcionários, suporte e
              gestão contratual), o VITRAS atua como Controlador.
            </p>
          </section>

          {/* 3. Dados tratados */}
          <section id="dados-tratados" className="priv-section" aria-labelledby="s-dados">
            <h2 id="s-dados">3. Dados pessoais tratados</h2>

            <h3>3.1 Dados de Pacientes</h3>
            <div className="priv-table-wrap">
              <table className="priv-table" role="table" aria-label="Dados de pacientes">
                <thead>
                  <tr>
                    <th scope="col">Categoria</th>
                    <th scope="col">Exemplos</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Identificação</td>
                    <td>Nome completo, nome social, data de nascimento, sexo, raça/cor</td>
                  </tr>
                  <tr>
                    <td>Documentos</td>
                    <td>CPF, CNS (Cartão Nacional de Saúde), NIS</td>
                  </tr>
                  <tr>
                    <td>Contato</td>
                    <td>Telefone, e-mail</td>
                  </tr>
                  <tr>
                    <td>Endereço</td>
                    <td>Logradouro, complemento, CEP, município, microárea</td>
                  </tr>
                  <tr>
                    <td>Família</td>
                    <td>Nome da mãe, CNS do responsável familiar</td>
                  </tr>
                  <tr>
                    <td>Cadastro domiciliar</td>
                    <td>Tipo de imóvel, condições de moradia, número de moradores</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>3.2 Dados de Profissionais de Saúde</h3>
            <p>
              CNS do profissional, CBO, vínculo com unidade (CNES/INE), registros de acesso e auditoria.
              Esses dados são tratados para controle de acesso e rastreabilidade dos atendimentos.
            </p>
          </section>

          {/* 4. Dados de saúde — OBRIGATÓRIO */}
          <section id="dados-saude" className="priv-section priv-section--highlight" aria-labelledby="s-saude">
            <h2 id="s-saude">4. Dados de Saúde e Dados Sensíveis</h2>
            <p>
              Os dados abaixo são classificados como <strong>dados sensíveis</strong> nos termos do
              Art. 11 da LGPD e recebem proteções técnicas específicas:
            </p>
            <ul className="priv-list">
              <li>Condições de saúde: diagnósticos (CID-10) e problemas registrados (CIAP-2)</li>
              <li>Indicadores de HIV em gestante</li>
              <li>Indicadores de sífilis</li>
              <li>Raça/cor</li>
              <li>Deficiência</li>
              <li>Situação de rua</li>
              <li>Identidade de gênero (quando declarada voluntariamente)</li>
            </ul>
            <div className="priv-callout" role="note" aria-label="Proteções técnicas para dados sensíveis">
              <strong>Proteções técnicas aplicadas:</strong>
              <ul className="priv-list priv-list--compact">
                <li>Criptografia AES-256-GCM nos campos CPF, CNS e NIS</li>
                <li>Diagnósticos (CID-10, CIAP-2), HIV e sífilis não aparecem em logs de auditoria</li>
                <li>Acesso restrito por perfil clínico (RBAC) — médicos, enfermeiros e profissionais autorizados</li>
                <li>Rastreabilidade completa de quem acessou cada dado</li>
              </ul>
            </div>
            <p>
              A base legal para tratamento de dados sensíveis de saúde é a{" "}
              <strong>tutela da saúde (Art. 11, II, "f" da LGPD)</strong> e, nos casos aplicáveis,
              a <strong>obrigação legal</strong> (Art. 11, II, "a").
            </p>
          </section>

          {/* 5. Nome social — OBRIGATÓRIO */}
          <section id="nome-social" className="priv-section priv-section--highlight" aria-labelledby="s-nome-social">
            <h2 id="s-nome-social">5. Nome Social e Respeito à Identidade de Gênero</h2>
            <p>
              O VITRAS APS adota o <strong>nome social como identidade operacional</strong> de
              pacientes que o declaram. Isso significa:
            </p>
            <ul className="priv-list">
              <li>
                O nome social é exibido em todas as interfaces para profissionais de saúde —
                recepção, prontuário, atendimento e listas de espera.
              </li>
              <li>
                O nome civil é armazenado para fins de conformidade com obrigações legais,
                mas <strong>não é exibido em superfícies operacionais</strong>.
              </li>
              <li>
                Profissionais de saúde que acessam a plataforma veem apenas o nome social,
                salvo em contextos específicos exigidos por lei.
              </li>
              <li>
                Dados de identidade de gênero são tratados com base em consentimento voluntário
                e <strong>não são incluídos em logs de auditoria detalhados</strong>.
              </li>
            </ul>
            <p>
              Esse controle visa reduzir o risco de discriminação e garantir atendimento
              humanizado, em consonância com as orientações do Ministério da Saúde para
              atenção a pessoas LGBTQIA+ na rede pública de saúde.
            </p>
          </section>

          {/* 6. Finalidades */}
          <section id="finalidades" className="priv-section" aria-labelledby="s-final">
            <h2 id="s-final">6. Finalidades do Tratamento e Bases Legais</h2>
            <div className="priv-table-wrap">
              <table className="priv-table" role="table" aria-label="Finalidades e bases legais">
                <thead>
                  <tr>
                    <th scope="col">Finalidade</th>
                    <th scope="col">Base legal provável (LGPD)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Cadastro e gestão de pacientes na APS</td>
                    <td>Obrigação legal (Art. 7º, II) / Tutela da saúde (Art. 11, II, "f")</td>
                  </tr>
                  <tr>
                    <td>Registro de atendimentos clínicos</td>
                    <td>Obrigação legal / Tutela da saúde</td>
                  </tr>
                  <tr>
                    <td>Exportação CDS para e-SUS / SISAB</td>
                    <td>Obrigação legal (Portaria MS 1.412/2013)</td>
                  </tr>
                  <tr>
                    <td>Controle de acesso e autenticação</td>
                    <td>Execução de contrato (Art. 7º, V) / Legítimo interesse</td>
                  </tr>
                  <tr>
                    <td>Auditoria e rastreabilidade</td>
                    <td>Obrigação legal / Legítimo interesse do controlador</td>
                  </tr>
                  <tr>
                    <td>Suporte técnico</td>
                    <td>Execução de contrato (Art. 7º, V)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 7. Compartilhamento */}
          <section id="compartilhamento" className="priv-section" aria-labelledby="s-comp">
            <h2 id="s-comp">7. Compartilhamento de Dados</h2>
            <div className="priv-table-wrap">
              <table className="priv-table" role="table" aria-label="Compartilhamento de dados">
                <thead>
                  <tr>
                    <th scope="col">Destinatário</th>
                    <th scope="col">Finalidade</th>
                    <th scope="col">Base</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>PEC e-SUS APS (Ministério da Saúde)</td>
                    <td>Exportação CDS — obrigação SISAB</td>
                    <td>Obrigação legal</td>
                  </tr>
                  <tr>
                    <td>AWS (Amazon Web Services) — região sa-east-1 (Brasil)</td>
                    <td>Hospedagem, banco de dados PostgreSQL, backups e monitoramento (CloudWatch)</td>
                    <td>Contrato como suboperador — dados hospedados no Brasil</td>
                  </tr>
                  <tr>
                    <td>Equipe técnica VITRAS</td>
                    <td>Diagnóstico de incidentes técnicos</td>
                    <td>Contrato + princípio do mínimo necessário</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="priv-callout priv-callout--info" role="note">
              O VITRAS <strong>não vende, não compartilha para fins comerciais e não cede</strong> dados
              pessoais de pacientes ou profissionais a terceiros fora dos casos acima.
              Toda a infraestrutura está hospedada no Brasil (AWS sa-east-1),
              sem transferência internacional de dados.
            </p>
          </section>

          {/* 8. Exportação e-SUS — OBRIGATÓRIO */}
          <section id="esus" className="priv-section priv-section--highlight" aria-labelledby="s-esus">
            <h2 id="s-esus">8. Exportação de Dados para o e-SUS APS</h2>
            <p>
              O módulo <strong>CDS Export</strong> do VITRAS APS permite ao Município exportar fichas
              de cadastro e atendimento no formato LEDI APS 7.4.x (ficheiro <code>.esus</code>) para
              importação no <strong>PEC e-SUS APS do Ministério da Saúde</strong>, cumprindo a
              obrigação de alimentação do SISAB (Portaria MS nº 1.412/2013).
            </p>
            <h3>Como funciona:</h3>
            <ul className="priv-list">
              <li>
                A exportação é realizada exclusivamente por usuários com permissão específica
                (<em>gestor</em> ou <em>administrador</em>) — nunca por profissionais clínicos sem essa permissão.
              </li>
              <li>
                Toda exportação é registrada no <strong>log de auditoria</strong> da plataforma,
                com identificação do usuário, data, hora e tipo de ficha exportada.
              </li>
              <li>
                Após a importação no PEC, os dados ficam sob a <strong>governança do Ministério
                da Saúde</strong>, fora do escopo de operação do VITRAS.
              </li>
              <li>
                Diagnósticos sensíveis (CID-10, CIAP-2, HIV, sífilis) são transmitidos como
                exigido pela ficha oficial LEDI, mas <strong>não aparecem nos logs de auditoria
                internos</strong> do VITRAS.
              </li>
            </ul>
            <p>
              O módulo CDS Export requer que a UBS utilize{" "}
              <strong>PEC e-SUS APS versão 5.4.36 ou superior</strong>. A versão do PEC é
              verificada antes da ativação do módulo em cada unidade.
            </p>
          </section>

          {/* 9. Segurança */}
          <section id="seguranca" className="priv-section" aria-labelledby="s-seg">
            <h2 id="s-seg">9. Segurança dos Dados</h2>
            <p>Adotamos medidas técnicas e organizacionais proporcionais ao risco:</p>
            <ul className="priv-list priv-list--grid">
              <li>
                <strong>Criptografia em trânsito</strong>
                <span>HTTPS/TLS em todas as comunicações</span>
              </li>
              <li>
                <strong>Criptografia em repouso</strong>
                <span>AES-256-GCM nos campos CPF, CNS e NIS</span>
              </li>
              <li>
                <strong>Controle de acesso (RBAC)</strong>
                <span>Perfil por função clínica — cada profissional acessa apenas o que sua função permite</span>
              </li>
              <li>
                <strong>Audit log imutável</strong>
                <span>Cadeia SHA-256 encadeada — todos os eventos são rastreados e não podem ser alterados</span>
              </li>
              <li>
                <strong>Autenticação segura</strong>
                <span>JWT com expiração automática e suporte a autenticação de dois fatores (2FA)</span>
              </li>
              <li>
                <strong>Acesso de emergência auditado</strong>
                <span>Acesso privilegiado (break-glass) gera log automático e é restrito a administradores</span>
              </li>
              <li>
                <strong>Isolamento por município</strong>
                <span>Dados de cada contratante são isolados — um município não acessa dados de outro</span>
              </li>
              <li>
                <strong>Infraestrutura no Brasil</strong>
                <span>AWS sa-east-1 (São Paulo) — backups automáticos e monitoramento contínuo (CloudWatch)</span>
              </li>
            </ul>
          </section>

          {/* 10. Retenção */}
          <section id="retencao" className="priv-section" aria-labelledby="s-ret">
            <h2 id="s-ret">10. Retenção de Dados</h2>
            <div className="priv-table-wrap">
              <table className="priv-table" role="table" aria-label="Prazos de retenção">
                <thead>
                  <tr>
                    <th scope="col">Tipo de dado</th>
                    <th scope="col">Prazo mínimo de retenção</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Dados assistenciais de pacientes</td>
                    <td>Conforme obrigação legal do Controlador (mínimo 20 anos — CFM Res. 2.299/2021)</td>
                  </tr>
                  <tr>
                    <td>Logs de auditoria</td>
                    <td>Mínimo 5 anos</td>
                  </tr>
                  <tr>
                    <td>Logs técnicos de sistema</td>
                    <td>90 dias</td>
                  </tr>
                  <tr>
                    <td>Dados de suporte técnico</td>
                    <td>Enquanto durar o contrato + 2 anos</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Após o encerramento do contrato com o Município, os dados assistenciais são
              devolvidos ao Controlador em formato exportável. O VITRAS não elimina dados
              assistenciais por solicitação direta sem validação do Controlador municipal,
              respeitando as obrigações legais de retenção aplicáveis à saúde pública.
            </p>
          </section>

          {/* 11. Direitos dos titulares */}
          <section id="direitos" className="priv-section" aria-labelledby="s-dir">
            <h2 id="s-dir">11. Direitos dos Titulares</h2>
            <p>
              Conforme o Art. 18 da LGPD, você tem os seguintes direitos em relação aos seus dados:
            </p>
            <ul className="priv-list">
              <li>Confirmação da existência de tratamento</li>
              <li>Acesso aos seus dados</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados</li>
              <li>Anonimização, bloqueio ou eliminação (sujeito a exceções legais em saúde pública)</li>
              <li>Portabilidade dos dados (quando regulamentado pela ANPD)</li>
              <li>Informação sobre compartilhamento com terceiros</li>
              <li>Revogação do consentimento (quando o tratamento se baseia em consentimento)</li>
              <li>Oposição ao tratamento, em casos previstos em lei</li>
            </ul>

            <div className="priv-callout" role="note" aria-label="Como exercer seus direitos">
              <strong>Como exercer seus direitos:</strong>
              <p>
                Como o VITRAS atua principalmente como <strong>Operador</strong>, a maioria das
                solicitações relativas a dados assistenciais deve ser dirigida ao{" "}
                <strong>Controlador</strong> — o Município ou a Secretaria de Saúde responsável
                pelo seu atendimento.
              </p>
              <p>
                Para dúvidas sobre como o VITRAS trata seus dados, ou para exercer direitos que
                sejam de nossa competência direta, entre em contato pelo canal do DPO:
              </p>
              <p>
                <a href={`mailto:${DPO_EMAIL}`} className="priv-link">
                  {DPO_EMAIL}
                </a>
              </p>
              <p>Prazo de resposta: até 15 dias corridos (Art. 18, §3º LGPD).</p>
            </div>

            <p>
              Algumas solicitações podem ser limitadas ou recusadas com fundamento legal —
              por exemplo, a eliminação de dados de prontuário está sujeita à obrigação legal
              de retenção mínima de 20 anos. Nesses casos, o DPO informará por escrito
              o fundamento da limitação e o direito de reclamar à ANPD.
            </p>
          </section>

          {/* 12. DPO */}
          <section id="dpo" className="priv-section" aria-labelledby="s-dpo">
            <h2 id="s-dpo">12. Encarregado de Proteção de Dados (DPO)</h2>
            <p>
              Conforme o Art. 41 da LGPD, o VITRAS designou um Encarregado de Proteção de Dados:
            </p>
            <div className="priv-dpo-card">
              <div className="priv-dpo-card__avatar" aria-hidden="true">DPO</div>
              <div className="priv-dpo-card__info">
                <strong>{DPO_NAME}</strong>
                <span>Encarregado de Proteção de Dados — VITRAS APS</span>
                <a href={`mailto:${DPO_EMAIL}`} className="priv-link priv-dpo-card__email">
                  {DPO_EMAIL}
                </a>
                <span className="priv-dpo-card__sla">
                  Resposta em até 15 dias corridos · Dias úteis
                </span>
              </div>
            </div>
            <p>
              O canal do DPO está disponível para reclamações de titulares, comunicações com
              a ANPD e dúvidas sobre esta política.
            </p>
          </section>

          {/* 13. Contato */}
          <section id="contato" className="priv-section" aria-labelledby="s-contato">
            <h2 id="s-contato">13. Contato e Atualização da Política</h2>
            <p>
              Para questões sobre privacidade e proteção de dados, utilize o canal do DPO:
            </p>
            <p>
              <strong>E-mail DPO:</strong>{" "}
              <a href={`mailto:${DPO_EMAIL}`} className="priv-link">{DPO_EMAIL}</a>
            </p>
            <p>
              Esta política pode ser atualizada a qualquer momento. Alterações relevantes serão
              comunicadas aos Controladores contratantes com antecedência mínima de 15 dias.
              A versão vigente está sempre disponível em{" "}
              <a href={PRIVACY_URL} className="priv-link">{PRIVACY_URL}</a>.
            </p>
            <p className="priv-updated-footer">
              Versão vigente desde <strong>{LAST_UPDATED}</strong>
            </p>
          </section>

        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="priv-footer" role="contentinfo">
        <div className="container priv-footer__inner">
          <div className="priv-footer__brand">
            <BrandLockup variant="compact-dark" className="priv-footer-logo" />
            <p className="priv-footer__tagline">
              Plataforma integrada para gestão da saúde pública
            </p>
          </div>
          <nav className="priv-footer__links" aria-label="Links do rodapé">
            <a href="/" className="priv-footer__link">Entrar na plataforma</a>
            <a href="/privacidade" className="priv-footer__link priv-footer__link--active" aria-current="page">
              Política de Privacidade
            </a>
            <a href={`mailto:${DPO_EMAIL}`} className="priv-footer__link">
              {DPO_EMAIL}
            </a>
          </nav>
          <p className="priv-footer__legal">
            CFM 1638/2002 · Lei 13.787/2018 · <strong>LGPD Lei 13.709/2018</strong> ·
            PNAB 2.436/2017 · ANVISA RDC 20/2011
          </p>
        </div>
      </footer>
    </div>
  );
}
