import React from 'react';
import { BarChart3, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { AnalyticsData } from '../../types/analytics';

interface TopicSentimentCardProps {
  analytics?: AnalyticsData;
  selectedTopics?: string[];
}

export const TopicSentimentCard: React.FC<TopicSentimentCardProps> = ({ analytics, selectedTopics = [] }) => {
  const topicCorrelations = analytics?.sentiment?.topicCorrelations || [];

  // Filter by selected topics if any are selected
  const filteredCorrelations = selectedTopics.length > 0
    ? topicCorrelations.filter(correlation => selectedTopics.includes(correlation.topic))
    : topicCorrelations;

  // Helper to get sentiment data (handles both old and new field names)
  const getSentimentData = (correlation: any) => {
    // New field names
    if (correlation.sentiment) {
      return {
        sentiment: correlation.sentiment,
        averageScore: correlation.averageScore ?? 0,
        responseCount: correlation.responseCount ?? 0
      };
    }
    // Old field names (backwards compatibility)
    if (correlation.sentimentBreakdown) {
      return {
        sentiment: correlation.sentimentBreakdown,
        averageScore: correlation.avgSentimentScore ?? 0,
        responseCount: correlation.totalResponses ?? 0
      };
    }
    // Fallback
    return {
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      averageScore: 0,
      responseCount: 0
    };
  };

  if (filteredCorrelations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Topic Sentiment</h3>
        </div>
        <p className="text-sm text-gray-500">
          {selectedTopics.length > 0 
            ? 'No sentiment data available for selected topics' 
            : 'No topic-sentiment correlations available'}
        </p>
      </div>
    );
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-700 bg-green-50';
      case 'mostly positive': return 'text-green-600 bg-green-50';
      case 'negative': return 'text-red-700 bg-red-50';
      case 'mostly negative': return 'text-red-600 bg-red-50';
      case 'mixed': return 'text-amber-700 bg-amber-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
      case 'mostly positive':
        return <ThumbsUp className="w-4 h-4" />;
      case 'negative':
      case 'mostly negative':
        return <ThumbsDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">Topic Sentiment Analysis</h3>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        How respondents feel about different topics
        {selectedTopics.length > 0 && (
          <span className="ml-2 text-blue-600 font-medium">
            (filtered to {selectedTopics.length} {selectedTopics.length === 1 ? 'topic' : 'topics'})
          </span>
        )}
      </p>

      <div className="space-y-3">
        {filteredCorrelations.slice(0, 8).map((correlation, index) => {
          const { sentiment, averageScore, responseCount } = getSentimentData(correlation);
          
          return (
            <div 
              key={index}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {correlation.topic}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getSentimentColor(correlation.dominantSentiment)}`}>
                    {getSentimentIcon(correlation.dominantSentiment)}
                    {correlation.dominantSentiment}
                  </span>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                  {responseCount} {responseCount === 1 ? 'response' : 'responses'}
                </span>
              </div>

              {/* Sentiment breakdown bar */}
              <div className="flex items-center gap-1 h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                {sentiment.positive > 0 && (
                  <div 
                    className="bg-green-500 h-full"
                    style={{ width: `${sentiment.positive}%` }}
                    title={`${sentiment.positive}% positive`}
                  />
                )}
                {sentiment.neutral > 0 && (
                  <div 
                    className="bg-gray-400 h-full"
                    style={{ width: `${sentiment.neutral}%` }}
                    title={`${sentiment.neutral}% neutral`}
                  />
                )}
                {sentiment.negative > 0 && (
                  <div 
                    className="bg-red-500 h-full"
                    style={{ width: `${sentiment.negative}%` }}
                    title={`${sentiment.negative}% negative`}
                  />
                )}
              </div>

              {/* Sentiment percentages */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  {sentiment.positive > 0 && (
                    <span className="text-green-700">
                      <span className="font-medium">{sentiment.positive}%</span> positive
                    </span>
                  )}
                  {sentiment.neutral > 0 && (
                    <span className="text-gray-600">
                      <span className="font-medium">{sentiment.neutral}%</span> neutral
                    </span>
                  )}
                  {sentiment.negative > 0 && (
                    <span className="text-red-700">
                      <span className="font-medium">{sentiment.negative}%</span> negative
                    </span>
                  )}
                </div>
                <span className="text-gray-500">
                  avg: {averageScore.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCorrelations.length > 8 && (
        <div className="mt-4 text-center">
          <span className="text-xs text-gray-500">
            Showing top 8 of {filteredCorrelations.length} topics
          </span>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <ThumbsUp className="w-4 h-4" />
              <span className="text-xs font-medium">Positive</span>
            </div>
            <p className="text-xs text-gray-600">High satisfaction</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
              <Minus className="w-4 h-4" />
              <span className="text-xs font-medium">Mixed</span>
            </div>
            <p className="text-xs text-gray-600">Varied opinions</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <ThumbsDown className="w-4 h-4" />
              <span className="text-xs font-medium">Negative</span>
            </div>
            <p className="text-xs text-gray-600">Needs attention</p>
          </div>
        </div>
      </div>
    </div>
  );
};
