function SectionHeader({ title, count, action }) {
  return (
    <div className="patients-head">
      <h3>{title}{count!=null?` (${count})`:""}</h3>
      {action}
    </div>
  );
}

export default SectionHeader;
