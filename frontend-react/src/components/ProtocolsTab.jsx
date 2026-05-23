import PageHero from "./layout/PageHero";
import EmptyState from "./ui/EmptyState";
import Button from "./ui/Button";

function ProtocolsTab({ templates, canManageUser, onEdit, onDelete }) {
  return (
    <div className="page-layout">
      <PageHero
        badge="Protocolos Clínicos"
        title="Protocolos"
        subtitle="Metas e etapas de acompanhamento por categoria de paciente."
        actions={canManageUser && (
          <Button size="sm" onClick={() => onEdit(null)()}>+ Novo protocolo</Button>
        )}
      />
      <div className="card card--noPad">
        {!templates.length
          ? <EmptyState title="Nenhum protocolo cadastrado." />
          : <div className="protocol-list">
              {templates.map(tpl => (
                <div key={tpl.category} className="protocol-list__row">
                  <div className="protocol-list__info">
                    <div className="protocol-list__head">
                      <strong className="protocol-list__name">{tpl.label}</strong>
                      <span className="protocol-list__tag">{tpl.category}</span>
                    </div>
                    <div className="protocol-list__stats">
                      <span>Visitas: <strong>{Number(tpl?.targets?.visits || 0)}</strong></span>
                      <span>Consultas: <strong>{Number(tpl?.targets?.consultations || 0)}</strong></span>
                      <span>Vacinas: <strong>{Number(tpl?.targets?.vaccines || 0)}</strong></span>
                    </div>
                    {Array.isArray(tpl?.vaccines) && tpl.vaccines.length > 0 && (
                      <div className="protocol-list__vaccines">Vacinas: {tpl.vaccines.join(", ")}</div>
                    )}
                  </div>
                  {canManageUser && (
                    <div className="actions">
                      <Button variant="secondary" size="sm" onClick={() => onEdit(tpl)()}>Editar</Button>
                      <Button variant="danger" size="sm" onClick={() => onDelete(tpl)}>Excluir</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

export default ProtocolsTab;
