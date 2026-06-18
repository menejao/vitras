export default function ComplianceBadge() {
  return (
    <div className="compliance-badge">
      <span className="compliance-badge__icon">•</span>
      <span>CFM 1638/2002 · Lei 13.787/2018 · LGPD · ANVISA RDC 20/2011 · PNAB 2.436/2017</span>
      <span className="compliance-badge__sep">·</span>
      <a href="/privacidade" className="compliance-badge__link" target="_blank" rel="noopener noreferrer">
        Política de Privacidade
      </a>
    </div>
  );
}
