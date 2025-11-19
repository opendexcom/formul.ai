interface CircularGaugeProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  colors?: { low: string; mid: string; high: string };
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({ 
  value, 
  size = 120, 
  strokeWidth = 12,
  colors = { low: '#ef4444', mid: '#a78bfa', high: '#6366f1' }
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;
  
  // Determine color based on value
  const color = value >= 70 ? colors.high : value >= 40 ? colors.mid : colors.low;
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">{value}%</div>
        </div>
      </div>
    </div>
  );
};

interface SemanticSliderProps {
  left: string;
  right: string;
  position: number; // -1 to 1
}

export const SemanticSlider: React.FC<SemanticSliderProps> = ({ left, right, position }) => {
  const percentage = ((position + 1) / 2) * 100;
  
  return (
    <div className="w-full">
      <p className="text-xs text-gray-500 text-center mb-3">Emotional Tone Spectrum</p>
      <div className="flex items-center justify-between text-xs font-medium text-gray-700 mb-2">
        <span className="truncate max-w-[45%] capitalize">{left}</span>
        <span className="truncate max-w-[45%] capitalize">{right}</span>
      </div>
      <div className="relative h-3 bg-gradient-to-r from-orange-200 via-purple-200 to-indigo-200 rounded-full shadow-inner">
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full border-3 border-indigo-600 shadow-lg transition-all duration-500 flex items-center justify-center"
          style={{ left: `calc(${percentage}% - 10px)` }}
        >
          <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
        </div>
      </div>
      <p className="text-xs text-gray-500 text-center mt-2">
        Responses lean toward <span className="font-semibold capitalize">{percentage < 50 ? left : right}</span>
      </p>
    </div>
  );
};
