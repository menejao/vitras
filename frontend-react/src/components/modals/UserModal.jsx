import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

function UserModal({ open, editingUser, userForm, setUserForm, onlyDigits, error, busy, onClose, onSubmit }) {
  if (!open || !editingUser) return null;

  return (
    <Modal title="Editar usuário" onClose={onClose}>
      <form className="form user-modal-form" onSubmit={onSubmit}>
        <Select label="Perfil" value={userForm.role} disabled onChange={(e) => setUserForm((s) => ({ ...s, role: e.target.value }))}>
          <option value="acs">ACS</option>
          <option value="nursing_tech">Téc. de Enfermagem</option>
          <option value="doctor">Médico(a)</option>
          <option value="dentist">Dentista</option>
          <option value="pharmacist">Farmacêutico(a)</option>
          <option value="pharmacy_tech">Téc. de Farmácia</option>
          <option value="nurse_manager">Enfermeira</option>
          <option value="receptionist">Recepcionista</option>
        </Select>

        <Input label="Nome" value={userForm.name} onChange={(e) => setUserForm((s) => ({ ...s, name: e.target.value }))} />
        <Input label="E-mail" type="email" value={userForm.email} onChange={(e) => setUserForm((s) => ({ ...s, email: e.target.value }))} />
        <Input label="Nova senha (opcional)" type="password" value={userForm.password} onChange={(e) => setUserForm((s) => ({ ...s, password: e.target.value }))} />

        {["doctor", "dentist", "nurse_manager", "nursing_tech", "pharmacist", "pharmacy_tech"].includes(userForm.role) && (
          <div className="user-modal-form__council">
            <Input
              label="Número do conselho"
              value={userForm.councilNumber}
              onChange={(e) => setUserForm((s) => ({ ...s, councilNumber: onlyDigits(e.target.value).slice(0, 12) }))}
            />
            <Input
              label="UF do conselho"
              maxLength={2}
              value={userForm.councilUf}
              onChange={(e) => setUserForm((s) => ({ ...s, councilUf: e.target.value.toUpperCase() }))}
            />
          </div>
        )}

        {error ? <p className="error">{error}</p> : null}

        <div className="modal__footer">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default UserModal;
