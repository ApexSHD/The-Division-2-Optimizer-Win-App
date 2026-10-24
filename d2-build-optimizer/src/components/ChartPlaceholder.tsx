interface ChartPlaceholderProps {
  label: string;
  height?: number;
}

export function ChartPlaceholder({ label, height = 160 }: ChartPlaceholderProps) {
  return (
    <div className="chart-placeholder" style={{ minHeight: height }} aria-label={label}>
      <span className="chart-icon">📈</span>
      <span>{label}</span>
    </div>
  );
}
