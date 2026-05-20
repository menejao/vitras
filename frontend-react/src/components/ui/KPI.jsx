function KPI({ label, value, helper, className = "", children }) {
  return (
    <section className={["kpi", className].filter(Boolean).join(" ")}>
      {children ?? (
        <>
          <span className="kpi__label">{label}</span>
          <strong className="kpi__value">{value}</strong>
          {helper ? <span className="kpi__helper">{helper}</span> : null}
        </>
      )}
    </section>
  );
}

export default KPI;
