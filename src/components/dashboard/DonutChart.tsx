interface DonutChartProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
}

const DonutChart = ({ value, max, size = 120, strokeWidth = 10, color = 'hsl(var(--primary))', bgColor = 'hsl(var(--muted))', children }: DonutChartProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export default DonutChart;
