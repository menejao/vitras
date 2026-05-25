export const id = "005_patient_cpf_cns_unique";

export async function up(client) {
  // Check for existing CPF duplicates before creating constraint
  const cpfDuplicates = await client.query(`
    SELECT payload->>'cpf' AS cpf, COUNT(*) AS cnt
    FROM app_patients
    WHERE payload->>'cpf' IS NOT NULL
      AND payload->>'cpf' != ''
      AND (payload->>'inactive')::boolean IS NOT TRUE
    GROUP BY payload->>'cpf'
    HAVING COUNT(*) > 1
  `);

  if (cpfDuplicates.rows.length > 0) {
    const dupes = cpfDuplicates.rows.map(r => `${r.cpf} (${r.cnt}x)`).join(", ");
    throw new Error(`Migration 005 abortada: CPFs duplicados encontrados antes de criar índice único: ${dupes}. Corrija os duplicados manualmente antes de prosseguir.`);
  }

  const cnsDuplicates = await client.query(`
    SELECT payload->>'cns' AS cns, COUNT(*) AS cnt
    FROM app_patients
    WHERE payload->>'cns' IS NOT NULL
      AND payload->>'cns' != ''
      AND (payload->>'inactive')::boolean IS NOT TRUE
    GROUP BY payload->>'cns'
    HAVING COUNT(*) > 1
  `);

  if (cnsDuplicates.rows.length > 0) {
    const dupes = cnsDuplicates.rows.map(r => `${r.cns} (${r.cnt}x)`).join(", ");
    throw new Error(`Migration 005 abortada: CNS duplicados encontrados antes de criar índice único: ${dupes}. Corrija os duplicados manualmente antes de prosseguir.`);
  }

  // Partial unique index: only non-empty, non-inactive CPF
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_patients_cpf_unique
    ON app_patients ((payload->>'cpf'))
    WHERE payload->>'cpf' IS NOT NULL
      AND payload->>'cpf' != ''
      AND (payload->>'inactive')::boolean IS NOT TRUE
  `);

  // Partial unique index: only non-empty, non-inactive CNS
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_patients_cns_unique
    ON app_patients ((payload->>'cns'))
    WHERE payload->>'cns' IS NOT NULL
      AND payload->>'cns' != ''
      AND (payload->>'inactive')::boolean IS NOT TRUE
  `);
}
