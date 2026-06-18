/**
 * Unit tests for Zod schema helpers — no server required.
 * Covers optionalNumberLike() accepting null/undefined/number for gestational age fields.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Direct schema import — pure module, no env vars needed.
const { PatientCreateSchema, PatientUpdateSchema } = await import("../src/schemas.js");

const GESTATIONAL_FIELDS = [
  "gestationalAgeDumWeeks",
  "gestationalAgeDumDays",
  "gestationalAgeUsgWeeks",
  "gestationalAgeUsgDays",
];

const BASE_PATIENT = {
  name: "Paciente Teste",
  phone: "(11)90000-0001",
  careCategory: "general",
  cns: "754123650145963"
};

describe("optionalNumberLike gestational age fields", () => {
  describe("PatientCreateSchema", () => {
    it("accepts null for all four gestational age fields", () => {
      const payload = {
        ...BASE_PATIENT,
        gestationalAgeDumWeeks: null,
        gestationalAgeDumDays: null,
        gestationalAgeUsgWeeks: null,
        gestationalAgeUsgDays: null,
      };
      const result = PatientCreateSchema.safeParse(payload);
      assert.ok(result.success, `Expected success, got: ${JSON.stringify(result.error?.issues)}`);
    });

    it("accepts undefined (omitted) for all four gestational age fields", () => {
      const result = PatientCreateSchema.safeParse(BASE_PATIENT);
      assert.ok(result.success, `Expected success, got: ${JSON.stringify(result.error?.issues)}`);
    });

    for (const field of GESTATIONAL_FIELDS) {
      it(`accepts valid number for ${field}`, () => {
        const result = PatientCreateSchema.safeParse({ ...BASE_PATIENT, [field]: 12 });
        assert.ok(result.success, `Expected success for ${field}=12, got: ${JSON.stringify(result.error?.issues)}`);
      });

      it(`accepts null for ${field}`, () => {
        const result = PatientCreateSchema.safeParse({ ...BASE_PATIENT, [field]: null });
        assert.ok(result.success, `Expected success for ${field}=null, got: ${JSON.stringify(result.error?.issues)}`);
      });

      it(`accepts numeric string for ${field}`, () => {
        const result = PatientCreateSchema.safeParse({ ...BASE_PATIENT, [field]: "8" });
        assert.ok(result.success, `Expected success for ${field}="8", got: ${JSON.stringify(result.error?.issues)}`);
      });
    }
  });

  describe("PatientUpdateSchema", () => {
    it("accepts null for all four gestational age fields", () => {
      const result = PatientUpdateSchema.safeParse({
        gestationalAgeDumWeeks: null,
        gestationalAgeDumDays: null,
        gestationalAgeUsgWeeks: null,
        gestationalAgeUsgDays: null,
      });
      assert.ok(result.success, `Expected success, got: ${JSON.stringify(result.error?.issues)}`);
    });

    it("accepts undefined (omitted) for all four gestational age fields", () => {
      const result = PatientUpdateSchema.safeParse({});
      assert.ok(result.success, "Expected success for empty update payload");
    });
  });
});
