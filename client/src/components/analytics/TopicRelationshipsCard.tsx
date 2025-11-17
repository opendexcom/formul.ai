import React from 'react';
import { Network, TrendingUp } from 'lucide-react';
import { AnalyticsData } from '../../types/analytics';

interface TopicRelationshipsCardProps {
  analytics?: AnalyticsData;
  selectedTopics?: string[];
}

export const TopicRelationshipsCard: React.FC<TopicRelationshipsCardProps> = ({ analytics, selectedTopics = [] }) => {
  const cooccurrences = analytics?.topics?.cooccurrence || [];

  // Filter by selected topics if any are selected
  const filteredCooccurrences = selectedTopics.length > 0
    ? cooccurrences.filter(co => 
        selectedTopics.includes(co.topic1) || selectedTopics.includes(co.topic2)
      )
    : cooccurrences;

  if (filteredCooccurrences.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Network className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Topic Relationships</h3>
        </div>
        <p className="text-gray-500 text-sm">
          {selectedTopics.length > 0 
            ? 'No topic relationships found for selected topics' 
            : 'No topic relationships found'}
        </p>
      </div>
    );
  }

  // Get relationship color
  const getRelationshipColor = (relationship: string) => {
    switch (relationship) {
      case 'strong': return 'bg-green-100 text-green-800 border-green-200';
      case 'moderate': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'weak': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRelationshipIcon = (relationship: string) => {
    switch (relationship) {
      case 'strong': return '●●●';
      case 'moderate': return '●●○';
      case 'weak': return '●○○';
      default: return '○○○';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Network className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">Topic Relationships</h3>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        Topics that frequently appear together in responses
        {selectedTopics.length > 0 && (
          <span className="ml-2 text-blue-600 font-medium">
            (filtered to {selectedTopics.length} {selectedTopics.length === 1 ? 'topic' : 'topics'})
          </span>
        )}
      </p>

      <div className="space-y-3">
        {filteredCooccurrences.slice(0, 10).map((co, index) => (
          <div 
            key={index}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
          >
            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 text-xs font-bold">
              {index + 1}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {co.topic1}
                </span>
                <span className="text-gray-400">↔</span>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {co.topic2}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getRelationshipColor(co.relationship)}`}>
                  <span className="mr-1">{getRelationshipIcon(co.relationship)}</span>
                  {co.relationship}
                </span>
                
                <span className="text-xs text-gray-600">
                  {co.frequency} {co.frequency === 1 ? 'response' : 'responses'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCooccurrences.length > 10 && (
        <div className="mt-4 text-center">
          <span className="text-xs text-gray-500">
            Showing top 10 of {filteredCooccurrences.length} topic relationships
          </span>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-start gap-2 text-xs text-gray-600">
          <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Strong relationships indicate topics frequently discussed together, 
            suggesting thematic connections in responses.
          </p>
        </div>
      </div>
    </div>
  );
};
