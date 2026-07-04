import React from 'react';
import {
  Citation,
  PaginatedProjectResponse,
  VariantKey,
} from '../../types/comparative-report';

interface CrossVariantResponsesTableProps {
  responses: PaginatedProjectResponse[];
  page: number;
  totalPages: number;
  total: number;
  highlightedResponseId?: string;
  variantFilter?: VariantKey | 'all';
  onVariantFilterChange?: (variant: VariantKey | 'all') => void;
  onPageChange: (page: number) => void;
}

export const CrossVariantResponsesTable: React.FC<CrossVariantResponsesTableProps> = ({
  responses,
  page,
  totalPages,
  total,
  highlightedResponseId,
  variantFilter = 'all',
  onVariantFilterChange,
  onPageChange,
}) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">All responses</h2>
        {onVariantFilterChange && (
          <select
            value={variantFilter}
            onChange={(e) => onVariantFilterChange(e.target.value as VariantKey | 'all')}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All variants</option>
            <option value="main">Main</option>
            <option value="A">Variant A</option>
            <option value="B">Variant B</option>
          </select>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500">{total} response(s) total</p>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase text-gray-500">
              <th className="px-3 py-2">Variant</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Answers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {responses.map((response) => {
              const isHighlighted = highlightedResponseId === response._id;
              return (
                <tr
                  key={response._id}
                  id={`response-${response._id}`}
                  className={isHighlighted ? 'bg-blue-50' : undefined}
                >
                  <td className="px-3 py-3 font-medium text-gray-800">{response.variantKey}</td>
                  <td className="px-3 py-3 text-gray-600">
                    {new Date(response.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {response.answers
                      .map((answer) => {
                        const value =
                          typeof answer.value === 'string'
                            ? answer.value
                            : JSON.stringify(answer.value);
                        return value.slice(0, 80);
                      })
                      .join(' · ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export const scrollToCitation = (citation: Citation) => {
  const element = document.getElementById(`response-${citation.responseId}`);
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
