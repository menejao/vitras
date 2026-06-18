import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, get, post, patch } from "./helpers.js";

describe("ACS Visits — APS-01C", () => {
  before(startTestServer);
  after(stopTestServer);

  const stamp = Date.now();
  const nurseEmail = `acs-visits-nurse-${stamp}@integration.test`;
  const acsEmail   = `acs-visits-acs-${stamp}@integration.test`;
  const acs2Email  = `acs-visits-acs2-${stamp}@integration.test`;
  const password   = "AcsVisitsPass@12345!";

  let nurseToken = null;
  let acsToken   = null;
  let acs2Token  = null;
  let teamId     = null;
  let patientId  = null;
  let visitId    = null;

  before(async () => {
    const teamsRes = await get("/teams/public");
    assert.equal(teamsRes.status, 200);
    const team = teamsRes.json[0];
    assert.ok(team?.id);
    teamId = team.id;

    // Register nurse (nurse_manager)
    const nurseReg = await post("/auth/register", {
      name: "Enfermeira ACS Visits Teste",
      email: nurseEmail,
      password,
      role: "nurse_manager",
      teamId,
      councilNumber: `${stamp}`.slice(-6),
      councilUf: "SP"
    });
    assert.equal(nurseReg.status, 201, JSON.stringify(nurseReg.json));
    nurseToken = nurseReg.json?.token;
    teamId = nurseReg.json?.user?.teamId || teamId;

    // Create ACS #1 via nurse_manager (POST /users)
    const acsCreate = await post("/users", {
      name: "ACS Visitas Teste",
      email: acsEmail,
      password,
      role: "acs",
      teamId,
    }, nurseToken);
    assert.equal(acsCreate.status, 201, JSON.stringify(acsCreate.json));
    const acsId = acsCreate.json?.id;
    assert.ok(acsId, "acsId must be set");

    // Login ACS #1 to get token
    const acsLogin = await post("/auth/login", { email: acsEmail, password });
    assert.equal(acsLogin.status, 200, JSON.stringify(acsLogin.json));
    acsToken = acsLogin.json?.token;

    // Create ACS #2
    const acs2Create = await post("/users", {
      name: "ACS Visitas Teste 2",
      email: acs2Email,
      password,
      role: "acs",
      teamId,
    }, nurseToken);
    assert.equal(acs2Create.status, 201, JSON.stringify(acs2Create.json));

    // Login ACS #2
    const acs2Login = await post("/auth/login", { email: acs2Email, password });
    assert.equal(acs2Login.status, 200, JSON.stringify(acs2Login.json));
    acs2Token = acs2Login.json?.token;

    // Create patient assigned to ACS #1
    const patRes = await post("/patients", {
      name: "Paciente Visita ACS Teste",
      birthDate: "1985-03-15",
      sex: "F",
      phone: "11999999999",
      cpf: `${stamp}`.slice(-11).padStart(11, "0"),
      teamId,
      assignedAcsId: acsId,
    }, nurseToken);
    assert.equal(patRes.status, 201, JSON.stringify(patRes.json));
    patientId = patRes.json?.id;
    assert.ok(patientId, "patientId must be set");
  });

  // ── POST /acs-visits ─────────────────────────────────────────────────────

  it("POST /acs-visits — ACS creates visit → 201", async () => {
    const res = await post("/acs-visits", {
      patientId,
      date: "2026-06-18",
      turno: "manha",
      desfecho: "realizada",
      motivos: ["visita_periodica", "cadastramento_atualizacao"],
      buscaAtiva: [],
      acompanhamentos: ["hipertensao"],
      controleAmbiental: [],
      observacoes: "Paciente orientada sobre medicação.",
    }, acsToken);

    assert.equal(res.status, 201, JSON.stringify(res.json));
    assert.ok(res.json?.id, "visit must have id");
    assert.equal(res.json?.patientId, patientId);
    assert.equal(res.json?.desfecho, "realizada");
    assert.equal(res.json?.turno, "manha");
    assert.deepEqual(res.json?.motivos, ["visita_periodica", "cadastramento_atualizacao"]);
    visitId = res.json.id;
  });

  it("POST /acs-visits — missing desfecho → 400", async () => {
    const res = await post("/acs-visits", {
      patientId,
      date: "2026-06-18",
    }, acsToken);
    assert.equal(res.status, 400, JSON.stringify(res.json));
  });

  it("POST /acs-visits — invalid date format → 400", async () => {
    const res = await post("/acs-visits", {
      patientId,
      date: "18/06/2026",
      desfecho: "realizada",
    }, acsToken);
    assert.equal(res.status, 400, JSON.stringify(res.json));
  });

  it("POST /acs-visits — unauthenticated → 401", async () => {
    const res = await post("/acs-visits", {
      patientId,
      date: "2026-06-18",
      desfecho: "realizada",
    });
    assert.equal(res.status, 401, JSON.stringify(res.json));
  });

  it("POST /acs-visits — nurse_manager → 403 (no acs.visit.create)", async () => {
    const res = await post("/acs-visits", {
      patientId,
      date: "2026-06-18",
      desfecho: "realizada",
    }, nurseToken);
    assert.equal(res.status, 403, JSON.stringify(res.json));
  });

  // ── GET /acs-visits ──────────────────────────────────────────────────────

  it("GET /acs-visits — ACS sees own visits", async () => {
    const res = await get("/acs-visits", acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json));
    assert.ok(res.json.length >= 1, "should have at least 1 visit");
  });

  it("GET /acs-visits — nurse (acs.visit.read) sees team visits", async () => {
    const res = await get("/acs-visits", nurseToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json));
  });

  it("GET /acs-visits — unauthenticated → 401", async () => {
    const res = await get("/acs-visits");
    assert.equal(res.status, 401);
  });

  // ── GET /acs-visits/:id ──────────────────────────────────────────────────

  it("GET /acs-visits/:id — ACS retrieves own visit", async () => {
    assert.ok(visitId, "visitId must be set from POST test");
    const res = await get(`/acs-visits/${visitId}`, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.equal(res.json?.id, visitId);
  });

  it("GET /acs-visits/:id — not found → 404", async () => {
    const res = await get("/acs-visits/nonexistent-id-xyz", acsToken);
    assert.equal(res.status, 404);
  });

  // ── GET /acs-visits/patient/:patientId ──────────────────────────────────

  it("GET /acs-visits/patient/:id — ACS retrieves patient visits", async () => {
    const res = await get(`/acs-visits/patient/${patientId}`, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json));
    assert.ok(res.json.length >= 1);
  });

  it("GET /acs-visits/patient/:id — patient not found → 404", async () => {
    const res = await get("/acs-visits/patient/no-such-patient", acsToken);
    assert.equal(res.status, 404);
  });

  // ── PATCH /acs-visits/:id ────────────────────────────────────────────────

  it("PATCH /acs-visits/:id — ACS updates own visit → 200", async () => {
    assert.ok(visitId, "visitId must be set");
    const res = await patch(`/acs-visits/${visitId}`, {
      observacoes: "Observações atualizadas.",
      desfecho: "realizada",
    }, acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.equal(res.json?.observacoes, "Observações atualizadas.");
  });

  it("PATCH /acs-visits/:id — ACS2 cannot update ACS1 visit → 403", async () => {
    assert.ok(visitId, "visitId must be set");
    const res = await patch(`/acs-visits/${visitId}`, {
      observacoes: "Tentativa não autorizada.",
    }, acs2Token);
    assert.equal(res.status, 403, JSON.stringify(res.json));
  });

  it("PATCH /acs-visits/:id — nurse_manager can update → 200", async () => {
    assert.ok(visitId, "visitId must be set");
    const res = await patch(`/acs-visits/${visitId}`, {
      observacoes: "Atualizado pela enfermeira.",
    }, nurseToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
  });

  it("PATCH /acs-visits/:id — not found → 404", async () => {
    const res = await patch("/acs-visits/nonexistent-xyz", {
      desfecho: "ausente",
    }, acsToken);
    assert.equal(res.status, 404);
  });

  // ── GET /acs-visits/task/:taskId ─────────────────────────────────────────

  it("GET /acs-visits/task/:taskId — empty for unknown task", async () => {
    const res = await get("/acs-visits/task/no-such-task", acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json));
    assert.equal(res.json.length, 0);
  });

  // ── GET /acs-visits/household/:householdId ───────────────────────────────

  it("GET /acs-visits/household/:id — empty for unknown household", async () => {
    const res = await get("/acs-visits/household/no-such-household", acsToken);
    assert.equal(res.status, 200, JSON.stringify(res.json));
    assert.ok(Array.isArray(res.json));
    assert.equal(res.json.length, 0);
  });
});
