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
    setPatientDataLoading(true);
    // Reset secondary data immediately so stale data from previous patient doesn't show
    setHistory([]); setAppointments([]); setTasks([]); setMessages([]);
    try {
      const summary = await getPatientProtocolSummary(token, patientId);
      setPatientProtocolSummary(summary || null);
    } catch (e) {
      if (!(await handleApiError(e))) setError(e.message || "Falha ao carregar dados do paciente");
    } finally {
      setPatientDataLoading(false);
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
    if (!token || String(token).startsWith("local_")) return;
    async function ping() { await pingPresence(token); }
    ping().then(async () => {
      try {
        const fu = await listUsers(token);
        if (Array.isArray(fu)) setAllUsers(fu.map(u => u.id === currentUserId ? { ...u, online: true } : u));
      } catch {}
    });
    const iv = setInterval(async () => {
      await ping();
      try {
        const fu = await listUsers(token);
        if (Array.isArray(fu)) setAllUsers(fu.map(u => u.id === currentUserId ? { ...u, online: true } : u));
      } catch {}
    }, 60000);
    return () => clearInterval(iv);
  }, [token]);

  useEffect(() => {
    listPublicTeams().then(arr => {
      setPublicTeams(Array.isArray(arr) ? arr : []);
    }).catch(() => setPublicTeams([]));
  }, [token]);

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
