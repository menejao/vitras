function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  iconOnly = false,
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
    className,
  ].filter(Boolean).join(" ");

  return (
    <Component className={classes} type={Component === "button" ? type : undefined} {...props}>
      {children}
    </Component>
  );
}

export default Button;
