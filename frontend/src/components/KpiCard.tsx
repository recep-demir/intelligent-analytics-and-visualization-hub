interface KpiCardProps {
  label:    string;
  value:    string;
  subtitle?: string;
}

export function KpiCard({ label, value, subtitle }: KpiCardProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs font-mono uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
    </div>
  );
}
