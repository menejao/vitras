import { useState } from "react";
import { aiTeamAsk, aiTeamDataQuality, aiTeamPriorities, aiTeamReport } from "../api";

export function useAiHandlers({ token, handleApiError, setBusy, setError }) {
  const [aiView, setAiView] = useState("priorities");
  const [aiData, setAiData] = useState(null);
  const [aiQuestion, setAiQuestion] = useState("");

  async function loadAiPriorities() {
    if (!token) return;
    setBusy(true); setError("");
    try { setAiView("priorities"); setAiData(await aiTeamPriorities(token)); }
    catch (e) { if (!(await handleApiError(e))) setError(e.message || "Erro"); }
    finally { setBusy(false); }
  }

  async function loadAiQuality() {
    if (!token) return;
    setBusy(true); setError("");
    try { setAiView("quality"); setAiData(await aiTeamDataQuality(token)); }
    catch (e) { if (!(await handleApiError(e))) setError(e.message || "Erro"); }
    finally { setBusy(false); }
  }

  async function loadAiReport() {
    if (!token) return;
    setBusy(true); setError("");
    try { setAiView("report"); setAiData(await aiTeamReport(token)); }
    catch (e) { if (!(await handleApiError(e))) setError(e.message || "Erro"); }
    finally { setBusy(false); }
  }

  async function submitAiQuestion(e) {
    e.preventDefault();
    if (!token || !aiQuestion.trim()) return;
    setBusy(true); setError("");
    try { setAiView("chat"); setAiData(await aiTeamAsk(token, aiQuestion.trim())); }
    catch (e) { setError(e.message || "Erro"); }
    finally { setBusy(false); }
  }

  return {
    aiView, aiData, aiQuestion, setAiQuestion,
    loadAiPriorities, loadAiQuality, loadAiReport, submitAiQuestion,
  };
}
