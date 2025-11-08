import React from 'react';
import { AnalyticsData } from '../../types/analytics';
import { TrendingUp, MessageCircle, AlertTriangle, Sparkles } from 'lucide-react';

interface TopicsThemesCardProps {
  analytics?: AnalyticsData;
  onTopicClick?: (topic: string) => void;
  selectedTopics?: string[];
}

export const TopicsThemesCard: React.FC<TopicsThemesCardProps> = ({ analytics, onTopicClick, selectedTopics = [] }) => {
  if (!analytics?.topics) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Topics & Themes</h2>
        <p className="text-sm text-gray-500">No analytics data available. Generate analytics to see topics and themes.</p>
      </div>
    );
  }

  const { dominantThemes = [], emergingThemes = [], counterNarratives = [] } = analytics.topics;

  const renderDominantThemes = () => {
    if (dominantThemes.length === 0) {
      return <p className="text-sm text-gray-500">No dominant themes identified.</p>;
    }

    return (
      <div className="space-y-3">
        {dominantThemes.map((theme, idx) => {
          const isSelected = selectedTopics.includes(theme.theme);
          return (
            <div 
              key={idx} 
              className={`border-l-4 pl-3 py-2 cursor-pointer transition-colors rounded-r ${
                isSelected 
                  ? 'border-blue-600 bg-blue-50' 
                  : 'border-blue-500 hover:bg-blue-50'
              }`}
              onClick={() => onTopicClick?.(theme.theme)}
              title={`Click to ${isSelected ? 'remove' : 'add'} filter: ${theme.theme}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className={`font-medium flex-1 ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                  {theme.theme}
                </h4>
                <span className="text-sm font-semibold text-gray-700">{theme.frequency}×</span>
              </div>
            {theme.representativeQuotes && theme.representativeQuotes.length > 0 && (
              <div className="mt-2 space-y-1">
                {theme.representativeQuotes.slice(0, 2).map((quote, qIdx) => (
                  <p key={qIdx} className="text-sm text-gray-600 italic line-clamp-2">
                    "{quote}"
                  </p>
                ))}
              </div>
            )}
            {theme.relatedQuestions && theme.relatedQuestions.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Related to: {theme.relatedQuestions.join(', ')}
              </p>
            )}
          </div>
          );
        })}
      </div>
    );
  };

  const renderEmergingThemes = () => {
    if (emergingThemes.length === 0) {
      return null;
    }

    return (
      <div className="mt-6 pt-4 border-t">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Emerging Themes
        </h3>
        <div className="space-y-2">
          {emergingThemes.slice(0, 3).map((theme, idx) => {
            const isSelected = selectedTopics.includes(theme.theme);
            return (
              <div 
                key={idx} 
                className={`rounded-md p-3 cursor-pointer transition-colors ${
                  isSelected 
                    ? 'bg-amber-100 ring-2 ring-amber-400' 
                    : 'bg-amber-50 hover:bg-amber-100'
                }`}
                onClick={() => onTopicClick?.(theme.theme)}
                title={`Click to ${isSelected ? 'remove' : 'add'} filter: ${theme.theme}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className={`font-medium text-sm flex-1 ${isSelected ? 'text-amber-900' : 'text-gray-900'}`}>
                    {theme.theme}
                  </h4>
                <div className="flex items-center gap-1">
                  {theme.trend === 'growing' && <TrendingUp className="w-3 h-3 text-amber-600" />}
                  <span className="text-xs font-semibold text-amber-700">{theme.frequency}×</span>
                </div>
              </div>
              {theme.representativeQuotes && theme.representativeQuotes.length > 0 && (
                <p className="text-xs text-gray-600 italic line-clamp-1">
                  "{theme.representativeQuotes[0]}"
                </p>
              )}
            </div>
          );
          })}
        </div>
      </div>
    );
  };

  const renderCounterNarratives = () => {
    if (counterNarratives.length === 0) {
      return null;
    }

    return (
      <div className="mt-6 pt-4 border-t">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-purple-500" />
          Counter-Narratives
        </h3>
        <div className="space-y-2">
          {counterNarratives.slice(0, 3).map((narrative, idx) => (
            <div 
              key={idx} 
              className="bg-purple-50 rounded-md p-3 cursor-pointer hover:bg-purple-100 transition-colors"
              onClick={() => onTopicClick?.(narrative.narrative)}
              title={`Click to filter responses with narrative: ${narrative.narrative}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-medium text-gray-900 text-sm flex-1">{narrative.narrative}</h4>
                <span className="text-xs font-semibold text-purple-700">{narrative.frequency}×</span>
              </div>
              <p className="text-xs text-gray-600">{narrative.contrast}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTopicSaturation = () => {
    if (!analytics.topics.saturation) return null;

    const { saturated, reasoning, missingPerspectives } = analytics.topics.saturation;

    return (
      <div className="mt-6 pt-4 border-t">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Theoretical Saturation</h3>
        <div className={`p-3 rounded-md ${saturated ? 'bg-green-50' : 'bg-amber-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              saturated ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {saturated ? 'Saturated' : 'Not Saturated'}
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-2">{reasoning}</p>
          {!saturated && missingPerspectives.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-700 mb-1">Missing perspectives:</p>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                {missingPerspectives.map((perspective, idx) => (
                  <li key={idx}>{perspective}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">Topics & Themes</h2>
      </div>

      {renderDominantThemes()}
      {renderEmergingThemes()}
      {renderCounterNarratives()}
      {renderTopicSaturation()}
    </div>
  );
};
