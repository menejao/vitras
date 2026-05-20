function EmptyState({ title = "Nada por aqui", message, description, action = null }) {
  return (
    <div className="empty">
      <div className="empty__icon empty__icon--neutral">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M20 13v7M20 26v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      </div>
      <h3 className="empty__title">{title}</h3>
      <p className="empty__desc">{description || message}</p>
      {action}
    </div>
  );
}

export default EmptyState;
