interface MasteryRingProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
}

export function MasteryRing({ percentage, size = 'md', showLabel = false, label }: MasteryRingProps) {
  const dimensions = {
    sm: { width: 48, strokeWidth: 4, text: 'text-xs' },
    md: { width: 80, strokeWidth: 6, text: 'text-sm' },
    lg: { width: 120, strokeWidth: 8, text: 'text-lg' }
  };

  const config = dimensions[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on percentage
  const getColor = () => {
    if (percentage >= 80) return '#22C55E'; // Green
    if (percentage >= 60) return '#EAB308'; // Yellow
    return '#EF4444'; // Red
  };

  const color = getColor();

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={config.width} height={config.width} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={config.strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
        {/* Percentage text */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dy=".3em"
          className={`${config.text} fill-[#111827] transform rotate-90`}
          style={{ transformOrigin: 'center' }}
        >
          {percentage}%
        </text>
      </svg>
      {showLabel && label && (
        <div className="text-sm text-[#6B7280] text-center">{label}</div>
      )}
    </div>
  );
}
