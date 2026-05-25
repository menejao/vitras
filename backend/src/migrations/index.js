import * as m001 from "./001_create_app_state.js";
import * as m002 from "./002_create_shadow_relational_tables.js";
import * as m003 from "./003_create_patient_agenda_permission_shadow_tables.js";
import * as m004 from "./004_add_org_scope_columns.js";
import * as m005 from "./005_patient_cpf_cns_unique.js";

// Add new migrations here in order - never remove or reorder existing entries
export const migrations = [m001, m002, m003, m004, m005];
