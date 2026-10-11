import React from 'react';
import { Citation } from '../../types/comparative-report';

interface CitationChipsProps {
  citations: Citation[];
  onCitationClick?: (citation: Citation) => void;
}

export const CitationChips: React.FC<CitationChipsProps> = ({
  citations,
  onCitationClick,
}) => {
  if (!citations.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {citations.map((citation, index) => (
        <button
          key={`${citation.responseId}-${index}`}
          type="button"
          onClick={() => onCitationClick?.(citation)}
          className="max-w-xs truncate rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-left text-xs text-blue-800 hover:bg-blue-100"
          title={`${citation.variantKey}: ${citation.quote}`}
        >
          {citation.variantKey}: &ldquo;{citation.quote.slice(0, 60)}
          {citation.quote.length > 60 ? '…' : ''}&rdquo;
        </button>
      ))}
    </div>
  );
};
