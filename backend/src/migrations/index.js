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
import * as m012 from "./012_add_race_color_to_patients.js";
import * as m013 from "./013_add_cnes_to_units.js";
import * as m014 from "./014_add_cns_to_users.js";
import * as m015 from "./015_create_app_households.js";
import * as m018 from "./018_backfill_cnscpf.js";
import * as m019 from "./019_remove_cnscpf_from_payload.js";
import * as m020 from "./020_cleanup_cnscpf_from_state.js";
import * as m021 from "./021_create_municipalities.js";
// m022 (FK app_units→municipalities) intentionally excluded until seed-municipalities.mjs confirms COUNT >= 5570
import * as m023 from "./023_create_cid10.js";
import * as m024 from "./024_create_ciap2.js";

// Add new migrations here in order - never remove or reorder existing entries
export const migrations = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010, m011, m012, m013, m014, m015, m018, m019, m020, m021, m023, m024];
