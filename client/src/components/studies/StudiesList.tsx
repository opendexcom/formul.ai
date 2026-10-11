import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Archive, Copy, FlaskConical, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  aiStatusLabels,
  shellStageTextClass,
  shellStudyTypeClass,
  shellTableCardClass,
  shellTableHeaderClass,
  studyStatusLabels,
} from '../shell/design-tokens';
import { EmptyState } from '../ui';
import type { DashboardStudySummary } from '../../services/projectsService';
import projectsService from '../../services/projectsService';
import type { StudySortOption } from './StudiesToolbar';

interface StudiesListProps {
  studies: DashboardStudySummary[];
  hasAnyStudies: boolean;
  onRefresh: () => void;
  sort: StudySortOption;
  onSortChange: (value: StudySortOption) => void;
  onCreate: () => void;
  createDisabled: boolean;
}

const rowGridClass =
  'grid min-w-[720px] grid-cols-[minmax(0,1fr)_150px_120px_120px_150px] items-center px-4';

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

const StudiesList: React.FC<StudiesListProps> = ({
  studies,
  hasAnyStudies,
  onRefresh,
  sort,
  onSortChange,
  onCreate,
  createDisabled,
}) => {
  const navigate = useNavigate();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const [actionError, setActionError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (menuRef.current?.contains(target)) return;
      if (target.closest('[data-study-menu-button]')) return;
      setMenuOpenId(null);
      setMenuPosition(null);
      setConfirmDeleteId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeMenu = () => {
    setMenuOpenId(null);
    setMenuPosition(null);
    setConfirmDeleteId(null);
  };

  const openMenu = (studyId: string, button: HTMLButtonElement) => {
    if (menuOpenId === studyId) {
      closeMenu();
      return;
    }
    const rect = button.getBoundingClientRect();
    const openUp = window.innerHeight - rect.bottom < 160;
    setMenuPosition({
      right: Math.max(8, window.innerWidth - rect.right),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
    });
    setMenuOpenId(studyId);
  };

  const handleDelete = async (studyId: string) => {
    closeMenu();
    try {
      setActionError('');
      await projectsService.deleteProject(studyId);
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete study');
    }
  };
  const handleArchive = async (studyId: string) => {
    closeMenu();
    try {
      setActionError('');
      await projectsService.archiveProject(studyId);
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to archive study');
    }
  };

  const openStudy = (studyId: string) => {
    navigate(`/projects/${studyId}/variants`);
  };

  const headerButtonClass = (active: boolean) =>
    `${shellTableHeaderClass} text-left hover:text-gray-700 ${active ? 'text-gray-900' : ''}`;

  return (
    <div className={`${shellTableCardClass} overflow-x-auto`}>
      {actionError && (
        <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {actionError}
        </p>
      )}
      {hasAnyStudies && (
        <div className={`${rowGridClass} h-12 bg-gray-50`}>
          <button
            type="button"
            className={headerButtonClass(sort === 'name')}
            onClick={() => onSortChange('name')}
          >
            Name
          </button>
          <button
            type="button"
            className={headerButtonClass(sort === 'responses')}
            onClick={() => onSortChange('responses')}
          >
            Responses
          </button>
          <span className={shellTableHeaderClass}>Status</span>
          <span className={shellTableHeaderClass}>Stage</span>
          <button
            type="button"
            className={headerButtonClass(sort === 'newest' || sort === 'oldest')}
            onClick={() => onSortChange(sort === 'newest' ? 'oldest' : 'newest')}
          >
            Last Updated
          </button>
        </div>
      )}

      {!hasAnyStudies ? (
        <EmptyState
          embedded
          icon={FlaskConical}
          title="No studies yet"
          description="Create your first study and start building variants with AI chat."
          actionLabel="Create first study"
          onAction={onCreate}
          actionDisabled={createDisabled}
        />
      ) : studies.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm font-medium text-gray-900">No studies match your filters</p>
          <p className="mt-1 text-sm text-gray-500">Try adjusting search or filters.</p>
        </div>
      ) : (
        studies.map((study) => (
          <div
            key={study._id}
            role="link"
            tabIndex={0}
            onClick={() => openStudy(study._id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') openStudy(study._id);
            }}
            className={`${rowGridClass} group cursor-pointer border-b border-gray-200 bg-white py-4 last:border-b-0 hover:bg-gray-50`}
          >
            <div className="min-w-0 pr-4">
              <p className="truncate text-sm font-medium text-gray-900">{study.name}</p>
              <p className={shellStudyTypeClass}>
                {study.type === 'ab_test' ? 'A/B test' : 'Single study'}
              </p>
            </div>
            <p className="text-[13px] text-gray-500">
              {study.responseCount.toLocaleString()} responses
            </p>
            <p className="text-[13px] text-gray-500">{aiStatusLabels[study.aiStatus]}</p>
            <p className={shellStageTextClass}>
              {studyStatusLabels[study.status] ?? study.status}
            </p>
            <div className="relative flex items-center justify-between gap-2">
              <p className="truncate text-xs text-gray-400">{formatRelativeTime(study.updatedAt)}</p>
              <button
                type="button"
                data-study-menu-button
                onClick={(event) => {
                  event.stopPropagation();
                  openMenu(study._id, event.currentTarget);
                }}
                className="shrink-0 rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50"
                aria-label="More actions"
                aria-expanded={menuOpenId === study._id}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))
      )}
      {menuOpenId &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            style={{
              top: menuPosition.top,
              bottom: menuPosition.bottom,
              right: menuPosition.right,
            }}
          >
            <button
              type="button"
              onClick={() => {
                closeMenu();
                openStudy(menuOpenId);
              }}
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
            {confirmDeleteId === menuOpenId ? (
              <>
                <p className="px-3 py-2 text-xs text-gray-500">
                  Delete this study? This cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() => void handleDelete(menuOpenId)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {studies.find((study) => study._id === menuOpenId)?.status !== 'archived' && (
                  <button
                    type="button"
                    onClick={() => void handleArchive(menuOpenId)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Archive className="h-4 w-4" />
                    Archive
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(menuOpenId)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default StudiesList;
