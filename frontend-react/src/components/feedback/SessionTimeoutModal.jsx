import Button from "../ui/Button";

export default function SessionTimeoutModal({ remaining = 120, onStay, onLogout }) {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const countdown = mins > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : `${secs}s`;

  const urgent = remaining <= 30;

  return (
    <div className="session-timeout-backdrop" role="dialog" aria-modal="true" aria-label="Aviso de inatividade">
      <div className="session-timeout-modal">
        <div className={`session-timeout__icon${urgent ? " session-timeout__icon--urgent" : ""}`}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="session-timeout__body">
          <h2 className="session-timeout__title">Ausencia detectada</h2>
          <p className="session-timeout__desc">
            Sua sessao sera encerrada por seguranca. Dados de pacientes nao podem ficar expostos.
          </p>
          <div className={`session-timeout__countdown${urgent ? " session-timeout__countdown--urgent" : ""}`}>
            {countdown}
          </div>
        </div>

        <div className="session-timeout__actions">
          <Button type="button" variant="primary" onClick={onStay} autoFocus>
            Continuar sessao
          </Button>
          <Button type="button" variant="ghost" onClick={onLogout}>
            Sair agora
          </Button>
        </div>
      </div>
    </div>
  );
}
