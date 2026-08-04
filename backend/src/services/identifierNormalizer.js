/**
 * identifierNormalizer.js — P0-3: Normalização centralizada de identificadores de login.
 *
 * Regras:
 *   - E-mail: trim + lowercase
 *   - CNS: trim + remover não-dígitos
 *   - CPF: trim + remover não-dígitos
 *   - VitrasId: trim (já é numérico)
 *   - Senha: NUNCA normalizar (case-sensitive, espaços preservados)
 *
 * Um helper por tipo. Nunca misturar normalização de senha aqui.
 */

/**
 * Normaliza e-mail: trim + lowercase.
 * @param {string} raw
 * @returns {string}
 */
function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

/**
 * Normaliza CNS (Cartão Nacional de Saúde): trim + remove non-digits.
 * CNS válido tem 15 dígitos.
 * @param {string} raw
 * @returns {string}
 */
function normalizeCns(raw) {
  return String(raw || "").trim().replace(/\D/g, "");
}

/**
 * Normaliza CPF: trim + remove non-digits.
 * CPF válido tem 11 dígitos.
 * @param {string} raw
 * @returns {string}
 */
function normalizeCpf(raw) {
  return String(raw || "").trim().replace(/\D/g, "");
}

/**
 * Normaliza VitrasId: apenas trim.
 * VitrasId é exatamente 9 dígitos numéricos.
 * @param {string} raw
 * @returns {string}
 */
function normalizeVitrasId(raw) {
  return String(raw || "").trim();
}

/**
 * Detecta o tipo de identificador com base no formato.
 * Retorna: 'vitrasId' | 'email' | 'cnpf' (CPF/CNS) | 'unknown'
 * @param {string} raw
 * @returns {'vitrasId'|'email'|'cpf'|'cns'|'unknown'}
 */
function detectIdentifierType(raw) {
  const s = String(raw || "").trim();
  if (/^\d{9}$/.test(s)) return "vitrasId";
  if (/^\d{11}$/.test(s.replace(/\D/g, "")) && /[.\-]/.test(s)) return "cpf";
  if (/^\d{11}$/.test(s.replace(/\D/g, ""))) return "cpf";
  if (/^\d{15}$/.test(s.replace(/\D/g, ""))) return "cns";
  if (s.includes("@")) return "email";
  return "unknown";
}

/**
 * Normaliza qualquer identificador de login para comparação.
 * NÃO normaliza senhas — use exclusivamente para identificadores.
 * @param {string} raw
 * @returns {{ normalized: string, type: string }}
 */
function normalizeLoginIdentifier(raw) {
  const s = String(raw || "").trim();
  const type = detectIdentifierType(s);

  switch (type) {
    case "vitrasId":
      return { normalized: normalizeVitrasId(s), type };
    case "email":
      return { normalized: normalizeEmail(s), type };
    case "cns":
      return { normalized: normalizeCns(s), type };
    case "cpf":
      return { normalized: normalizeCpf(s), type };
    default:
      // Unknown: try lowercase + trim as fallback
      return { normalized: s.toLowerCase(), type };
  }
}

export {
  normalizeEmail,
  normalizeCns,
  normalizeCpf,
  normalizeVitrasId,
  detectIdentifierType,
  normalizeLoginIdentifier,
};
