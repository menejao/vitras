import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import AppLayout    from "./components/AppLayout.jsx";
import LoginPage    from "./pages/LoginPage.jsx";
import HomePage     from "./pages/HomePage.jsx";
import AgendamentosPage from "./pages/AgendamentosPage.jsx";
import MinhaSaudePage   from "./pages/MinhaSaudePage.jsx";
import MinhaUbsPage     from "./pages/MinhaUbsPage.jsx";
import NotificacoesPage from "./pages/NotificacoesPage.jsx";
import PerfilPage       from "./pages/PerfilPage.jsx";

export default function App() {
  const [cidadao, setCidadao] = useState(
    () => {
      try { return JSON.parse(sessionStorage.getItem("portal_cidadao") || "null"); }
      catch { return null; }
    }
  );

  function handleLogin(data) {
    sessionStorage.setItem("portal_cidadao", JSON.stringify(data));
    setCidadao(data);
  }

  function handleLogout() {
    sessionStorage.removeItem("portal_cidadao");
    setCidadao(null);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            cidadao
              ? <Navigate to="/home" replace />
              : <LoginPage onLogin={handleLogin} />
          }
        />

        {/* Protected routes */}
        <Route
          element={
            cidadao
              ? <AppLayout cidadao={cidadao} onLogout={handleLogout} />
              : <Navigate to="/login" replace />
          }
        >
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home"          element={<HomePage cidadao={cidadao} />} />
          <Route path="/agendamentos"  element={<AgendamentosPage />} />
          <Route path="/minha-saude"   element={<MinhaSaudePage />} />
          <Route path="/minha-ubs"     element={<MinhaUbsPage cidadao={cidadao} />} />
          <Route path="/notificacoes"  element={<NotificacoesPage />} />
          <Route path="/perfil"        element={<PerfilPage cidadao={cidadao} onLogout={handleLogout} />} />
          <Route path="*"              element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
