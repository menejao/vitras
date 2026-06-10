const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans', Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 32px 40px; max-width: 800px; margin: 0 auto; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 22px; }
  .doc-header__brand { font-size: 18px; font-weight: 700; letter-spacing: -.5px; color: #111; }
  .doc-header__unit { font-size: 11px; color: #555; margin-top: 3px; }
  .doc-header__meta { text-align: right; font-size: 11px; color: #555; line-height: 1.6; }
  .doc-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #111; margin-bottom: 18px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
  .doc-patient { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; }
  .doc-patient__name { font-size: 15px; font-weight: 600; color: #111; margin-bottom: 6px; }
  .doc-patient__meta { display: flex; gap: 20px; flex-wrap: wrap; }
  .doc-patient__field { font-size: 11px; color: #555; }
  .doc-patient__field strong { color: #111; font-weight: 500; }
  .doc-section { margin-bottom: 16px; }
  .doc-section__label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .8px; color: #888; margin-bottom: 5px; }
  .doc-section__value { font-size: 13px; color: #111; line-height: 1.6; }
  .doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px; margin-bottom: 16px; }
  .doc-divider { border: none; border-top: 1px solid #e5e5e5; margin: 18px 0; }
  .doc-items { margin: 0; padding: 0; list-style: none; }
  .doc-items li { padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .doc-items li:last-child { border-bottom: none; }
  .doc-items__num { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: #111; color: #fff; border-radius: 50%; font-size: 10px; font-weight: 700; margin-right: 8px; flex-shrink: 0; }
  .doc-items__name { font-weight: 600; }
  .doc-items__detail { color: #666; font-size: 12px; margin-top: 3px; padding-left: 28px; }
  .doc-body-text { font-size: 13px; color: #111; line-height: 1.9; padding: 16px; border: 1px solid #e5e5e5; border-radius: 6px; background: #fafafa; }
  .doc-notice { margin-top: 16px; padding: 10px 14px; border: 1px solid #e5e5e5; border-radius: 5px; font-size: 11px; color: #666; line-height: 1.6; }
  .doc-footer { margin-top: 48px; display: flex; justify-content: space-between; align-items: flex-end; }
  .doc-footer__left { font-size: 11px; color: #777; }
  .doc-footer__sig { text-align: center; }
  .doc-footer__sig-line { border-top: 1px solid #333; width: 240px; margin: 0 auto 8px; }
  .doc-footer__sig-name { font-size: 12px; font-weight: 600; color: #111; }
  .doc-footer__sig-sub { font-size: 11px; color: #555; margin-top: 2px; }
  .doc-watermark { font-size: 10px; color: #aaa; margin-top: 6px; }
  @media print {
    body { padding: 0; }
    @page { margin: 20mm; }
  }
`;

function calcAgeYears(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate + "T00:00:00");
  const now = new Date();
  let y = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) y--;
  return y;
}

function fmtBirthDate(iso) {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

function patientBlock(patient) {
  const dob = fmtBirthDate(patient?.birthDate);
  const age = calcAgeYears(patient?.birthDate);
  const fields = [
    dob ? `<span class="doc-patient__field"><strong>DN:</strong> ${dob}${age !== null ? ` (${age} anos)` : ""}</span>` : "",
    patient?.cns ? `<span class="doc-patient__field"><strong>CNS:</strong> ${patient.cns}</span>` : "",
    patient?.cpf ? `<span class="doc-patient__field"><strong>CPF:</strong> ${patient.cpf}</span>` : "",
  ].filter(Boolean).join("");

  return `
    <div class="doc-patient">
      <div class="doc-patient__name">${patient?.name || "—"}</div>
      ${fields ? `<div class="doc-patient__meta">${fields}</div>` : ""}
    </div>
  `;
}

function openPrintWindow(html) {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

function header(title, { unitName = "Unidade de Saúde", teamName = "", date = new Date().toLocaleDateString("pt-BR") } = {}) {
  return `
    <div class="doc-header">
      <div>
        <div class="doc-header__brand">Vitras · Saúde Pública</div>
        <div class="doc-header__unit">${unitName}${teamName ? ` · ${teamName}` : ""}</div>
      </div>
      <div class="doc-header__meta">
        Data: ${date}<br/>Documento gerado por sistema informatizado
      </div>
    </div>
    <div class="doc-title">${title}</div>
  `;
}

function footer({ professionalName, councilLabel, councilNumber, councilUf, unitName } = {}) {
  const council = councilNumber ? `${councilLabel || "CRM"} ${councilNumber}${councilUf ? `/${councilUf}` : ""}` : "";
  return `
    <div class="doc-footer">
      <div class="doc-footer__left">
        ${unitName || ""}<br/>
        <span class="doc-watermark">Gerado por Vitras · ${new Date().toLocaleString("pt-BR")}</span>
      </div>
      <div class="doc-footer__sig">
        <div class="doc-footer__sig-line"></div>
        <div class="doc-footer__sig-name">${professionalName || "_________________________"}</div>
        ${council ? `<div class="doc-footer__sig-sub">${council}</div>` : ""}
      </div>
    </div>
  `;
}

export function printExamRequest({ patient, items = [], justification, professional, unit, team }) {
  const itemsHtml = items.length
    ? `<ul class="doc-items">${items.map((item, idx) => `
        <li>
          <span class="doc-items__num">${idx + 1}</span>
          <span class="doc-items__name">${item.name || item}</span>
          ${item.detail ? `<div class="doc-items__detail">${item.detail}</div>` : ""}
        </li>`).join("")}</ul>`
    : `<p style="color:#888;">Nenhum exame especificado.</p>`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Pedido de Exame</title><style>${CSS}</style></head><body>
    ${header("Pedido de Exame", { unitName: unit?.name, teamName: team?.name })}
    ${patientBlock(patient)}
    <div class="doc-section">
      <div class="doc-section__label">Exames Solicitados</div>
      ${itemsHtml}
    </div>
    ${justification ? `<div class="doc-section"><div class="doc-section__label">Justificativa / Hipótese Diagnóstica</div><div class="doc-section__value">${justification}</div></div>` : ""}
    ${footer({ professionalName: professional?.name, councilLabel: professional?.councilType, councilNumber: professional?.councilNumber, councilUf: professional?.councilUf, unitName: unit?.name })}
  </body></html>`;

  openPrintWindow(html);
}

export function printPrescription({ patient, medications = [], notes, validity, professional, unit, team }) {
  const medsHtml = medications.length
    ? `<ul class="doc-items">${medications.map((m, idx) => {
        const name = m.name || m;
        const dosage = m.dosage ? ` — ${m.dosage}` : "";
        const instructions = m.instructions || m.detail || "";
        return `<li>
          <span class="doc-items__num">${idx + 1}</span>
          <span class="doc-items__name">${name}${dosage}</span>
          ${instructions ? `<div class="doc-items__detail">${instructions}</div>` : ""}
        </li>`;
      }).join("")}</ul>`
    : `<p style="color:#888;">Nenhum medicamento especificado.</p>`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Prescrição Médica</title><style>${CSS}</style></head><body>
    ${header("Prescrição Médica", { unitName: unit?.name, teamName: team?.name })}
    ${patientBlock(patient)}
    <div class="doc-section">
      <div class="doc-section__label">Medicamentos Prescritos</div>
      ${medsHtml}
    </div>
    ${notes ? `<div class="doc-section"><div class="doc-section__label">Observações</div><div class="doc-section__value">${notes}</div></div>` : ""}
    <div class="doc-notice">
      Validade: <strong>${validity || 30} dias</strong> a partir da data de emissão. Dispensação sujeita à apresentação de documento de identificação.
    </div>
    ${footer({ professionalName: professional?.name, councilLabel: professional?.councilType, councilNumber: professional?.councilNumber, councilUf: professional?.councilUf, unitName: unit?.name })}
  </body></html>`;

  openPrintWindow(html);
}

export function printAttendanceAttest({ patient, professional, unit, team }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Declaração de Comparecimento</title><style>${CSS}</style></head><body>
    ${header("Declaração de Comparecimento", { unitName: unit?.name, teamName: team?.name, date: dateStr })}
    ${patientBlock(patient)}
    <div class="doc-section">
      <div class="doc-body-text">
        Atesto, para os devidos fins, que o(a) paciente acima identificado(a) compareceu nesta unidade de saúde na data de <strong>${dateStr}</strong>, às <strong>${timeStr}h</strong>, para atendimento/acompanhamento em serviço de saúde. Por ser verdade, firmo o presente.
      </div>
    </div>
    ${footer({ professionalName: professional?.name, councilLabel: professional?.councilType, councilNumber: professional?.councilNumber, councilUf: professional?.councilUf, unitName: unit?.name })}
  </body></html>`;

  openPrintWindow(html);
}

export function printVaccineCard({ patient, vaccineRows = [], extraApplied = [], unit, team }) {
  const fmtIso = iso => iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const rowsHtml = vaccineRows.length
    ? vaccineRows.map(v => `
        <tr>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:12px;font-weight:600;color:${v.applied ? "#111" : "#555"};">${v.name}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#666;">${v.doseLabel || ""}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;color:${v.applied ? "#16a34a" : "#aaa"};">${v.applied ? (v.date || "—") : "Não aplicada"}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#666;">${v.by || ""}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" style="padding:12px;color:#aaa;text-align:center;font-size:12px;">Nenhuma vacina indicada para este paciente.</td></tr>`;

  const extraHtml = extraApplied.length
    ? `<div class="doc-section" style="margin-top:20px;">
        <div class="doc-section__label">Outras aplicações registradas</div>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          ${extraApplied.map(a => `<tr>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:12px;font-weight:500;">${a.title || "—"}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#16a34a;">${fmtIso(a.date)}</td>
          </tr>`).join("")}
        </table>
      </div>`
    : "";

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Carteira de Vacinas</title><style>${CSS}</style></head><body>
    ${header("Carteira de Vacinação", { unitName: unit?.name, teamName: team?.name })}
    ${patientBlock(patient)}
    <div class="doc-section">
      <div class="doc-section__label">Calendário Nacional de Vacinação (PNI)</div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="text-align:left;padding:6px 8px;font-size:10px;color:#666;font-weight:600;letter-spacing:.5px;border-bottom:1px solid #e5e5e5;">VACINA</th>
            <th style="text-align:left;padding:6px 8px;font-size:10px;color:#666;font-weight:600;letter-spacing:.5px;border-bottom:1px solid #e5e5e5;">DOSE</th>
            <th style="text-align:left;padding:6px 8px;font-size:10px;color:#666;font-weight:600;letter-spacing:.5px;border-bottom:1px solid #e5e5e5;">DATA</th>
            <th style="text-align:left;padding:6px 8px;font-size:10px;color:#666;font-weight:600;letter-spacing:.5px;border-bottom:1px solid #e5e5e5;">PROFISSIONAL</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    ${extraHtml}
    <div class="doc-notice">
      Documento gerado com base nos registros clínicos do sistema Vitras. Não substitui a caderneta oficial de vacinação.
    </div>
    ${footer({ unitName: unit?.name })}
  </body></html>`;

  openPrintWindow(html);
}

export function printMedicalAttest({ patient, days, cid, observations, professional, unit, team }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Atestado Médico</title><style>${CSS}</style></head><body>
    ${header("Atestado Médico", { unitName: unit?.name, teamName: team?.name, date: dateStr })}
    ${patientBlock(patient)}
    <div class="doc-section">
      <div class="doc-body-text">
        Atesto, para os devidos fins, que o(a) paciente acima identificado(a) encontra-se sob acompanhamento em atendimento de saúde, necessitando de afastamento de suas atividades habituais por <strong>${days ? `${days} dia(s)` : "_____ dia(s)"}</strong>, a partir desta data.
      </div>
    </div>
    ${cid ? `<div class="doc-section" style="margin-top:14px;"><div class="doc-section__label">CID-10</div><div class="doc-section__value">${cid}</div></div>` : ""}
    ${observations ? `<div class="doc-section"><div class="doc-section__label">Observações</div><div class="doc-section__value">${observations}</div></div>` : ""}
    ${footer({ professionalName: professional?.name, councilLabel: professional?.councilType, councilNumber: professional?.councilNumber, councilUf: professional?.councilUf, unitName: unit?.name })}
  </body></html>`;

  openPrintWindow(html);
}
