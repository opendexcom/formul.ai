// Using automatic JSX runtime; no React import needed

export interface DataPoint {
  label: string;
  value: number;
}

interface ChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  colors?: string[];
}

export const SimpleBarChart: React.FC<ChartProps> = ({ data, width = 600, height = 240, colors }) => {
  const max = Math.max(1, ...data.map(d => d.value));
  const barGap = 12;
  const barWidth = (width - barGap * (data.length + 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Axes */}
      <line x1={40} y1={10} x2={40} y2={height - 30} stroke="#e5e7eb" />
      <line x1={40} y1={height - 30} x2={width - 10} y2={height - 30} stroke="#e5e7eb" />

      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * (height - 60));
        const x = 40 + barGap + i * (barWidth + barGap);
        const y = height - 30 - h;
        const color = colors?.[i % (colors.length || 1)] || '#2563eb';
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barWidth} height={h} rx={4} fill={color} />
            <text x={x + barWidth / 2} y={height - 12} textAnchor="middle" fontSize={11} fill="#6b7280">
              {d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label}
            </text>
            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize={12} fill="#111827">
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const SimplePieChart: React.FC<ChartProps> = ({ data, width = 260, height = 260, colors }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = Math.min(width, height) / 2 - 6;
  const cx = width / 2;
  const cy = height / 2;

  let startAngle = -Math.PI / 2;

  const wedges = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const color = colors?.[i % (colors.length || 1)] || '#10b981';

    const midAngle = startAngle + angle / 2;
    const lx = cx + (radius + 14) * Math.cos(midAngle);
    const ly = cy + (radius + 14) * Math.sin(midAngle);

    const label = (
      <text key={`label-${i}`} x={lx} y={ly} textAnchor={Math.cos(midAngle) >= 0 ? 'start' : 'end'} fontSize={12} fill="#111827">
        {d.label} ({total ? Math.round((d.value / total) * 100) : 0}%)
      </text>
    );

    const wedge = (
      <path key={`wedge-${i}`} d={path} fill={color} stroke="#fff" strokeWidth={1} />
    );

    startAngle = endAngle;
    return { wedge, label };
  });

  return (
    <svg viewBox={`0 0 ${width + 140} ${height}`} className="w-full h-auto">
      <g>
        {wedges.map(w => w.wedge)}
      </g>
      <g>
        {wedges.map(w => w.label)}
      </g>
    </svg>
  );
};
