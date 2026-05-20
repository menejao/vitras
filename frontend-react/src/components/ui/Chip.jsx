function Chip({ tone = "muted", children }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export default Chip;
