import { v4 as uuidv4 } from "uuid";
import { ensureDbShape } from "./domain.js";
import { addAuditLog } from "../services/audit.js";

// Strips apartment/complement suffix before normalizing.
// "Rua Camargo, 71, apto 5" → "rua camargo 71"
const COMPLEMENT_RE = /,?\s*(apto?\.?\s*\S+|ap\.?\s*\d+|casa\s*\S+|bl(?:oco)?\s*\S+|loja\s*\S+|sala\s*\S+|flat\s*\S+)\s*$/i;

// Accepts either a free-text string or a structured address object
// { logradouro, numero, bairro, cep, municipioIbge }.
export function buildAddressKey(addressOrObj) {
  if (!addressOrObj) return "";

  if (typeof addressOrObj === "object") {
    // Prefer CEP + logradouro + numero when structured fields available
    const parts = [
      String(addressOrObj.logradouro || "").trim(),
      String(addressOrObj.numero || "").trim(),
      String(addressOrObj.bairro || "").trim(),
      String(addressOrObj.cep || "").replace(/\D/g, ""),
    ].filter(Boolean).join(" ");
    if (!parts) return "";
    return buildAddressKey(parts);
  }

  if (typeof addressOrObj !== "string") return "";
  const stripped = addressOrObj.replace(COMPLEMENT_RE, "").trim();
  if (!stripped) return "";
  return stripped
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[.,\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Syncs a patient's family group membership.
// Primary grouping key: patient.householdId (when set, all patients sharing the household → one group).
// Fallback: patient.address free-text normalized via buildAddressKey.
// Must be called INSIDE a withDb callback (operates on mutable db directly).
export function syncPatientFamilyGroup(db, patient, actorUser, reason) {
  ensureDbShape(db);

  const now = new Date().toISOString();
  const actorId = actorUser?.id || "system";

  // Determine grouping key and lookup strategy
  const useHouseholdId = Boolean(patient.householdId);
  const addressKey = useHouseholdId
    ? null
    : buildAddressKey(patient.address);

  const currentGroupIdx = db.familyGroups.findIndex(
    (g) => g.teamId === patient.teamId &&
           Array.isArray(g.memberPatientIds) &&
           g.memberPatientIds.includes(patient.id)
  );

  // No grouping key available → remove from any current group
  if (!useHouseholdId && !addressKey) {
    if (currentGroupIdx >= 0) {
      const grp = db.familyGroups[currentGroupIdx];
      grp.memberPatientIds = grp.memberPatientIds.filter((id) => id !== patient.id);
      grp.memberHistory = [...(grp.memberHistory || []), {
        action: "leave", patientId: patient.id,
        reason: "Endereço incompleto ou removido", at: now, by: actorId,
      }];
      grp.updatedAt = now;
      addAuditLog(db, actorUser || { id: "system" }, "familyGroup.memberLeft", "familyGroup", grp.id, {
        patientId: patient.id, groupAddress: grp.address, reason: "Endereço incompleto",
      });
    }
    return;
  }

  // Find the target group: by householdId (primary) or addressKey (fallback)
  const targetGroupIdx = useHouseholdId
    ? db.familyGroups.findIndex(
        (g) => g.teamId === patient.teamId && g.householdId === patient.householdId
      )
    : db.familyGroups.findIndex(
        (g) => g.teamId === patient.teamId && g.addressKey === addressKey
      );

  if (targetGroupIdx < 0) {
    // Remove from old group if any
    if (currentGroupIdx >= 0) {
      const old = db.familyGroups[currentGroupIdx];
      old.memberPatientIds = old.memberPatientIds.filter((id) => id !== patient.id);
      old.memberHistory = [...(old.memberHistory || []), {
        action: "leave", patientId: patient.id, reason, at: now, by: actorId,
      }];
      old.updatedAt = now;
    }

    // Resolve household address for display
    const household = useHouseholdId
      ? db.households?.find((h) => h.id === patient.householdId)
      : null;
    const groupAddressKey = useHouseholdId
      ? buildAddressKey({ logradouro: household?.logradouro, numero: household?.numero, bairro: household?.bairro, cep: household?.cep })
      : addressKey;
    const groupAddress = household
      ? [household.logradouro, household.numero, household.bairro].filter(Boolean).join(", ")
      : (patient.address || "");

    const newGroup = {
      id: uuidv4(),
      teamId: patient.teamId,
      householdId: patient.householdId || null,
      addressKey: groupAddressKey,
      address: groupAddress,
      microArea: patient.microArea || "",
      assignedAcsId: patient.assignedAcsId || "",
      memberPatientIds: [patient.id],
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
      transferHistory: [],
      memberHistory: [{
        action: "join", patientId: patient.id, reason, at: now, by: actorId,
      }],
    };
    db.familyGroups.push(newGroup);
    addAuditLog(db, actorUser || { id: "system" }, "familyGroup.created", "familyGroup", newGroup.id, {
      address: newGroup.address, addressKey: groupAddressKey, householdId: newGroup.householdId,
      patientId: patient.id, reason,
    });
    return;
  }

  const targetGroup = db.familyGroups[targetGroupIdx];
  const alreadyMember = targetGroup.memberPatientIds.includes(patient.id);
  const changedGroup = currentGroupIdx >= 0 && currentGroupIdx !== targetGroupIdx;

  if (alreadyMember && !changedGroup) return;

  if (changedGroup) {
    const old = db.familyGroups[currentGroupIdx];
    old.memberPatientIds = old.memberPatientIds.filter((id) => id !== patient.id);
    old.memberHistory = [...(old.memberHistory || []), {
      action: "leave", patientId: patient.id, reason, at: now, by: actorId,
    }];
    old.updatedAt = now;
    addAuditLog(db, actorUser || { id: "system" }, "familyGroup.memberLeft", "familyGroup", old.id, {
      patientId: patient.id, newGroupId: targetGroup.id, reason,
    });
  }

  if (!alreadyMember) {
    targetGroup.memberPatientIds.push(patient.id);
    targetGroup.memberHistory = [...(targetGroup.memberHistory || []), {
      action: "join", patientId: patient.id, reason, at: now, by: actorId,
    }];
    targetGroup.updatedAt = now;
    addAuditLog(db, actorUser || { id: "system" }, "familyGroup.memberJoined", "familyGroup", targetGroup.id, {
      patientId: patient.id, reason,
    });
  }
}

// Idempotent backfill — processes all active patients and syncs their group membership.
// Safe to run multiple times: no duplicate groups, no data loss.
export function backfillFamilyGroups(db, actorUser) {
  ensureDbShape(db);
  const actor = actorUser || { id: "system", name: "Sistema" };
  const activePatients = db.patients.filter((p) => !p.inactive);
  for (const patient of activePatients) {
    syncPatientFamilyGroup(db, patient, actor, "Backfill automático por endereço cadastrado");
  }
  return { processed: activePatients.length, groups: db.familyGroups.length };
}
