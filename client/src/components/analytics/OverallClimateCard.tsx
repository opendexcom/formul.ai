import { CircularGauge } from '../ui';
import { ThumbsUp, Minus, ThumbsDown } from 'lucide-react';

interface OverallClimateCardProps {
  positivityScore: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  dominantTendency: string;
  semanticAxis?: { left: string; right: string; position: number };
}

export const OverallClimateCard: React.FC<OverallClimateCardProps> = ({
  positivityScore,
  sentimentBreakdown
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Overall Response Climate</h2>
      <p className="text-sm text-gray-600 mb-4">
        Measures overall positivity by combining positive responses (full weight) and neutral responses (half weight). 
        Higher scores indicate more positive sentiment across all responses.
      </p>
      <div className="flex flex-col items-center space-y-6">
        <CircularGauge value={positivityScore} />
        
        {/* Sentiment Breakdown */}
        <div className="w-full max-w-xs space-y-3">
          <p className="text-xs font-semibold text-gray-700 text-center mb-2">Sentiment Distribution</p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-700">Positive</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${sentimentBreakdown.positive}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-900 w-10 text-right">{sentimentBreakdown.positive}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Minus className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">Neutral</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gray-400 rounded-full transition-all duration-500"
                  style={{ width: `${sentimentBreakdown.neutral}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-900 w-10 text-right">{sentimentBreakdown.neutral}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThumbsDown className="w-4 h-4 text-red-600" />
              <span className="text-sm text-gray-700">Negative</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full transition-all duration-500"
                  style={{ width: `${sentimentBreakdown.negative}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-900 w-10 text-right">{sentimentBreakdown.negative}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
