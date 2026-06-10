import Button from "../ui/Button";
import Avatar from "../ui/Avatar";
import Input from "../ui/Input";

function ProfileModal({ open, user, profileForm, setProfileForm, profileError, profileBusy, roleLabel, onlyDigits, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => onClose()}>
      <form className="modal profile-modal" onSubmit={onSubmit} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <h3>Editar perfil</h3>
            <p>Atualize seus dados de acesso</p>
          </div>
          <Button type="button" variant="ghost" size="sm" iconOnly className="icon-btn" onClick={() => onClose()} aria-label="Fechar modal">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </Button>
        </div>

        <div className="profile-modal__avatar">
          <Avatar name={profileForm.name || user?.name} size="xl" />
        </div>

        <div className="profile-modal__stack">
          <Input label="Nome completo" value={profileForm.name} onChange={(e) => setProfileForm((s) => ({ ...s, name: e.target.value }))} autoFocus />
          <Input label="E-mail" type="email" value={profileForm.email} onChange={(e) => setProfileForm((s) => ({ ...s, email: e.target.value }))} />

          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--s-3)", marginTop: "var(--s-1)" }}>
            <Input
              label="Nova senha"
              type="password"
              value={profileForm.password}
              onChange={(e) => setProfileForm((s) => ({ ...s, password: e.target.value }))}
              placeholder="Deixe em branco para manter"
            />
            <span className="field__hint">Mínimo 8 caracteres com maiúscula, número e símbolo.</span>
          </div>

          {profileForm.password && (
            <>
              <Input
                label="Confirmar nova senha"
                type="password"
                value={profileForm.confirmPassword || ""}
                onChange={(e) => setProfileForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                placeholder="Repita a nova senha"
              />
              <Input
                label="Senha atual *"
                type="password"
                value={profileForm.currentPassword || ""}
                onChange={(e) => setProfileForm((s) => ({ ...s, currentPassword: e.target.value }))}
                placeholder="Necessária para confirmar a troca de senha"
              />
            </>
          )}

          {["nurse_manager", "doctor", "dentist", "nursing_tech", "pharmacist", "pharmacy_tech"].includes(user?.role) && (
            <div className="profile-modal__council">
              <Input
                label="Número do conselho"
                value={profileForm.councilNumber}
                onChange={(e) => setProfileForm((s) => ({ ...s, councilNumber: onlyDigits(e.target.value).slice(0, 12) }))}
              />
              <Input
                label="UF"
                maxLength={2}
                value={profileForm.councilUf}
                onChange={(e) => setProfileForm((s) => ({ ...s, councilUf: e.target.value.toUpperCase() }))}
              />
            </div>
          )}

          <div className="profile-modal__meta">
            <div><span>Perfil</span><strong>{roleLabel(user?.role)}</strong></div>
            {user?.teamName ? <div><span>Equipe</span><strong>{user.teamName}</strong></div> : null}
          </div>
        </div>

        {profileError ? <p className="error">{profileError}</p> : null}

        <div className="modal__footer">
          <Button type="button" variant="secondary" onClick={() => onClose()}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={profileBusy}>{profileBusy ? "Salvando..." : "Salvar alterações"}</Button>
        </div>
      </form>
    </div>
  );
}

export default ProfileModal;
