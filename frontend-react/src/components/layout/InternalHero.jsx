export default function InternalHero({
  eyebrow,
  title,
  description,
  search,
  actions,
  children,
  className = "",
}) {
  return (
    <section className={["hero hero--compact internal-hero", className].filter(Boolean).join(" ")}>
      <div className="internal-hero__main">
        <div className="internal-hero__copy">
          {eyebrow ? <span className="hero__kicker">{eyebrow}</span> : null}
          {title ? <h1>{title}</h1> : null}
          {description ? <p>{description}</p> : null}
          {children}
        </div>
        {search ? <div className="internal-hero__search">{search}</div> : null}
      </div>
      {actions ? <div className="internal-hero__actions">{actions}</div> : null}
    </section>
  );
}
