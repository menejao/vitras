function MainContent({ className = "", children }) {
  return (
    <main className={["page-main-content", className].filter(Boolean).join(" ")}>
      {children}
    </main>
  );
}

export default MainContent;
