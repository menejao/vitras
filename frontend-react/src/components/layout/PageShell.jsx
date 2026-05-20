function PageShell({ className = "", children }) {
  return (
    <section className={["page-shell", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}

export default PageShell;
