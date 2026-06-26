function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  iconOnly = false,
  full = false,
  loading = false,
  className = "",
  type = "button",
  children,
  ...props
}) {
  const classes = [
    "btn",
    `btn--${variant}`,
    size !== "md" ? `btn--${size}` : "",
    iconOnly ? "btn--icon" : "",
    full ? "btn--full" : "",
    loading ? "btn--loading" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <Component
      className={classes}
      type={Component === "button" ? type : undefined}
      aria-busy={loading || undefined}
      disabled={props.disabled || loading}
      {...props}
    >
      {children}
    </Component>
  );
}

export default Button;
