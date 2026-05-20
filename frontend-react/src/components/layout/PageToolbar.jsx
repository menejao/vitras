function PageToolbar({ className = "", children }) {
  return (
    <section className={["page-toolbar", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}

export default PageToolbar;
