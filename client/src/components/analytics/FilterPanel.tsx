import { useState } from 'react';
import { X } from 'lucide-react';

export interface AnalyticsFilters {
  sentiment?: 'positive' | 'neutral' | 'negative' | 'ambivalent';
  topics?: string[];
  representativeness?: 'typical' | 'deviant' | 'mixed';
  depth?: 'superficial' | 'moderate' | 'deep';
}

interface FilterPanelProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
  availableTopics?: string[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  availableTopics = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof AnalyticsFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const removeFilter = (key: keyof AnalyticsFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = Object.keys(filters).length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm font-medium">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {isExpanded ? 'Hide filters' : 'Show filters'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Sentiment Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sentiment
            </label>
            <select
              value={filters.sentiment || ''}
              onChange={(e) =>
                e.target.value
                  ? updateFilter('sentiment', e.target.value)
                  : removeFilter('sentiment')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
              <option value="ambivalent">Ambivalent</option>
            </select>
          </div>

          {/* Representativeness Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Representativeness
            </label>
            <select
              value={filters.representativeness || ''}
              onChange={(e) =>
                e.target.value
                  ? updateFilter('representativeness', e.target.value)
                  : removeFilter('representativeness')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All responses</option>
              <option value="typical">Typical</option>
              <option value="deviant">Deviant</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          {/* Depth Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response Depth
            </label>
            <select
              value={filters.depth || ''}
              onChange={(e) =>
                e.target.value
                  ? updateFilter('depth', e.target.value)
                  : removeFilter('depth')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All depths</option>
              <option value="superficial">Superficial</option>
              <option value="moderate">Moderate</option>
              <option value="deep">Deep</option>
            </select>
          </div>

          {/* Topics Filter */}
          {availableTopics.length > 0 && (
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topics
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTopics.map((topic) => {
                  const isSelected = filters.topics?.includes(topic);
                  return (
                    <button
                      key={topic}
                      onClick={() => {
                        const currentTopics = filters.topics || [];
                        if (isSelected) {
                          const newTopics = currentTopics.filter((t) => t !== topic);
                          if (newTopics.length === 0) {
                            removeFilter('topics');
                          } else {
                            updateFilter('topics', newTopics);
                          }
                        } else {
                          updateFilter('topics', [...currentTopics, topic]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                          : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {topic}
                      {isSelected && <X className="inline-block w-3 h-3 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Filters Display */}
      {!isExpanded && activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {filters.sentiment && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
              Sentiment: {filters.sentiment}
              <button
                onClick={() => removeFilter('sentiment')}
                className="hover:bg-blue-100 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.representativeness && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
              Type: {filters.representativeness}
              <button
                onClick={() => removeFilter('representativeness')}
                className="hover:bg-blue-100 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.depth && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
              Depth: {filters.depth}
              <button
                onClick={() => removeFilter('depth')}
                className="hover:bg-blue-100 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.topics && filters.topics.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
              Topics: {filters.topics.length}
              <button
                onClick={() => removeFilter('topics')}
                className="hover:bg-blue-100 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
