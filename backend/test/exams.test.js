import test from "node:test";
import assert from "node:assert/strict";
import { startTestServer, stopTestServer, post, get } from "./helpers.js";

test("exams flow persists create, attachment upload and justified delete", async () => {
  const base = await startTestServer();

  const login = await post("/auth/login", { identifier: "ana@clinica.local", password: "123456" });
  assert.equal(login.status, 200);
  const token = login.json.token || login.json.accessToken;

  const createdPatient = await post("/patients", {
    name: "Paciente Exames",
    phone: "11999999999",
    careCategory: "general",
    cns: "545896320147852"
  }, token);
  assert.equal(createdPatient.status, 201);
  const patientId = createdPatient.json.id;

  const createdExam = await post(`/patients/${patientId}/exams`, {
    title: "Hemograma completo",
    date: "2026-05-17",
    notes: "[EXAME REALIZADO NO POSTO]\nResultado: Hemoglobina normal"
  }, token);
  assert.equal(createdExam.status, 201);
  const examId = createdExam.json.id;

  const attachmentResponse = await fetch(`${base}/patients/${patientId}/exams/${examId}/attachments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x.valens-exam-attachment+json"
    },
    body: JSON.stringify({
      name: "laudo.pdf",
      contentType: "application/pdf",
      size: 16,
      dataBase64: "JVBERi0xLjQKJUVPRgo="
    })
  });
  assert.equal(attachmentResponse.status, 201);
  const attachmentJson = await attachmentResponse.json();
  assert.equal(attachmentJson.name, "laudo.pdf");
  assert.match(attachmentJson.url, /^data:application\/pdf;base64,/);

  const listed = await get(`/patients/${patientId}/exams`, token);
  assert.equal(listed.status, 200);
  assert.equal(listed.json.length, 1);
  assert.equal(listed.json[0].attachments.length, 1);

  const invalidDelete = await fetch(`${base}/patients/${patientId}/exams/${examId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  assert.equal(invalidDelete.status, 400);

  const validDelete = await fetch(`${base}/patients/${patientId}/exams/${examId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Justification": "Registro duplicado do mesmo laudo"
    }
  });
  assert.equal(validDelete.status, 200);

  const listedAfterDelete = await get(`/patients/${patientId}/exams`, token);
  assert.equal(listedAfterDelete.status, 200);
  assert.equal(listedAfterDelete.json.length, 0);
});

test.after(async () => {
  await stopTestServer();
});
