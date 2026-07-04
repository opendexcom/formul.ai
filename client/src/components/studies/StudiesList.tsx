import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Copy, MoreHorizontal } from 'lucide-react';
import {
  aiStatusBadgeClass,
  aiStatusLabels,
  shellCardClass,
  studyStatusBadgeClass,
  studyStatusLabels,
  studyTypeBadgeClass,
} from '../shell/design-tokens';
import type { DashboardStudySummary } from '../../services/projectsService';
import projectsService from '../../services/projectsService';

interface StudiesListProps {
  studies: DashboardStudySummary[];
  onRefresh: () => void;
}

function formatRelativeTime(value?: string): string {
  if (!value) return 'Recently updated';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Updated just now';
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Updated yesterday';
  return `Updated ${diffDays}d ago`;
}

const StudiesList: React.FC<StudiesListProps> = ({ studies, onRefresh }) => {
  const navigate = useNavigate();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleArchive = async (studyId: string) => {
    setMenuOpenId(null);
    await projectsService.archiveProject(studyId);
    onRefresh();
  };

  if (studies.length === 0) {
    return (
      <div className={`${shellCardClass} py-12 text-center`}>
        <p className="text-sm font-medium text-gray-900">No studies match your filters</p>
        <p className="mt-1 text-sm text-gray-500">Try adjusting search or filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {studies.map((study) => (
        <div
          key={study._id}
          className={`${shellCardClass} grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center`}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                  studyTypeBadgeClass[study.type]
                }`}
              >
                {study.type === 'ab_test' ? 'A/B test' : 'Single study'}
              </span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-gray-900">{study.name}</h3>
            {study.hypothesis && (
              <p className="mt-1 line-clamp-2 text-sm text-gray-600">{study.hypothesis}</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-900">
              {study.responseCount.toLocaleString()} responses
            </p>
            <p className="text-xs text-gray-500">
              {study.responsesThisWeek > 0
                ? `+${study.responsesThisWeek} this week`
                : 'No new responses this week'}
            </p>
          </div>

          <div>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                aiStatusBadgeClass[study.aiStatus]
              }`}
            >
              {aiStatusLabels[study.aiStatus]}
            </span>
            {study.aiStatus === 'needs_data' && (
              <p className="mt-1 text-xs text-gray-500">Collect more responses</p>
            )}
          </div>

          <div>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                studyStatusBadgeClass[study.status]
              }`}
            >
              {studyStatusLabels[study.status] ?? study.status}
            </span>
            <p className="mt-1 text-xs text-gray-500">{formatRelativeTime(study.updatedAt)}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/projects/${study._id}/variants`)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Open study
            </button>
            <div className="relative" ref={menuOpenId === study._id ? menuRef : undefined}>
              <button
                type="button"
                onClick={() =>
                  setMenuOpenId((current) => (current === study._id ? null : study._id))
                }
                className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpenId === study._id && (
                <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${study._id}/variants`)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Open study
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-400"
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate (soon)
                  </button>
                  {study.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => void handleArchive(study._id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Archive className="h-4 w-4" />
                      Archive
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StudiesList;
