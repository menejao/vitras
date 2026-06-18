import {
  roleNeedsCouncil,
  councilTypeForRole,
  isRepeatedDigits,
  isSequentialDigits,
  VALID_UF
} from "./helpers.js";

function validateCouncilData(role, councilNumber, councilUf) {
  if (!roleNeedsCouncil(role)) {
    return { ok: true };
  }

  const number = String(councilNumber || "").trim();
  const uf = String(councilUf || "").trim().toUpperCase();
  const councilType = councilTypeForRole(role);
  const numberDigits = number.replace(/\D/g, "");

  const minLen = councilType === "CRM" ? 4 : 4;
  const maxLen = councilType === "CRM" ? 8 : 10;

  if (!new RegExp(`^\\d{${minLen},${maxLen}}$`).test(numberDigits)) {
    return {
      ok: false,
      message: `${councilType} deve ter entre ${minLen} e ${maxLen} digitos`
    };
  }

  if (isRepeatedDigits(numberDigits)) {
    return { ok: false, message: "Número do conselho inválido (dígitos repetidos)" };
  }

  if (isSequentialDigits(numberDigits)) {
    return { ok: false, message: "Número do conselho inválido (sequência numérica)" };
  }

  if (!VALID_UF.has(uf)) {
    return { ok: false, message: "UF do conselho inválida" };
  }

  return { ok: true, councilNumber: numberDigits, councilUf: uf };
}

function getCouncilIntegrationConfig() {
  const mode = String(process.env.COUNCIL_VERIFY_MODE || "optional").trim().toLowerCase();
  const url = String(process.env.COUNCIL_VERIFY_URL || "").trim();
  const token = String(process.env.COUNCIL_VERIFY_TOKEN || "").trim();
  const timeoutMs = Number(process.env.COUNCIL_VERIFY_TIMEOUT_MS || 7000);
  const retries = Number(process.env.COUNCIL_VERIFY_RETRIES || 2);
  const provider = String(process.env.COUNCIL_VERIFY_PROVIDER || "generic").trim().toLowerCase();
  const requireEvidence = String(process.env.COUNCIL_VERIFY_REQUIRE_EVIDENCE || "true").trim().toLowerCase();

  return {
    mode: ["off", "optional", "required"].includes(mode) ? mode : "optional",
    provider: ["generic", "n8n", "make"].includes(provider) ? provider : "generic",
    url,
    token,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 1000 ? timeoutMs : 7000,
    retries: Number.isFinite(retries) ? Math.max(0, Math.min(5, Math.floor(retries))) : 2,
    requireEvidence: !["0", "false", "no", "off"].includes(requireEvidence)
  };
}

function normalizeProviderResponse(provider, data) {
  if (provider === "n8n") {
    const base = Array.isArray(data) ? (data[0] || {}) : data;
    const valid = base.valid === true || base.approved === true || base.status === "approved";
    return {
      valid,
      provider: base.provider || "n8n",
      error: base.error || (valid ? "" : "Conselho não aprovado no n8n"),
      details: base
    };
  }

  if (provider === "make") {
    const base = data?.result || data;
    const valid = base.valid === true || base.is_valid === true || base.outcome === "approved";
    return {
      valid,
      provider: base.provider || "make",
      error: base.error || (valid ? "" : "Conselho não aprovado no Make"),
      details: base
    };
  }

  return {
    valid: data && data.valid === true,
    provider: data?.provider || "external-http",
    error: data?.error || "",
    details: data
  };
}

function pickFirstValue(source, keys = []) {
  if (!source || typeof source !== "object") return "";
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function normalizeCouncilEvidence(details = {}) {
  const flat = details && typeof details === "object" ? details : {};
  const numberRaw = pickFirstValue(flat, [
    "councilNumber", "council_number", "registrationNumber", "registration_number",
    "number", "crm", "coren"
  ]);
  const ufRaw = pickFirstValue(flat, [
    "councilUf", "council_uf", "registrationUf", "registration_uf", "uf", "state"
  ]);
  const statusRaw = pickFirstValue(flat, [
    "status", "registrationStatus", "registration_status", "situation"
  ]);
  const professionalName = pickFirstValue(flat, [
    "professionalName", "professional_name", "name", "fullName", "full_name"
  ]);
  return {
    number: numberRaw.replace(/\D/g, ""),
    uf: ufRaw.toUpperCase(),
    status: statusRaw,
    professionalName
  };
}

async function verifyCouncilExternally(payload) {
  const config = getCouncilIntegrationConfig();

  if (config.mode === "off") {
    return { checked: false, valid: true, provider: "disabled", status: "skipped" };
  }

  if (!config.url) {
    if (config.mode === "required") {
      return {
        checked: false, valid: false, provider: "missing-url", status: "error",
        error: "Integração externa de conselho não configurada"
      };
    }
    return { checked: false, valid: true, provider: "missing-url", status: "skipped" };
  }

  const headers = { "Content-Type": "application/json" };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  let lastUnavailableError = "";
  const maxAttempts = Math.max(1, config.retries + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(config.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const data = await response.json().catch(() => ({}));
      const normalized = normalizeProviderResponse(config.provider, data);

      if (!response.ok) {
        const retriable = response.status >= 500 || response.status === 429;
        if (retriable && attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
          continue;
        }
        if (config.mode === "required") {
          return {
            checked: true, valid: false, provider: normalized.provider, status: "error",
            error: normalized.error || `Falha ao validar conselho no provedor externo (HTTP ${response.status})`
          };
        }
        return { checked: true, valid: true, provider: data.provider || "external-http", status: "fallback" };
      }

      if (normalized.valid && config.requireEvidence) {
        const evidence = normalizeCouncilEvidence(normalized.details);
        if (!evidence.number || !evidence.uf) {
          return {
            checked: true, valid: false, provider: normalized.provider, status: "rejected",
            error: "Provedor não retornou evidência mínima do conselho"
          };
        }
        const expectedNumber = String(payload.councilNumber || "").replace(/\D/g, "");
        const expectedUf = String(payload.councilUf || "").trim().toUpperCase();
        if (evidence.number !== expectedNumber || evidence.uf !== expectedUf) {
          return {
            checked: true, valid: false, provider: normalized.provider, status: "rejected",
            error: "Conselho retornado pelo provedor não confere com número/UF informados"
          };
        }
      }

      return {
        checked: true,
        valid: normalized.valid,
        provider: normalized.provider,
        status: normalized.valid ? "verified" : "rejected",
        details: normalized.details
      };
    } catch (error) {
      lastUnavailableError = error?.name === "AbortError"
        ? `timeout de ${config.timeoutMs}ms`
        : (error?.message || "erro de rede");
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  if (config.mode === "required") {
    return {
      checked: true, valid: false, provider: "external-http", status: "error",
      error: `Integração de validação de conselho indisponível (${lastUnavailableError || "sem resposta"})`
    };
  }

  return { checked: true, valid: true, provider: "external-http", status: "fallback" };
}

export {
  validateCouncilData,
  getCouncilIntegrationConfig,
  normalizeProviderResponse,
  pickFirstValue,
  normalizeCouncilEvidence,
  verifyCouncilExternally
};
