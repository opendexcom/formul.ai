import React, { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';

export type StudySortOption = 'newest' | 'oldest' | 'name' | 'responses';

interface StudiesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
}

const StudiesToolbar: React.FC<StudiesToolbarProps> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Filter studies..."
          aria-label="Filter studies"
          className="h-9 w-60 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => setFiltersOpen((value) => !value)}
          aria-expanded={filtersOpen}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-500 hover:bg-gray-50"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>
      {filtersOpen && (
        <div className="flex flex-wrap justify-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            aria-label="Filter by status"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="designing">Designing</option>
            <option value="published">Published</option>
            <option value="collecting">Collecting</option>
            <option value="analyzing">Analyzing</option>
            <option value="analyzed">Analyzed</option>
            <option value="reported">Reported</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={typeFilter}
            onChange={(event) => onTypeFilterChange(event.target.value)}
            aria-label="Filter by type"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="single">Single study</option>
            <option value="ab_test">A/B test</option>
          </select>
        </div>
      )}
    </div>
  );
};

export function useStudiesFiltering<T extends { name: string; hypothesis?: string; status: string; type: string; responseCount?: number; updatedAt?: string; createdAt?: string }>(
  studies: T[],
  search: string,
  sort: StudySortOption,
  statusFilter: string,
  typeFilter: string,
): T[] {
  return useMemo(() => {
    let result = [...studies];
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch) {
      result = result.filter(
        (study) =>
          study.name.toLowerCase().includes(normalizedSearch) ||
          (study.hypothesis ?? '').toLowerCase().includes(normalizedSearch),
      );
    }
    if (statusFilter) {
      result = result.filter((study) => study.status === statusFilter);
    }
    if (typeFilter) {
      result = result.filter((study) => study.type === typeFilter);
    }
    result.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'responses') return (b.responseCount ?? 0) - (a.responseCount ?? 0);
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return sort === 'oldest' ? aTime - bTime : bTime - aTime;
    });
    return result;
  }, [studies, search, sort, statusFilter, typeFilter]);
}

export default StudiesToolbar;
