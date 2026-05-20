import Button from "../ui/Button";

function AppErrorFallback({ message }) {
  return (
    <div className="error-screen">
      <div className="error-screen__card">
        <div className="error-screen__icon">⚠</div>
        <h2>Ocorreu um erro inesperado</h2>
        <p>{message || "Erro desconhecido"}</p>
        <div className="error-screen__actions">
          <Button size="lg" onClick={() => { sessionStorage.clear(); window.location.reload(); }}>
            Recarregar
          </Button>
          <Button variant="secondary" size="lg" onClick={() => { sessionStorage.clear(); localStorage.removeItem("vitras_react_session"); window.location.reload(); }}>
            Limpar sessão e recarregar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AppErrorFallback;
