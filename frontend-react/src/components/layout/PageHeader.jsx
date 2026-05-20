import InternalHero from "./InternalHero";
import WorkspaceHero from "./WorkspaceHero";

const WORKSPACE_TITLES = new Set([
  "Visão operacional da unidade",
  "Indicadores à Vista",
  "Relatórios",
  "Diagnósticos",
]);

function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  search,
  children,
  variant = "internal",
  className = "",
}) {
  const resolvedVariant = variant === "internal" && WORKSPACE_TITLES.has(String(title || "").trim())
    ? "workspace"
    : variant;

  if (resolvedVariant === "workspace") {
    return (
      <WorkspaceHero
        eyebrow={eyebrow}
        title={title}
        description={subtitle}
        actions={actions}
        className={className}
      />
    );
  }

  return (
    <InternalHero
      eyebrow={eyebrow}
      title={title}
      description={subtitle}
      actions={actions}
      search={search}
      className={className}
    >
      {children}
    </InternalHero>
  );
}

export default PageHeader;
