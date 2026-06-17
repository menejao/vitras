// C04A/C04B/C04C: CDS Export Service — Cadastro Individual + Cadastro Domiciliar + Atendimento Individual
// Generates LEDI APS 7.4.0 compatible .esus files.
import { v4 as uuidv4 } from "uuid";
import { buildCadastroIndividual, buildCadastroDomiciliar, buildAtendimentoIndividual } from "./cds-structs.js";
import { buildEsusZip } from "./esus-packer.js";

/**
 * Export a patient's Cadastro Individual as a .esus (ZIP+Thrift) buffer.
 *
 * @param {object} patient      — from readDb(), fields already decrypted
 * @param {object} professional — app_users row, already decrypted; has cnsProfissional, cboCodigo
 * @param {object} unit         — app_units row; has cnes, municipalityId
 * @param {object} team         — from app_state.teams; has ine, tipoEquipe
 * @param {object} [opts]
 * @param {boolean} [opts.isUpdate=false] — true = fichaAtualizada
 * @returns {{ buffer: Buffer, filename: string, fichaUuid: string, originUuid: string }}
 */
export function exportCadastroIndividual(patient, professional, unit, team, opts = {}) {
  const fichaUuid = uuidv4();
  const originUuid = uuidv4();

  const { buffer } = buildCadastroIndividual({
    patient,
    professional,
    unit,
    team,
    fichaUuid,
    originUuid,
    isUpdate: Boolean(opts.isUpdate),
  });

  const zipBuffer = buildEsusZip([{
    name: `${fichaUuid}.thrift`,
    data: buffer,
  }]);

  const filename = `cadastro-individual-${patient.id}-${Date.now()}.esus`;

  return { buffer: zipBuffer, filename, fichaUuid, originUuid };
}

/**
 * Export a household's Cadastro Domiciliar as a .esus (ZIP+Thrift) buffer.
 *
 * @param {object} household    — from readDb().households
 * @param {object} patient      — from readDb().patients (owner of household)
 * @param {object} professional — app_users row with cnsProfissional, cboCodigo
 * @param {object} unit         — app_units row with cnes, municipalityId
 * @param {object} team         — from app_state.teams with ine
 * @param {object} [opts]
 * @param {boolean} [opts.isUpdate=false] — true = fichaAtualizada
 * @returns {{ buffer: Buffer, filename: string, fichaUuid: string, originUuid: string }}
 */
export function exportCadastroDomiciliar(household, patient, professional, unit, team, opts = {}) {
  const fichaUuid = uuidv4();
  const originUuid = uuidv4();

  const { buffer } = buildCadastroDomiciliar({
    household,
    patient,
    professional,
    unit,
    team,
    fichaUuid,
    originUuid,
    isUpdate: Boolean(opts.isUpdate),
  });

  const zipBuffer = buildEsusZip([{
    name: `${fichaUuid}.thrift`,
    data: buffer,
  }]);

  const filename = `cadastro-domiciliar-${household.id}-${Date.now()}.esus`;

  return { buffer: zipBuffer, filename, fichaUuid, originUuid };
}

/**
 * Export a clinical record as Atendimento Individual .esus (ZIP+Thrift) buffer.
 *
 * @param {object} record       — from patient.records[], has type/date/turno/localDeAtendimento/cid/ciap
 * @param {object} patient      — from readDb(), fields already decrypted; has cns/cpf/birthDate/sex
 * @param {object} professional — app_users row, decrypted; has cnsProfissional, cboCodigo
 * @param {object} unit         — app_units row; has cnes, municipalityId
 * @param {object} team         — from app_state.teams; has ine
 * @returns {{ buffer: Buffer, filename: string, fichaUuid: string }}
 */
export function exportAtendimentoIndividual(record, patient, professional, unit, team) {
  const fichaUuid = uuidv4();

  const { buffer } = buildAtendimentoIndividual({
    record,
    patient,
    professional,
    unit,
    team,
    fichaUuid,
  });

  const zipBuffer = buildEsusZip([{
    name: `${fichaUuid}.thrift`,
    data: buffer,
  }]);

  const filename = `atendimento-individual-${record.id}-${Date.now()}.esus`;

  return { buffer: zipBuffer, filename, fichaUuid };
}
