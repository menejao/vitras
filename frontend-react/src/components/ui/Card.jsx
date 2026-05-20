function Card({ className = "", children, ...props }) {
  return (
    <section className={["card", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </section>
  );
}

export default Card;
