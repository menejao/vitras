function Table({ className = "", children, ...props }) {
  return (
    <div className="table-wrap">
      <table className={["table", className].filter(Boolean).join(" ")} {...props}>
        {children}
      </table>
    </div>
  );
}

export default Table;
