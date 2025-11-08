import React from 'react';
import { BarChart, Filter, Users, Info } from 'lucide-react';
import { AnalyticsData } from '../../types/analytics';

interface ClosedQuestionTopicsCardProps {
  analytics?: AnalyticsData;
  selectedTopics?: string[];
  hasActiveFilters?: boolean;
}

export const ClosedQuestionTopicsCard: React.FC<ClosedQuestionTopicsCardProps> = ({ 
  analytics, 
  selectedTopics = [],
  hasActiveFilters = false
}) => {
  const closedQuestionCorrelations = analytics?.correlations?.closedQuestionTopics || [];

  // Filter by selected topics if any
  const filteredCorrelations = selectedTopics.length > 0
    ? closedQuestionCorrelations.map(question => ({
        ...question,
        correlations: question.correlations.map(answer => ({
          ...answer,
          topicDistribution: answer.topicDistribution.filter(topic => 
            selectedTopics.includes(topic.topic)
          )
        })).filter(answer => answer.topicDistribution.length > 0)
      })).filter(question => question.correlations.length > 0)
    : closedQuestionCorrelations;

  if (filteredCorrelations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Answer Segmentation
          </h3>
        </div>
        <p className="text-sm text-gray-500">
          {selectedTopics.length > 0
            ? 'No answer segmentation found for selected topics'
            : 'No closed questions to segment by topics'}
        </p>
      </div>
    );
  }

  const getTopicColor = (index: number) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-amber-100 text-amber-800',
      'bg-pink-100 text-pink-800',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Answer Segmentation
        </h3>
      </div>
      
      {hasActiveFilters && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> This data is calculated from all responses. 
            {selectedTopics.length > 0 
              ? ' Only showing topics matching your filter.' 
              : ' Other filters (sentiment, depth) do not affect this view.'}
          </p>
        </div>
      )}
      
      <p className="text-sm text-gray-600 mb-4">
        Topic preferences by answer choices
        {selectedTopics.length > 0 && (
          <span className="ml-2 text-blue-600 font-medium">
            (filtered to {selectedTopics.length} {selectedTopics.length === 1 ? 'topic' : 'topics'})
          </span>
        )}
      </p>

      <div className="space-y-6">
        {filteredCorrelations.map((question, qIndex) => (
          <div key={qIndex} className="border-b border-gray-200 last:border-0 pb-4 last:pb-0">
            {/* Question header */}
            <div className="flex items-start gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{question.questionTitle}</h4>
                <span className="text-xs text-gray-500 capitalize">{question.questionType}</span>
              </div>
            </div>

            {/* Answer values in 2-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {question.correlations.map((answer, aIndex) => (
                <div key={aIndex} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{answer.answerValue}</span>
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      <Users className="w-3 h-3" />
                      {answer.responseCount} {answer.responseCount === 1 ? 'response' : 'responses'}
                    </span>
                  </div>

                  {/* Topic distribution */}
                  {answer.topicDistribution.length > 0 ? (
                    <div className="space-y-1.5">
                      {answer.topicDistribution.slice(0, 5).map((topic, tIndex) => (
                        <div key={tIndex} className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={`inline-flex px-2 py-0.5 rounded font-medium ${getTopicColor(tIndex)}`}>
                                {topic.topic}
                              </span>
                              <span className="text-gray-600 font-medium">{topic.percentage}%</span>
                            </div>
                            {/* Progress bar */}
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${getTopicColor(tIndex).split(' ')[0]}`}
                                style={{ width: `${topic.percentage}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">
                            {topic.count}
                          </span>
                        </div>
                      ))}
                      {answer.topicDistribution.length > 5 && (
                        <p className="text-xs text-gray-500 text-center mt-2">
                          +{answer.topicDistribution.length - 5} more topics
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No topics discussed</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          <strong>How to read:</strong> Shows which topics are most discussed by respondents who selected different answer choices.
          Higher percentages indicate stronger topic preferences for that answer group.
        </p>
      </div>
    </div>
  );
};
