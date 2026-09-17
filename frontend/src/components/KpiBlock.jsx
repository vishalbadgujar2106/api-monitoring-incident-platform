export function KpiBlock({ label, value, tone }) {
  return (
    <div className={`kpi-block ${tone ? `kpi-block--${tone}` : ''}`}>
      <span className="kpi-block__label">{label}</span>
      <span className="kpi-block__value">{value}</span>
    </div>
  );
}
