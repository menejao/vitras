function Modal({ title, onClose, actions, children, className = "" }) {
  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={["modal", className].filter(Boolean).join(" ")} onClick={e=>e.stopPropagation()}>
        <div className="modal__header">
          <h3>{title}</h3>
          <button className="icon-btn modal__close" onClick={onClose} type="button" aria-label="Fechar modal">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {actions ? <div className="modal__footer">{actions}</div> : null}
      </div>
    </div>
  );
}

export default Modal;
