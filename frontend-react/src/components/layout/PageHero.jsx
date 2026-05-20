import InternalHero from "./InternalHero";

export default function PageHero({ badge, title, subtitle, actions, children }) {
  return (
    <InternalHero
      eyebrow={badge}
      title={title}
      description={subtitle}
      actions={actions}
    >
      {children}
    </InternalHero>
  );
}
