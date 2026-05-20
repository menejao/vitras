function PageLayout({ className = "", children }) {
  return <section className={["page-layout", className].filter(Boolean).join(" ")}>{children}</section>;
}

export default PageLayout;
