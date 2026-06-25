import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Textarea from "./ui/Textarea";
import PatientModal from "./modals/PatientModal";
import ProfileModal from "./modals/ProfileModal";
import UserModal from "./modals/UserModal";
import TemplateModal from "./modals/TemplateModal";
import SecureAccessModal from "./modals/SecureAccessModal";
import { onlyDigits, formatCpf, formatPhone, formatCep, formatCns } from "../utils/formatting";
import { roleLabel } from "../utils/roles";
import { isChildCategory } from "../utils/clinical";

export function AppModals({
  // patient modal
  showModal, setShowModal, editingPatient, form, setForm,
  users, catOpts, lookupCepAndFillAddress, patientModalMode,
  submitPatient, error, busy, token,
  // user modal
  showUserModal, setShowUserModal, editingUser, userForm, setUserForm, submitUser,
  // template modal
  showTemplateModal, setShowTemplateModal, editingTemplate, templateForm, setTemplateForm, submitTemplate,
  // profile modal
  showProfileModal, setShowProfileModal, profileForm, setProfileForm,
  profileError, profileBusy, submitProfile, user,
  // secure access modal
  secureAccessMode, setSecureAccessMode, secureAccessBusy, secureAccessError, setSecureAccessError,
  submitSecureAccess, allUsers,
  // delete modals
  pendingUserDelete, setPendingUserDelete,
  pendingTemplateDelete, setPendingTemplateDelete,
  deleteReason, setDeleteReason,
  confirmUserDelete, confirmTemplateDelete,
}) {
  return (
    <>
      <PatientModal
        open={showModal}
        editingPatient={editingPatient}
        form={form}
        setForm={setForm}
        users={users}
        catOpts={catOpts}
        isChildCategory={isChildCategory}
        lookupCepAndFillAddress={lookupCepAndFillAddress}
        formatPhone={formatPhone}
        formatCep={formatCep}
        formatCpf={formatCpf}
        formatCns={formatCns}
        error={error}
        busy={busy}
        readOnly={patientModalMode === "view"}
        onClose={() => setShowModal(false)}
        onSubmit={submitPatient}
        token={token}
      />

      <UserModal
        open={showUserModal}
        editingUser={editingUser}
        userForm={userForm}
        setUserForm={setUserForm}
        onlyDigits={onlyDigits}
        error={error}
        busy={busy}
        onClose={() => setShowUserModal(false)}
        onSubmit={submitUser}
      />

      <TemplateModal
        open={showTemplateModal}
        editingTemplate={editingTemplate}
        templateForm={templateForm}
        setTemplateForm={setTemplateForm}
        error={error}
        busy={busy}
        onClose={() => setShowTemplateModal(false)}
        onSubmit={submitTemplate}
      />

      <ProfileModal
        open={showProfileModal}
        user={user}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        profileError={profileError}
        profileBusy={profileBusy}
        roleLabel={roleLabel}
        onlyDigits={onlyDigits}
        onClose={() => setShowProfileModal(false)}
        onSubmit={submitProfile}
      />

      {secureAccessMode ? (
        <SecureAccessModal
          mode={secureAccessMode}
          user={user}
          users={allUsers && allUsers.length ? allUsers : users}
          busy={secureAccessBusy}
          error={secureAccessError}
          onClose={() => { setSecureAccessMode(""); setSecureAccessError(""); }}
          onSubmit={submitSecureAccess}
        />
      ) : null}

      {pendingUserDelete ? (
        <Modal
          title="Excluir usuário"
          onClose={() => { setPendingUserDelete(null); setDeleteReason(""); }}
          actions={
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => { setPendingUserDelete(null); setDeleteReason(""); }}>
                Cancelar
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={confirmUserDelete} disabled={busy}>
                {busy ? "Excluindo..." : "Excluir usuário"}
              </Button>
            </>
          }
        >
          <div className="field-grid">
            <div className="field field--span-2">
              <span className="field__label">Usuário</span>
              <Input inputClassName="input--readonly" value={`${pendingUserDelete.name} · ${pendingUserDelete.email}`} readOnly />
            </div>
            <Textarea className="field--span-2 patients-textarea" label="Justificativa *" rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Motivo institucional para exclusão do usuário..." />
          </div>
        </Modal>
      ) : null}

      {pendingTemplateDelete ? (
        <Modal
          title="Excluir protocolo"
          onClose={() => { setPendingTemplateDelete(null); setDeleteReason(""); }}
          actions={
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => { setPendingTemplateDelete(null); setDeleteReason(""); }}>
                Cancelar
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={confirmTemplateDelete} disabled={busy}>
                {busy ? "Excluindo..." : "Excluir protocolo"}
              </Button>
            </>
          }
        >
          <div className="field-grid">
            <div className="field field--span-2">
              <span className="field__label">Protocolo</span>
              <Input inputClassName="input--readonly" value={pendingTemplateDelete.label || pendingTemplateDelete.category} readOnly />
            </div>
            <Textarea className="field--span-2 patients-textarea" label="Justificativa *" rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Motivo institucional para exclusão do protocolo..." />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
