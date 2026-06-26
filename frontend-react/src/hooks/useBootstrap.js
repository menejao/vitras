import { useEffect, useState } from "react";
import {
  bootstrap,
  getPatientHistory, getPatientProtocolSummary, getProtocolSummaries,
  listAppointments, listMessages, listPatients, listProtocolTemplates,
  listPublicTeams, listTasks, listUsers,
  pingPresence,
} from "../api";
import { readSession } from "../utils/storage";
import { COOKIE_SESSION_SENTINEL } from "./useAuth";

export function useBootstrap(token, {
  handleApiError,
  setBusy,
  setError,
  refreshUserFromBoot,
  currentUserId,
} = {}) {
  const [patients, setPatients] = useState([]);
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [protocolByPatient, setProtocolByPatient] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [publicTeams, setPublicTeams] = useState([]);
  const [demandMonthly, setDemandMonthly] = useState(null);
  const [teamDemand, setTeamDemand] = useState(null);
  const [unitName, setUnitName] = useState("");
  const [lastLoadAt, setLastLoadAt] = useState(null);
  const [patientsPaginationMeta, setPatientsPaginationMeta] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [patientProtocolSummary, setPatientProtocolSummary] = useState(null);
  const [patientDataLoading, setPatientDataLoading] = useState(false);

  function reset() {
    setPatients([]); setUsers([]); setTemplates([]);
    setProtocolByPatient({}); setAllUsers([]);
    setDemandMonthly(null); setTeamDemand(null); setUnitName(""); setLastLoadAt(null);
    setPatientsPaginationMeta(null);
    setAppointments([]); setTasks([]); setMessages([]);
    setHistory([]); setPatientProtocolSummary(null);
  }

  async function loadAll() {
    if (!token || String(token).startsWith("local_")) return;
    setBusy(true); setError("");
    try {
      const boot = await bootstrap(token);
      if (boot?.user) {
        refreshUserFromBoot(boot.user, boot?.csrfToken);
      }
      const pts = Array.isArray(boot?.patients) ? boot.patients : await listPatients(token);
      const us = Array.isArray(boot?.users) ? boot.users : await listUsers(token);
      const tpls = Array.isArray(boot?.protocolTemplates) ? boot.protocolTemplates : await listProtocolTemplates(token);
      setPatients(pts); setUsers(us); setTemplates(tpls);
      if (boot?.paginationMeta) setPatientsPaginationMeta(boot.paginationMeta);
      if (boot?.demandMonthly) {
        setDemandMonthly(boot.demandMonthly);
      }
      if (Array.isArray(boot?.teamDemand)) setTeamDemand(boot.teamDemand);
      if (boot?.unitName) setUnitName(boot.unitName);
      setAllUsers(us.map(u => u.id === boot?.user?.id ? { ...u, online: true } : u));
      if (pts.length) {
        const sums = await getProtocolSummaries(token, pts.map(p => p.id).filter(Boolean));
        setProtocolByPatient(sums?.summaries || {});
      } else {
        setProtocolByPatient({});
      }
      setLastLoadAt(new Date().toISOString());
    } catch (e) {
      if (!(await handleApiError(e))) setError(e.message || "Falha ao carregar dados");
    } finally {
      setBusy(false);
    }
  }

  async function loadSelectedPatientData(patientId) {
    // Reset secondary data immediately so stale data from previous patient doesn't show
    setHistory([]); setAppointments([]); setTasks([]); setMessages([]);

    // Use cached protocol summary if available — workspace opens instantly, no roundtrip
    const cached = protocolByPatient[patientId];
    if (cached) {
      setPatientProtocolSummary(cached);
      setPatientDataLoading(false);
    } else {
      setPatientDataLoading(true);
      try {
        const summary = await getPatientProtocolSummary(token, patientId);
        setPatientProtocolSummary(summary || null);
      } catch (e) {
        // Do NOT propagate patient-specific errors to the global banner —
        // a 404 here means a stale or transitional state, not a user-visible failure.
        // The workspace degrades gracefully (null summary = "Sem dados").
        await handleApiError(e);
      } finally {
        setPatientDataLoading(false);
      }
    }

    // Secondary data loads in background — does not block workspace open
    Promise.all([
      getPatientHistory(token, patientId),
      listAppointments(token, patientId),
      listTasks(token, patientId),
      listMessages(token, patientId),
    ]).then(([hist, appts, taskItems, msgItems]) => {
      setHistory(Array.isArray(hist) ? hist : []);
      setAppointments(Array.isArray(appts) ? appts : []);
      setTasks(Array.isArray(taskItems) ? taskItems : []);
      setMessages(Array.isArray(msgItems) ? msgItems : []);
    }).catch(() => {});
  }

  useEffect(() => { if (token) loadAll(); }, [token]);

  useEffect(() => {
    // NETWORK-OPTIMIZATION-01: pingPresence apenas — sem listUsers duplicado.
    // users já foram carregados pelo loadAll/bootstrap. Atualizar o status online
    // via listUsers a cada 60s gera carga desnecessária no t3.micro e duplica a
    // chamada que já ocorre no bootstrap. O ping de presença é suficiente para
    // manter a sessão ativa do usuário corrente.
    if (!token || String(token).startsWith("local_")) return;
    async function ping() {
      try { await pingPresence(token); } catch {}
    }
    // Primeiro ping sem listUsers (loadAll já carregou users)
    ping();
    // Polling periódico: apenas presença, sem listUsers
    const iv = setInterval(ping, 60000);
    return () => clearInterval(iv);
  }, [token]);

  useEffect(() => {
    // NETWORK-OPTIMIZATION-01: listPublicTeams é dado estático (equipes públicas
    // para cadastro). Deve ser chamado uma única vez na montagem, sem depender de
    // token — a dependência de [token] causava re-chamada a cada refresh de auth.
    listPublicTeams().then(arr => {
      setPublicTeams(Array.isArray(arr) ? arr : []);
    }).catch(() => setPublicTeams([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    patients, setPatients,
    patientsPaginationMeta,
    users, templates, protocolByPatient, allUsers, publicTeams,
    demandMonthly, setDemandMonthly,
    teamDemand, unitName,
    lastLoadAt,
    appointments, tasks, messages, history, patientProtocolSummary,
    patientDataLoading,
    loadAll,
    loadSelectedPatientData,
    reset,
  };
}
