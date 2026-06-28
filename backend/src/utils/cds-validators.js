// CDS field validators — CNS, CPF, sexAtBirth
// Used by export-batch.js and cds-export.js (individual routes)

/**
 * Validate CNS (Cartão Nacional de Saúde) — official algorithm.
 * Valid: 15 numeric digits starting with 1, 2, 7, 8, or 9.
 * Source: Portaria MS 940/2011.
 */
export function isValidCns(cns) {
  if (!cns) return false;
  const digits = String(cns).replace(/\D/g, "");
  if (digits.length !== 15) return false;
  if (!/^[1289]/.test(digits)) return false;

  let total = 0;
  for (let i = 0; i < 15; i++) total += parseInt(digits[i], 10) * (15 - i);
  return total % 11 === 0;
}

/**
 * Validate CPF — official check digit algorithm.
 * Rejects all-same-digit sequences.
 */
export function isValidCpf(cpf) {
  if (!cpf) return false;
  const digits = String(cpf).replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(digits[10], 10);
}

/**
 * Resolve the sex field for CDS export.
 * Canonical field: sexAtBirth. Fallbacks: sex, gender (legacy).
 */
export function resolveSexField(entity) {
  return entity?.sexAtBirth || entity?.sex || entity?.gender || null;
}
