export default function WorkspaceHero({
  eyebrow,
  title,
  description,
  actions,
  className = "",
}) {
  return (
    <section className={["hero workspace-hero workspace-hero--solo", className].filter(Boolean).join(" ")}>
      <div className="workspace-hero__content">
        {eyebrow ? <span className="hero__kicker">{eyebrow}</span> : null}
        {title ? <h1>{title}</h1> : null}
        {description ? <p>{description}</p> : null}
        {actions ? <div className="workspace-hero__actions">{actions}</div> : null}
      </div>
    </section>
  );
}
