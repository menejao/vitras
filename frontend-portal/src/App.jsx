import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState }       from "react";
import AppLayout          from "./components/AppLayout.jsx";
import LoginPage          from "./pages/LoginPage.jsx";
import FirstAccessPage    from "./pages/FirstAccessPage.jsx";
import HomePage           from "./pages/HomePage.jsx";
import AgendamentosPage   from "./pages/AgendamentosPage.jsx";
import MinhaSaudePage     from "./pages/MinhaSaudePage.jsx";
import MinhaUbsPage       from "./pages/MinhaUbsPage.jsx";
import NotificacoesPage   from "./pages/NotificacoesPage.jsx";
import PerfilPage         from "./pages/PerfilPage.jsx";
import { saveSession, loadSession, clearSession } from "./services/citizenSessionService.js";
import { logout as apiLogout } from "./services/authService.js";

export default function App() {
  const [cidadao, setCidadao] = useState(() => loadSession());

  function handleLogin(data) {
    saveSession(data);
    setCidadao(data);
  }

  async function handleLogout() {
    if (cidadao?.token) {
      apiLogout(cidadao.token).catch(() => {});
    }
    clearSession();
    setCidadao(null);
  }

  const isAuth = !!cidadao;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={isAuth ? <Navigate to="/home" replace /> : <LoginPage onLogin={handleLogin} />}
        />
        <Route
          path="/primeiro-acesso"
          element={isAuth ? <Navigate to="/home" replace /> : <FirstAccessPage onLogin={handleLogin} />}
        />

        {/* Protected routes */}
        <Route
          element={isAuth ? <AppLayout cidadao={cidadao} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
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
