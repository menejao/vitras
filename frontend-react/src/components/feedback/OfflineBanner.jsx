import useOnlineStatus from "../../hooks/useOnlineStatus";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="offline-banner">
      <div className="offline-banner__content">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1 1l14 14M10.5 5A5 5 0 0114 9M6 3a7 7 0 018 8M3 6a5 5 0 011 7" stroke="var(--warning)" strokeWidth="1.4" strokeLinecap="round" /><circle cx="8" cy="13" r="1" fill="var(--warning)" /></svg>
        <span>Modo offline. Dados locais disponíveis. Sincronização volta ao reconectar.</span>
      </div>
      <span className="offline-banner__brand">Vitras · Offline</span>
    </div>
  );
}
