function Badge({ tone = "neutral", className = "", children, ...props }) {
  return (
    <span className={["badge", tone !== "neutral" ? `badge--${tone}` : "", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}

export default Badge;
