// Catálogo central de medicamentos da rede pública.
// Baseado na RENAME (Relação Nacional de Medicamentos Essenciais) e padronização municipal/SUS.
// Contextos: "medicina" | "enfermagem" | "odontologia"

export const MEDICATION_CATALOG = [
  // ── Antibióticos ────────────────────────────────────────────
  { id: "amox-500", nome: "Amoxicilina 500mg cápsula", principioAtivo: "Amoxicilina", concentracao: "500mg", forma: "Cápsula", via: "Oral", categoria: "Antibiótico", dosagemPadrao: "500mg", posologia: "1 cápsula de 8 em 8 horas por 7 dias", contextos: ["medicina", "enfermagem", "odontologia"] },
  { id: "amox-875", nome: "Amoxicilina + Clavulanato 875/125mg comprimido", principioAtivo: "Amoxicilina + Clavulanato", concentracao: "875/125mg", forma: "Comprimido", via: "Oral", categoria: "Antibiótico", dosagemPadrao: "875/125mg", posologia: "1 comprimido de 12 em 12 horas por 7 dias", contextos: ["medicina", "odontologia"] },
  { id: "azit-500", nome: "Azitromicina 500mg comprimido", principioAtivo: "Azitromicina", concentracao: "500mg", forma: "Comprimido", via: "Oral", categoria: "Antibiótico", dosagemPadrao: "500mg", posologia: "1 comprimido 1x ao dia por 3 dias", contextos: ["medicina", "odontologia"] },
  { id: "cefa-500", nome: "Cefalexina 500mg cápsula", principioAtivo: "Cefalexina", concentracao: "500mg", forma: "Cápsula", via: "Oral", categoria: "Antibiótico", dosagemPadrao: "500mg", posologia: "1 cápsula de 6 em 6 horas por 7 dias", contextos: ["medicina", "odontologia"] },
  { id: "cipro-500", nome: "Ciprofloxacino 500mg comprimido", principioAtivo: "Ciprofloxacino", concentracao: "500mg", forma: "Comprimido", via: "Oral", categoria: "Antibiótico", dosagemPadrao: "500mg", posologia: "1 comprimido de 12 em 12 horas por 7 dias", contextos: ["medicina"] },
  { id: "clinda-300", nome: "Clindamicina 300mg cápsula", principioAtivo: "Clindamicina", concentracao: "300mg", forma: "Cápsula", via: "Oral", categoria: "Antibiótico", dosagemPadrao: "300mg", posologia: "1 cápsula de 6 em 6 horas por 7 dias", contextos: ["medicina", "odontologia"] },
  { id: "dox-100", nome: "Doxiciclina 100mg cápsula", principioAtivo: "Doxiciclina", concentracao: "100mg", forma: "Cápsula", via: "Oral", categoria: "Antibiótico", dosagemPadrao: "100mg", posologia: "1 cápsula de 12 em 12 horas por 7 dias", contextos: ["medicina", "odontologia"] },
  { id: "metro-250", nome: "Metronidazol 250mg comprimido", principioAtivo: "Metronidazol", concentracao: "250mg", forma: "Comprimido", via: "Oral", categoria: "Antibiótico", dosagemPadrao: "250mg", posologia: "1 comprimido de 8 em 8 horas por 7 dias", contextos: ["medicina", "odontologia"] },
  { id: "metro-400", nome: "Metronidazol 400mg comprimido", principioAtivo: "Metronidazol", concentracao: "400mg", forma: "Comprimido", via: "Oral", categoria: "Antibiótico", dosagemPadrao: "400mg", posologia: "1 comprimido de 8 em 8 horas por 7 dias", contextos: ["medicina", "odontologia"] },
  { id: "sulfa-trimeto", nome: "Sulfametoxazol + Trimetoprim 800/160mg comprimido", principioAtivo: "Sulfametoxazol + Trimetoprim", concentracao: "800/160mg", forma: "Comprimido", via: "Oral", categoria: "Antibiótico", dosagemPadrao: "800/160mg", posologia: "1 comprimido de 12 em 12 horas por 7 dias", contextos: ["medicina"] },
  { id: "iver-6", nome: "Ivermectina 6mg comprimido", principioAtivo: "Ivermectina", concentracao: "6mg", forma: "Comprimido", via: "Oral", categoria: "Antiparasitário", dosagemPadrao: "6mg", posologia: "Dose única (200mcg/kg)", contextos: ["medicina", "enfermagem"] },

  // ── Antifúngicos e Antivirais ────────────────────────────────
  { id: "flu-150", nome: "Fluconazol 150mg cápsula", principioAtivo: "Fluconazol", concentracao: "150mg", forma: "Cápsula", via: "Oral", categoria: "Antifúngico", dosagemPadrao: "150mg", posologia: "Dose única", contextos: ["medicina", "odontologia"] },
  { id: "nist-susp", nome: "Nistatina suspensão oral 100.000UI/mL", principioAtivo: "Nistatina", concentracao: "100.000UI/mL", forma: "Suspensão oral", via: "Oral", categoria: "Antifúngico", dosagemPadrao: "500.000UI", posologia: "5mL de 6 em 6 horas por 10 dias", contextos: ["medicina", "odontologia"] },
  { id: "aciclo-200", nome: "Aciclovir 200mg comprimido", principioAtivo: "Aciclovir", concentracao: "200mg", forma: "Comprimido", via: "Oral", categoria: "Antiviral", dosagemPadrao: "200mg", posologia: "1 comprimido de 4 em 4 horas (5x/dia) por 5 dias", contextos: ["medicina", "odontologia"] },
  { id: "aciclo-400", nome: "Aciclovir 400mg comprimido", principioAtivo: "Aciclovir", concentracao: "400mg", forma: "Comprimido", via: "Oral", categoria: "Antiviral", dosagemPadrao: "400mg", posologia: "1 comprimido de 8 em 8 horas por 7-10 dias", contextos: ["medicina"] },

  // ── Analgésicos e Anti-inflamatórios ────────────────────────
  { id: "para-500", nome: "Paracetamol 500mg comprimido", principioAtivo: "Paracetamol", concentracao: "500mg", forma: "Comprimido", via: "Oral", categoria: "Analgésico/Antipirético", dosagemPadrao: "500mg", posologia: "1-2 comprimidos de 6 em 6 horas (máx 4g/dia)", contextos: ["medicina", "enfermagem", "odontologia"] },
  { id: "para-750", nome: "Paracetamol 750mg comprimido", principioAtivo: "Paracetamol", concentracao: "750mg", forma: "Comprimido", via: "Oral", categoria: "Analgésico/Antipirético", dosagemPadrao: "750mg", posologia: "1 comprimido de 8 em 8 horas", contextos: ["medicina", "odontologia"] },
  { id: "dipi-500", nome: "Dipirona 500mg comprimido", principioAtivo: "Dipirona sódica", concentracao: "500mg", forma: "Comprimido", via: "Oral", categoria: "Analgésico/Antipirético", dosagemPadrao: "500mg", posologia: "1-2 comprimidos de 6 em 6 horas", contextos: ["medicina", "enfermagem", "odontologia"] },
  { id: "ibu-400", nome: "Ibuprofeno 400mg comprimido", principioAtivo: "Ibuprofeno", concentracao: "400mg", forma: "Comprimido", via: "Oral", categoria: "Anti-inflamatório/AINE", dosagemPadrao: "400mg", posologia: "1 comprimido de 8 em 8 horas (com refeição)", contextos: ["medicina", "odontologia"] },
  { id: "ibu-600", nome: "Ibuprofeno 600mg comprimido", principioAtivo: "Ibuprofeno", concentracao: "600mg", forma: "Comprimido", via: "Oral", categoria: "Anti-inflamatório/AINE", dosagemPadrao: "600mg", posologia: "1 comprimido de 8 em 8 horas (com refeição)", contextos: ["medicina", "odontologia"] },
  { id: "diclo-50", nome: "Diclofenaco 50mg comprimido revestido", principioAtivo: "Diclofenaco sódico", concentracao: "50mg", forma: "Comprimido revestido", via: "Oral", categoria: "Anti-inflamatório/AINE", dosagemPadrao: "50mg", posologia: "1 comprimido de 8 em 8 horas (com refeição)", contextos: ["medicina", "odontologia"] },
  { id: "nimes-100", nome: "Nimesulida 100mg comprimido", principioAtivo: "Nimesulida", concentracao: "100mg", forma: "Comprimido", via: "Oral", categoria: "Anti-inflamatório/AINE", dosagemPadrao: "100mg", posologia: "1 comprimido de 12 em 12 horas (com refeição, máx 15 dias)", contextos: ["medicina", "odontologia"] },
  { id: "cetoro-10", nome: "Cetorolaco 10mg comprimido", principioAtivo: "Cetorolaco trometamina", concentracao: "10mg", forma: "Comprimido", via: "Oral", categoria: "Anti-inflamatório/AINE", dosagemPadrao: "10mg", posologia: "1 comprimido de 6 em 6 horas por até 5 dias", contextos: ["medicina", "odontologia"] },
  { id: "trama-50", nome: "Tramadol 50mg cápsula", principioAtivo: "Tramadol cloridrato", concentracao: "50mg", forma: "Cápsula", via: "Oral", categoria: "Analgésico Opioide", dosagemPadrao: "50mg", posologia: "1 cápsula de 6 em 6 horas (máx 400mg/dia)", contextos: ["medicina", "odontologia"] },
  { id: "code-30", nome: "Codeína 30mg comprimido", principioAtivo: "Codeína fosfato", concentracao: "30mg", forma: "Comprimido", via: "Oral", categoria: "Analgésico Opioide", dosagemPadrao: "30mg", posologia: "1 comprimido de 4 em 4 horas (máx 240mg/dia)", contextos: ["medicina"] },

  // ── Corticosteroides ────────────────────────────────────────
  { id: "pred-5", nome: "Prednisona 5mg comprimido", principioAtivo: "Prednisona", concentracao: "5mg", forma: "Comprimido", via: "Oral", categoria: "Corticosteroide", dosagemPadrao: "5-60mg", posologia: "Conforme prescrição médica (doses variáveis)", contextos: ["medicina", "odontologia"] },
  { id: "pred-20", nome: "Prednisona 20mg comprimido", principioAtivo: "Prednisona", concentracao: "20mg", forma: "Comprimido", via: "Oral", categoria: "Corticosteroide", dosagemPadrao: "20mg", posologia: "1 comprimido 1x ao dia pela manhã (conforme prescrição)", contextos: ["medicina", "odontologia"] },
  { id: "dexa-4", nome: "Dexametasona 4mg comprimido", principioAtivo: "Dexametasona", concentracao: "4mg", forma: "Comprimido", via: "Oral", categoria: "Corticosteroide", dosagemPadrao: "4mg", posologia: "1 comprimido de 6 em 6 horas (conforme prescrição)", contextos: ["medicina", "odontologia"] },

  // ── Anti-hipertensivos ────────────────────────────────────────
  { id: "cap-25", nome: "Captopril 25mg comprimido", principioAtivo: "Captopril", concentracao: "25mg", forma: "Comprimido", via: "Oral", categoria: "Anti-hipertensivo/IECA", dosagemPadrao: "25mg", posologia: "1 comprimido de 8 em 8 horas (em jejum)", contextos: ["medicina", "enfermagem"] },
  { id: "cap-50", nome: "Captopril 50mg comprimido", principioAtivo: "Captopril", concentracao: "50mg", forma: "Comprimido", via: "Oral", categoria: "Anti-hipertensivo/IECA", dosagemPadrao: "50mg", posologia: "1 comprimido de 12 em 12 horas (em jejum)", contextos: ["medicina", "enfermagem"] },
  { id: "ena-5", nome: "Enalapril 5mg comprimido", principioAtivo: "Enalapril maleato", concentracao: "5mg", forma: "Comprimido", via: "Oral", categoria: "Anti-hipertensivo/IECA", dosagemPadrao: "5mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "ena-10", nome: "Enalapril 10mg comprimido", principioAtivo: "Enalapril maleato", concentracao: "10mg", forma: "Comprimido", via: "Oral", categoria: "Anti-hipertensivo/IECA", dosagemPadrao: "10mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "ena-20", nome: "Enalapril 20mg comprimido", principioAtivo: "Enalapril maleato", concentracao: "20mg", forma: "Comprimido", via: "Oral", categoria: "Anti-hipertensivo/IECA", dosagemPadrao: "20mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "losa-50", nome: "Losartana 50mg comprimido", principioAtivo: "Losartana potássica", concentracao: "50mg", forma: "Comprimido", via: "Oral", categoria: "Anti-hipertensivo/BRA", dosagemPadrao: "50mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "losa-100", nome: "Losartana 100mg comprimido", principioAtivo: "Losartana potássica", concentracao: "100mg", forma: "Comprimido", via: "Oral", categoria: "Anti-hipertensivo/BRA", dosagemPadrao: "100mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "aml-5", nome: "Anlodipino 5mg comprimido", principioAtivo: "Besilato de anlodipino", concentracao: "5mg", forma: "Comprimido", via: "Oral", categoria: "Anti-hipertensivo/BCC", dosagemPadrao: "5mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "aml-10", nome: "Anlodipino 10mg comprimido", principioAtivo: "Besilato de anlodipino", concentracao: "10mg", forma: "Comprimido", via: "Oral", categoria: "Anti-hipertensivo/BCC", dosagemPadrao: "10mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "aten-25", nome: "Atenolol 25mg comprimido", principioAtivo: "Atenolol", concentracao: "25mg", forma: "Comprimido", via: "Oral", categoria: "Beta-bloqueador", dosagemPadrao: "25mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "aten-50", nome: "Atenolol 50mg comprimido", principioAtivo: "Atenolol", concentracao: "50mg", forma: "Comprimido", via: "Oral", categoria: "Beta-bloqueador", dosagemPadrao: "50mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "hctz-25", nome: "Hidroclorotiazida 25mg comprimido", principioAtivo: "Hidroclorotiazida", concentracao: "25mg", forma: "Comprimido", via: "Oral", categoria: "Diurético/Tiazídico", dosagemPadrao: "25mg", posologia: "1 comprimido 1x ao dia pela manhã", contextos: ["medicina", "enfermagem"] },
  { id: "furo-40", nome: "Furosemida 40mg comprimido", principioAtivo: "Furosemida", concentracao: "40mg", forma: "Comprimido", via: "Oral", categoria: "Diurético de alça", dosagemPadrao: "40mg", posologia: "1 comprimido 1x ao dia pela manhã", contextos: ["medicina", "enfermagem"] },
  { id: "espiro-25", nome: "Espironolactona 25mg comprimido", principioAtivo: "Espironolactona", concentracao: "25mg", forma: "Comprimido", via: "Oral", categoria: "Diurético/Poupador K+", dosagemPadrao: "25mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina"] },
  { id: "carve-625", nome: "Carvedilol 6,25mg comprimido", principioAtivo: "Carvedilol", concentracao: "6,25mg", forma: "Comprimido", via: "Oral", categoria: "Beta-bloqueador", dosagemPadrao: "6,25mg", posologia: "1 comprimido de 12 em 12 horas (com refeição)", contextos: ["medicina"] },
  { id: "carve-125", nome: "Carvedilol 12,5mg comprimido", principioAtivo: "Carvedilol", concentracao: "12,5mg", forma: "Comprimido", via: "Oral", categoria: "Beta-bloqueador", dosagemPadrao: "12,5mg", posologia: "1 comprimido de 12 em 12 horas", contextos: ["medicina"] },

  // ── Antidiabéticos ────────────────────────────────────────────
  { id: "metf-500", nome: "Metformina 500mg comprimido", principioAtivo: "Cloridrato de metformina", concentracao: "500mg", forma: "Comprimido", via: "Oral", categoria: "Antidiabético", dosagemPadrao: "500mg", posologia: "1 comprimido de 12 em 12 horas (com refeição)", contextos: ["medicina", "enfermagem"] },
  { id: "metf-850", nome: "Metformina 850mg comprimido", principioAtivo: "Cloridrato de metformina", concentracao: "850mg", forma: "Comprimido", via: "Oral", categoria: "Antidiabético", dosagemPadrao: "850mg", posologia: "1 comprimido 2-3x ao dia (com refeição)", contextos: ["medicina", "enfermagem"] },
  { id: "glibe-5", nome: "Glibenclamida 5mg comprimido", principioAtivo: "Glibenclamida", concentracao: "5mg", forma: "Comprimido", via: "Oral", categoria: "Antidiabético/Sulfonilureia", dosagemPadrao: "5mg", posologia: "1 comprimido 1x ao dia (antes do café da manhã)", contextos: ["medicina", "enfermagem"] },
  { id: "glica-30", nome: "Glicazida 30mg comprimido MR", principioAtivo: "Glicazida", concentracao: "30mg", forma: "Comprimido MR", via: "Oral", categoria: "Antidiabético/Sulfonilureia", dosagemPadrao: "30mg", posologia: "1-2 comprimidos 1x ao dia (café da manhã)", contextos: ["medicina"] },
  { id: "ins-nph", nome: "Insulina NPH 100UI/mL suspensão injetável", principioAtivo: "Insulina isofânica", concentracao: "100UI/mL", forma: "Suspensão injetável", via: "Subcutânea", categoria: "Antidiabético/Insulina", dosagemPadrao: "Conforme prescrição", posologia: "Conforme orientação médica", contextos: ["medicina", "enfermagem"] },
  { id: "ins-reg", nome: "Insulina Regular 100UI/mL solução injetável", principioAtivo: "Insulina humana regular", concentracao: "100UI/mL", forma: "Solução injetável", via: "Subcutânea", categoria: "Antidiabético/Insulina", dosagemPadrao: "Conforme prescrição", posologia: "Conforme orientação médica", contextos: ["medicina", "enfermagem"] },

  // ── Hipolipemiantes ───────────────────────────────────────────
  { id: "sinva-20", nome: "Sinvastatina 20mg comprimido", principioAtivo: "Sinvastatina", concentracao: "20mg", forma: "Comprimido", via: "Oral", categoria: "Hipolipemiante/Estatina", dosagemPadrao: "20mg", posologia: "1 comprimido 1x ao dia à noite", contextos: ["medicina", "enfermagem"] },
  { id: "sinva-40", nome: "Sinvastatina 40mg comprimido", principioAtivo: "Sinvastatina", concentracao: "40mg", forma: "Comprimido", via: "Oral", categoria: "Hipolipemiante/Estatina", dosagemPadrao: "40mg", posologia: "1 comprimido 1x ao dia à noite", contextos: ["medicina", "enfermagem"] },
  { id: "ator-20", nome: "Atorvastatina 20mg comprimido", principioAtivo: "Atorvastatina cálcica", concentracao: "20mg", forma: "Comprimido", via: "Oral", categoria: "Hipolipemiante/Estatina", dosagemPadrao: "20mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "ator-40", nome: "Atorvastatina 40mg comprimido", principioAtivo: "Atorvastatina cálcica", concentracao: "40mg", forma: "Comprimido", via: "Oral", categoria: "Hipolipemiante/Estatina", dosagemPadrao: "40mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina"] },
  { id: "rosu-10", nome: "Rosuvastatina 10mg comprimido", principioAtivo: "Rosuvastatina cálcica", concentracao: "10mg", forma: "Comprimido", via: "Oral", categoria: "Hipolipemiante/Estatina", dosagemPadrao: "10mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina"] },
  { id: "rosu-20", nome: "Rosuvastatina 20mg comprimido", principioAtivo: "Rosuvastatina cálcica", concentracao: "20mg", forma: "Comprimido", via: "Oral", categoria: "Hipolipemiante/Estatina", dosagemPadrao: "20mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina"] },

  // ── Hormônios / Tireóide ──────────────────────────────────────
  { id: "levo-25", nome: "Levotiroxina 25mcg comprimido", principioAtivo: "Levotiroxina sódica", concentracao: "25mcg", forma: "Comprimido", via: "Oral", categoria: "Hormônio/Tireóide", dosagemPadrao: "25mcg", posologia: "1 comprimido 1x ao dia em jejum (30min antes do café)", contextos: ["medicina", "enfermagem"] },
  { id: "levo-50", nome: "Levotiroxina 50mcg comprimido", principioAtivo: "Levotiroxina sódica", concentracao: "50mcg", forma: "Comprimido", via: "Oral", categoria: "Hormônio/Tireóide", dosagemPadrao: "50mcg", posologia: "1 comprimido 1x ao dia em jejum", contextos: ["medicina", "enfermagem"] },
  { id: "levo-100", nome: "Levotiroxina 100mcg comprimido", principioAtivo: "Levotiroxina sódica", concentracao: "100mcg", forma: "Comprimido", via: "Oral", categoria: "Hormônio/Tireóide", dosagemPadrao: "100mcg", posologia: "1 comprimido 1x ao dia em jejum", contextos: ["medicina"] },

  // ── Gastrointestinais ─────────────────────────────────────────
  { id: "ome-20", nome: "Omeprazol 20mg cápsula", principioAtivo: "Omeprazol", concentracao: "20mg", forma: "Cápsula", via: "Oral", categoria: "Inibidor de bomba de prótons", dosagemPadrao: "20mg", posologia: "1 cápsula 1x ao dia em jejum (30min antes do café)", contextos: ["medicina", "enfermagem", "odontologia"] },
  { id: "ome-40", nome: "Omeprazol 40mg cápsula", principioAtivo: "Omeprazol", concentracao: "40mg", forma: "Cápsula", via: "Oral", categoria: "Inibidor de bomba de prótons", dosagemPadrao: "40mg", posologia: "1 cápsula 1x ao dia em jejum", contextos: ["medicina"] },
  { id: "metoclo-10", nome: "Metoclopramida 10mg comprimido", principioAtivo: "Cloridrato de metoclopramida", concentracao: "10mg", forma: "Comprimido", via: "Oral", categoria: "Antiemético/Procinético", dosagemPadrao: "10mg", posologia: "1 comprimido de 8 em 8 horas (30min antes das refeições)", contextos: ["medicina", "enfermagem"] },
  { id: "onda-4", nome: "Ondansetrona 4mg comprimido", principioAtivo: "Ondansetrona cloridrato", concentracao: "4mg", forma: "Comprimido", via: "Oral", categoria: "Antiemético", dosagemPadrao: "4mg", posologia: "1 comprimido de 8 em 8 horas", contextos: ["medicina", "enfermagem"] },
  { id: "onda-8", nome: "Ondansetrona 8mg comprimido", principioAtivo: "Ondansetrona cloridrato", concentracao: "8mg", forma: "Comprimido", via: "Oral", categoria: "Antiemético", dosagemPadrao: "8mg", posologia: "1 comprimido de 12 em 12 horas", contextos: ["medicina"] },

  // ── Suplementos e Vitaminas ───────────────────────────────────
  { id: "acfo-5", nome: "Ácido fólico 5mg comprimido", principioAtivo: "Ácido fólico", concentracao: "5mg", forma: "Comprimido", via: "Oral", categoria: "Vitamina/Suplemento", dosagemPadrao: "5mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "feso-40", nome: "Sulfato ferroso 40mg comprimido", principioAtivo: "Sulfato ferroso", concentracao: "40mg", forma: "Comprimido", via: "Oral", categoria: "Suplemento/Ferro", dosagemPadrao: "40mg", posologia: "1 comprimido 1-3x ao dia (1h antes das refeições)", contextos: ["medicina", "enfermagem"] },
  { id: "vitd-1000", nome: "Vitamina D 1000UI cápsula", principioAtivo: "Colecalciferol (Vitamina D3)", concentracao: "1000UI", forma: "Cápsula", via: "Oral", categoria: "Vitamina/Suplemento", dosagemPadrao: "1000UI", posologia: "1 cápsula 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "vitd-2000", nome: "Vitamina D 2000UI cápsula", principioAtivo: "Colecalciferol (Vitamina D3)", concentracao: "2000UI", forma: "Cápsula", via: "Oral", categoria: "Vitamina/Suplemento", dosagemPadrao: "2000UI", posologia: "1 cápsula 1x ao dia", contextos: ["medicina"] },

  // ── Psiquiátricos / Neurológicos ─────────────────────────────
  { id: "amit-25", nome: "Amitriptilina 25mg comprimido", principioAtivo: "Amitriptilina cloridrato", concentracao: "25mg", forma: "Comprimido", via: "Oral", categoria: "Antidepressivo/Tricíclico", dosagemPadrao: "25mg", posologia: "1-3 comprimidos ao deitar (conforme prescrição)", contextos: ["medicina"] },
  { id: "sert-50", nome: "Sertralina 50mg comprimido", principioAtivo: "Cloridrato de sertralina", concentracao: "50mg", forma: "Comprimido", via: "Oral", categoria: "Antidepressivo/ISRS", dosagemPadrao: "50mg", posologia: "1 comprimido 1x ao dia (manhã ou noite)", contextos: ["medicina"] },
  { id: "sert-100", nome: "Sertralina 100mg comprimido", principioAtivo: "Cloridrato de sertralina", concentracao: "100mg", forma: "Comprimido", via: "Oral", categoria: "Antidepressivo/ISRS", dosagemPadrao: "100mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina"] },
  { id: "flu-20", nome: "Fluoxetina 20mg cápsula", principioAtivo: "Cloridrato de fluoxetina", concentracao: "20mg", forma: "Cápsula", via: "Oral", categoria: "Antidepressivo/ISRS", dosagemPadrao: "20mg", posologia: "1 cápsula 1x ao dia pela manhã", contextos: ["medicina"] },
  { id: "esca-10", nome: "Escitalopram 10mg comprimido", principioAtivo: "Oxalato de escitalopram", concentracao: "10mg", forma: "Comprimido", via: "Oral", categoria: "Antidepressivo/ISRS", dosagemPadrao: "10mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina"] },
  { id: "diaz-5", nome: "Diazepam 5mg comprimido", principioAtivo: "Diazepam", concentracao: "5mg", forma: "Comprimido", via: "Oral", categoria: "Benzodiazepínico (controle especial)", dosagemPadrao: "5mg", posologia: "1 comprimido de 8 em 8 horas (uso por tempo limitado)", contextos: ["medicina"] },
  { id: "clon-05", nome: "Clonazepam 0,5mg comprimido", principioAtivo: "Clonazepam", concentracao: "0,5mg", forma: "Comprimido", via: "Oral", categoria: "Benzodiazepínico (controle especial)", dosagemPadrao: "0,5mg", posologia: "1-2 comprimidos à noite (conforme prescrição)", contextos: ["medicina"] },
  { id: "carba-200", nome: "Carbamazepina 200mg comprimido", principioAtivo: "Carbamazepina", concentracao: "200mg", forma: "Comprimido", via: "Oral", categoria: "Antiepiléptico/Estabilizador", dosagemPadrao: "200mg", posologia: "1 comprimido de 12 em 12 horas (início baixo, escalar)", contextos: ["medicina"] },
  { id: "hal-5", nome: "Haloperidol 5mg comprimido", principioAtivo: "Haloperidol", concentracao: "5mg", forma: "Comprimido", via: "Oral", categoria: "Antipsicótico", dosagemPadrao: "5mg", posologia: "1 comprimido de 12 em 12 horas (conforme prescrição)", contextos: ["medicina"] },
  { id: "ris-2", nome: "Risperidona 2mg comprimido", principioAtivo: "Risperidona", concentracao: "2mg", forma: "Comprimido", via: "Oral", categoria: "Antipsicótico atípico", dosagemPadrao: "2mg", posologia: "1 comprimido de 12 em 12 horas", contextos: ["medicina"] },

  // ── Respiratórios ─────────────────────────────────────────────
  { id: "salb-inal", nome: "Salbutamol 100mcg/dose aerossol", principioAtivo: "Salbutamol", concentracao: "100mcg/dose", forma: "Aerossol inalatório", via: "Inalatória", categoria: "Broncodilatador/Beta-2", dosagemPadrao: "100-200mcg", posologia: "2 jatos de 4 em 4 horas (resgate)", contextos: ["medicina", "enfermagem"] },
  { id: "bude-inal", nome: "Budesonida 200mcg/dose aerossol", principioAtivo: "Budesonida", concentracao: "200mcg/dose", forma: "Aerossol inalatório", via: "Inalatória", categoria: "Corticosteroide inalatório", dosagemPadrao: "200-400mcg", posologia: "1-2 jatos de 12 em 12 horas", contextos: ["medicina"] },
  { id: "lora-10", nome: "Loratadina 10mg comprimido", principioAtivo: "Loratadina", concentracao: "10mg", forma: "Comprimido", via: "Oral", categoria: "Anti-histamínico", dosagemPadrao: "10mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina", "enfermagem"] },
  { id: "ceti-10", nome: "Cetirizina 10mg comprimido", principioAtivo: "Dicloridrato de cetirizina", concentracao: "10mg", forma: "Comprimido", via: "Oral", categoria: "Anti-histamínico", dosagemPadrao: "10mg", posologia: "1 comprimido 1x ao dia (à noite)", contextos: ["medicina", "enfermagem"] },
  { id: "hidrox-25", nome: "Hidroxizina 25mg comprimido", principioAtivo: "Cloridrato de hidroxizina", concentracao: "25mg", forma: "Comprimido", via: "Oral", categoria: "Anti-histamínico/Ansiolítico", dosagemPadrao: "25mg", posologia: "1 comprimido de 8 em 8 horas (conforme prescrição)", contextos: ["medicina"] },

  // ── Cardiovascular ────────────────────────────────────────────
  { id: "aas-100", nome: "AAS 100mg comprimido", principioAtivo: "Ácido acetilsalicílico", concentracao: "100mg", forma: "Comprimido", via: "Oral", categoria: "Antiagregante plaquetário", dosagemPadrao: "100mg", posologia: "1 comprimido 1x ao dia (após refeição)", contextos: ["medicina", "enfermagem"] },
  { id: "clopi-75", nome: "Clopidogrel 75mg comprimido", principioAtivo: "Bissulfato de clopidogrel", concentracao: "75mg", forma: "Comprimido", via: "Oral", categoria: "Antiagregante plaquetário", dosagemPadrao: "75mg", posologia: "1 comprimido 1x ao dia", contextos: ["medicina"] },

  // ── Odontológicos específicos ─────────────────────────────────
  { id: "clorex-012", nome: "Clorexidina 0,12% solução bucal", principioAtivo: "Digluconato de clorexidina", concentracao: "0,12%", forma: "Solução bucal", via: "Tópica/Bochecho", categoria: "Antisséptico bucal", dosagemPadrao: "15mL", posologia: "Bochecho de 15mL por 30 seg, 2x ao dia por 7-14 dias", contextos: ["odontologia"] },
  { id: "clorex-020", nome: "Clorexidina 0,20% solução bucal", principioAtivo: "Digluconato de clorexidina", concentracao: "0,20%", forma: "Solução bucal", via: "Tópica/Bochecho", categoria: "Antisséptico bucal", dosagemPadrao: "10mL", posologia: "Bochecho de 10mL por 30 seg, 2x ao dia", contextos: ["odontologia"] },
  { id: "miso-25", nome: "Misoprostol 25mcg comprimido vaginal", principioAtivo: "Misoprostol", concentracao: "25mcg", forma: "Comprimido vaginal", via: "Vaginal", categoria: "Prostaglandina", dosagemPadrao: "25mcg", posologia: "Conforme protocolo obstétrico", contextos: ["enfermagem"] },
  { id: "alop-300", nome: "Alopurinol 300mg comprimido", principioAtivo: "Alopurinol", concentracao: "300mg", forma: "Comprimido", via: "Oral", categoria: "Antigotoso", dosagemPadrao: "300mg", posologia: "1 comprimido 1x ao dia (após refeição, com bastante água)", contextos: ["medicina"] },
  { id: "colchi-05", nome: "Colchicina 0,5mg comprimido", principioAtivo: "Colchicina", concentracao: "0,5mg", forma: "Comprimido", via: "Oral", categoria: "Antigotoso", dosagemPadrao: "0,5mg", posologia: "1 comprimido de 12 em 12 horas (fase aguda)", contextos: ["medicina"] },
];

/**
 * Normaliza string para busca: lowercase + sem acentos.
 */
export function normalizeMedSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Retorna medicamentos filtrados pelo contexto profissional e query.
 */
export function searchMedications(query, context, extraItems = []) {
  const q = normalizeMedSearch(query);
  const ctx = context || "medicina";
  const all = [...MEDICATION_CATALOG, ...extraItems];
  if (q.length < 2) return [];
  return all.filter(m => {
    if (!m.contextos.includes(ctx)) return false;
    return (
      normalizeMedSearch(m.nome).includes(q) ||
      normalizeMedSearch(m.principioAtivo).includes(q) ||
      normalizeMedSearch(m.categoria || "").includes(q) ||
      normalizeMedSearch(m.concentracao || "").includes(q) ||
      normalizeMedSearch(m.forma || "").includes(q)
    );
  }).slice(0, 10);
}
