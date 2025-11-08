import React from 'react';
import { Target, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AnalyticsData } from '../../types/analytics';

interface RecommendationsCardProps {
  analytics?: AnalyticsData;
}

export const RecommendationsCard: React.FC<RecommendationsCardProps> = ({ analytics }) => {
  const recommendations = analytics?.insights?.recommendations || [];

  const getPriorityConfig = (priority: string) => {
    const configs = {
      urgent: {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        badgeColor: 'bg-red-100 text-red-800 border-red-200',
      },
      important: {
        icon: Target,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      },
      maintain: {
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        badgeColor: 'bg-green-100 text-green-800 border-green-200',
      },
    };
    return configs[priority as keyof typeof configs] || configs.important;
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-blue-100 text-blue-800 border-blue-200',
      medium: 'bg-gray-100 text-gray-800 border-gray-200',
      low: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return colors[confidence as keyof typeof colors] || colors.medium;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
      </div>

      {recommendations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No recommendations available yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.slice(0, 3).map((rec, index) => {
            const config = getPriorityConfig(rec.priority);
            const Icon = config.icon;

            return (
              <div 
                key={index} 
                className={`rounded-lg border-l-4 ${config.borderColor} p-4 ${config.bgColor}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.color}`} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {rec.recommendation}
                      </h4>
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border flex-shrink-0 ${config.badgeColor}`}>
                        {rec.priority}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 mb-2">
                      <span className="font-medium">Based on:</span> {rec.basedOn}
                    </p>

                    <p className="text-xs text-gray-700 mb-2">
                      <span className="font-medium">Action:</span> {rec.suggestedAction}
                    </p>

                    {rec.expectedImpact && (
                      <p className="text-xs text-gray-600 mb-2">
                        <span className="font-medium">Impact:</span> {rec.expectedImpact}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getConfidenceBadge(rec.confidence)}`}>
                        {rec.confidence} confidence
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recommendations.length > 3 && (
        <div className="mt-4 text-center">
          <span className="text-xs text-gray-500">
            Showing top 3 of {recommendations.length} recommendations
          </span>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <AlertCircle className="w-3 h-3" />
              <span className="font-medium">Urgent</span>
            </div>
            <p className="text-gray-600">Immediate action</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
              <Target className="w-3 h-3" />
              <span className="font-medium">Important</span>
            </div>
            <p className="text-gray-600">Plan for change</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <CheckCircle2 className="w-3 h-3" />
              <span className="font-medium">Maintain</span>
            </div>
            <p className="text-gray-600">Keep it up</p>
          </div>
        </div>
      </div>
    </div>
  );
};
