# LGPD Organizational Compliance Checklist

This checklist covers obligations under Lei Geral de Proteção de Dados (Lei 13.709/2018) for a healthcare SaaS processing sensitive personal data of patients.

**Legal basis for processing:** Art. 11, II, f — treatment of health data necessary for protection of life or health of patients by healthcare professionals.

---

## 1. Governance

- [ ] Appoint a **Data Protection Officer (DPO / Encarregado)** — Art. 41
  - Internal nomination or outsourced specialist
  - Publish name and contact on website privacy policy
- [ ] Maintain a **Record of Processing Activities (ROPA)** — Art. 37
  - Document: purpose, legal basis, data categories, retention periods, recipients
- [ ] Conduct a **Data Protection Impact Assessment (DPIA / RIPD)** before processing — Art. 38
  - Health data is sensitive (Art. 5, II) and requires heightened care

## 2. Legal basis and consent

- [ ] Confirm legal basis for each processing activity in ROPA
- [ ] For any marketing/communications outside care: obtain explicit consent (Art. 7, I)
- [ ] Maintain records of consent with timestamp and version of terms accepted

## 3. Privacy notice

- [ ] Publish **Política de Privacidade** in plain language — Art. 9
  - What data is collected and why
  - How long data is retained
  - Whether data is shared with third parties (councils, backup providers)
  - Contact for data subject rights requests
- [ ] Link privacy policy at account registration and in app footer
- [ ] Version-stamp the policy; re-obtain consent when material changes occur

## 4. Data subject rights (Art. 18)

The system already implements `/admin/privacy-requests`. Verify the following:

- [ ] **Confirmação de existência** — user can confirm whether their data is processed
- [ ] **Acesso** — user can download their data (export endpoint)
- [ ] **Correção** — user can update personal data in profile
- [ ] **Anonimização / Eliminação** — process for deleting or anonymizing data on request
  - Exception: data required for legal obligation (medical records — CFM Resolução 1821/2007, 20-year retention)
- [ ] **Portabilidade** — JSON export of patient record available via backup endpoint
- [ ] **Revogação de consentimento** — user can withdraw consent; service continues under legal basis health exception
- [ ] **Oposição** — user can object to processing for legitimate interest
- [ ] Define SLA for responding to rights requests: **15 days** (ANPD guidance)
- [ ] Log all rights requests in `privacyRequests` collection (already in schema)

## 5. Third-party processors (Art. 46 / 48)

- [ ] Sign **Data Processing Agreement (DPA)** with:
  - **Neon** (database) — confirm sub-processor list and data residency
  - **Render** (hosting) — confirm DPA and region (US by default; consider BR/EU if required)
  - **Upstash** (Redis rate-limit cache) — note: stores IP addresses, session metadata
  - **n8n / council verification provider** — CPF/name sent externally for council lookup
- [ ] Confirm data is not transferred outside Brazil/EU without adequacy decision or contractual safeguards — Art. 33

## 6. Security measures (Art. 46)

Technical measures already in place:

| Measure | Status |
|---|---|
| AES-256-GCM encryption at rest (CPF, CNS, 2FA secrets) | ✅ implemented |
| scrypt password hashing | ✅ implemented |
| JWT with 12 h expiry + refresh token rotation | ✅ implemented |
| TOTP 2FA | ✅ implemented |
| Audit log for all sensitive operations | ✅ implemented |
| Rate limiting (per-IP + Upstash) | ✅ implemented |
| HTTPS (TLS via Render/Cloudflare) | ✅ via hosting |
| Key rotation procedure | ✅ KEY_ROTATION_PLAN.md |

Organizational measures to complete:

- [ ] Define access control policy: who can access patient data and under what conditions
- [ ] Restrict production database access to named individuals only
- [ ] Annual security review / penetration test
- [ ] Incident response plan (see next section)

## 7. Incident response (Art. 48)

- [ ] Write an **Incident Response Plan**:
  - Definition of a reportable incident (unauthorized access to sensitive data)
  - Detection → containment → notification timeline
- [ ] ANPD breach notification: within **72 hours** of awareness (Art. 48, § 1)
  - Notify affected data subjects as soon as feasible
  - Report to ANPD via: https://www.gov.br/anpd/
- [ ] Log all incidents in a dedicated register with: date, nature, affected records, actions taken

## 8. Retention and deletion

- [ ] Define retention periods per data category:
  - Patient clinical records: **minimum 20 years** (CFM 1821/2007)
  - Audit logs: **5 years** (recommended for legal evidence)
  - Inactive user accounts: **2 years** from last login, then delete or anonymize
  - Login challenge and refresh tokens: already purged on expiry
- [ ] Automate deletion of expired data (manual process acceptable for current scale)

## 9. Training and culture

- [ ] Train all staff on LGPD obligations and internal data handling procedures
- [ ] Include data protection clauses in employment contracts / NDA
- [ ] Annual refresher training

## 10. ANPD registration

- [ ] Determine if organization qualifies as a **controller** (controlador) — yes, as the entity that decides purposes and means of processing
- [ ] Monitor ANPD guidance on SME obligations (small healthcare operators may have reduced requirements)
- [ ] Register processing activities if/when ANPD makes registration mandatory

---

## Status summary

| Area | Status |
|---|---|
| Technical security | Largely complete — see table above |
| DPO appointment | Pending |
| ROPA / DPIA | Pending |
| Privacy notice | Pending |
| Data subject rights workflow | Partial — backend endpoints exist, UI flow needed |
| Third-party DPAs | Pending |
| Incident response plan | Pending |
| Retention policy | Defined above, automation pending |
