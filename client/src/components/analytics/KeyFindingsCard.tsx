import React, { useState } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { AnalyticsData } from '../../types/analytics';

interface KeyFindingsCardProps {
  analytics?: AnalyticsData;
}

export const KeyFindingsCard: React.FC<KeyFindingsCardProps> = ({ analytics }) => {
  const [showAll, setShowAll] = useState(false);
  const findings = analytics?.insights?.keyFindings || [];
  const displayedFindings = showAll ? findings : findings.slice(0, 4);

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-blue-100 text-blue-800 border-blue-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[confidence as keyof typeof colors] || colors.medium;
  };

  const getImportanceBadge = (importance?: string) => {
    const colors = {
      high: 'bg-purple-100 text-purple-800 border-purple-200',
      medium: 'bg-amber-100 text-amber-800 border-amber-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[(importance || 'medium') as keyof typeof colors] || colors.medium;
  };

  const getTypeBorderColor = (type?: string) => {
    switch (type) {
      case 'positive': return 'border-green-400';
      case 'negative': return 'border-red-400';
      case 'trend': return 'border-blue-400';
      default: return 'border-amber-400';
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'positive': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'negative': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'trend': return <TrendingUp className="w-4 h-4 text-blue-600" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-amber-600" />
        <h3 className="text-lg font-semibold text-gray-900">Key Findings</h3>
      </div>

      {findings.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No findings available yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedFindings.map((finding, index) => (
            <div key={index} className={`border-l-4 ${getTypeBorderColor(finding.type)} pl-4 py-2`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 flex-1">
                  {getTypeIcon(finding.type)}
                  <p className="text-sm font-medium text-gray-900">
                    {finding.finding}
                  </p>
                </div>
                {finding.importance && (
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border flex-shrink-0 ${getImportanceBadge(finding.importance)}`}>
                    {finding.importance}
                  </span>
                )}
              </div>

              {finding.evidence?.pattern && (
                <p className="text-xs text-gray-600 mb-2">
                  <span className="font-medium">Pattern:</span> {finding.evidence.pattern}
                </p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getConfidenceBadge(finding.confidence)}`}>
                  {finding.confidence} confidence
                </span>
                
                <span className="text-xs text-gray-500">
                  Based on {finding.basedOnResponses} {finding.basedOnResponses === 1 ? 'response' : 'responses'}
                </span>
                
                {finding.evidence?.significance && (
                  <span className="text-xs text-gray-500">
                    Significance: {(finding.evidence.significance * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {finding.evidence?.supportingQuotes && finding.evidence.supportingQuotes.length > 0 && (
                <div className="mt-2 pl-3 border-l-2 border-gray-200">
                  <p className="text-xs text-gray-700 italic">
                    "{finding.evidence.supportingQuotes[0].substring(0, 100)}..."
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {findings.length > 4 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            {showAll ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Show All {findings.length} Findings
              </>
            )}
          </button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-start gap-2 text-xs text-gray-600">
          <TrendingDown className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Key findings highlight significant patterns discovered in the response data. Red indicates areas of concern requiring attention.
          </p>
        </div>
      </div>
    </div>
  );
};
