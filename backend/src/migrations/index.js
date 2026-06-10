import * as m001 from "./001_create_app_state.js";
import * as m002 from "./002_create_shadow_relational_tables.js";
import * as m003 from "./003_create_patient_agenda_permission_shadow_tables.js";
import * as m004 from "./004_add_org_scope_columns.js";
import * as m005 from "./005_patient_cpf_cns_unique.js";
import * as m006 from "./006_patient_hash_columns.js";
import * as m007 from "./007_drop_ciphertext_patient_indexes.js";
import * as m008 from "./008_drop_ciphertext_indexes_concurrently.js";
import * as m009 from "./009_add_unit_id_to_patients.js";
import * as m010 from "./010_add_municipality_id.js";
import * as m011 from "./011_add_executing_context_to_appointments.js";

// Add new migrations here in order - never remove or reorder existing entries
export const migrations = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011];
