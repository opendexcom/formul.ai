import React, { useMemo, useState } from 'react';
import { Filter, Search } from 'lucide-react';

export type StudySortOption = 'newest' | 'oldest' | 'name' | 'responses';

interface StudiesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: StudySortOption;
  onSortChange: (value: StudySortOption) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
}

const StudiesToolbar: React.FC<StudiesToolbarProps> = ({
  search,
  onSearchChange,
  sort,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search studies..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as StudySortOption)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-500"
        >
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
          <option value="name">Sort: Name A–Z</option>
          <option value="responses">Sort: Most responses</option>
        </select>
      </div>
      {filtersOpen && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
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
