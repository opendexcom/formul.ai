import React from 'react';
import { FileText, TrendingUp } from 'lucide-react';

interface AnalyticsSummaryCardProps {
  summary: string;
  totalResponses: number;
  lastUpdated?: Date;
}

// Simple markdown renderer for basic formatting
const renderMarkdown = (text: string): React.ReactNode => {
  // Split by lines to handle lists
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let listType: 'ordered' | 'unordered' | null = null;

  const flushList = () => {
    if (currentList.length > 0) {
      if (listType === 'ordered') {
        elements.push(
          <ol key={elements.length} className="list-decimal list-inside space-y-1 my-2">
            {currentList.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }} />
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={elements.length} className="list-disc list-inside space-y-1 my-2">
            {currentList.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }} />
            ))}
          </ul>
        );
      }
      currentList = [];
      listType = null;
    }
  };

  const formatInlineMarkdown = (line: string): string => {
    // Convert markdown to HTML
    // Bold **text**
    line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Quotes "text" - keep them as regular text, no special formatting
    return line;
  };

  lines.forEach((line) => {
    line = line.trim();
    
    // Ordered list (1. 2. 3.)
    if (/^\d+\.\s/.test(line)) {
      if (listType !== 'ordered') {
        flushList();
        listType = 'ordered';
      }
      currentList.push(line.replace(/^\d+\.\s*/, ''));
    }
    // Unordered list (- or •)
    else if (/^[-•]\s/.test(line)) {
      if (listType !== 'unordered') {
        flushList();
        listType = 'unordered';
      }
      currentList.push(line.replace(/^[-•]\s*/, ''));
    }
    // Regular paragraph
    else if (line) {
      flushList();
      elements.push(
        <p 
          key={elements.length} 
          className="text-gray-700 leading-relaxed mb-2 [&_strong]:font-semibold [&_strong]:text-gray-900 [&_em]:italic [&_em]:text-blue-700"
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }}
        />
      );
    }
  });

  flushList(); // Flush any remaining list

  return <>{elements}</>;
};

export const AnalyticsSummaryCard: React.FC<AnalyticsSummaryCardProps> = ({
  summary,
  totalResponses,
  lastUpdated,
}) => {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Analysis Summary
            </h2>
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Updated {new Date(lastUpdated).toLocaleDateString()}
              </span>
            )}
          </div>
          
          <div className="prose prose-sm max-w-none text-base">
            {renderMarkdown(summary)}
          </div>
          
          <div className="mt-4 pt-3 border-t border-blue-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium text-blue-700">{totalResponses}</span>
              <span>responses analyzed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
