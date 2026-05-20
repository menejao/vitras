function KpiGrid({ className = "", children }) {
  return (
    <section className={["page-kpi-grid", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}

export default KpiGrid;
