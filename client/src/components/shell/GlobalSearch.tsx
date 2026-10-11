import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  HelpCircle,
  Link2,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import { useGlobalSearch } from './GlobalSearchContext';
import projectsService, { type ProjectData } from '../../services/projectsService';

type SearchItem = {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
};

const GlobalSearch: React.FC = () => {
  const { open, closeSearch } = useGlobalSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void projectsService
      .getProjects()
      .then((data) => {
        if (!cancelled) setProjects(data);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const staticItems: SearchItem[] = useMemo(
    () => [
      {
        id: 'new-study',
        label: 'Create new study',
        icon: Plus,
        action: () => {
          closeSearch();
          navigate('/overview#studies');
          window.dispatchEvent(new CustomEvent('formulai:open-create-study'));
        },
      },
      {
        id: 'integrations',
        label: 'Integrations',
        icon: Link2,
        action: () => {
          closeSearch();
          navigate('/integrations');
        },
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        action: () => {
          closeSearch();
          navigate('/settings/preferences');
        },
      },
      {
        id: 'help',
        label: 'Help & Support',
        icon: HelpCircle,
        action: () => {
          closeSearch();
          navigate('/help');
        },
      },
    ],
    [closeSearch, navigate],
  );

  const studyItems: SearchItem[] = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return projects
      .filter((project) => {
        if (!normalized) return true;
        return (
          project.name.toLowerCase().includes(normalized) ||
          (project.hypothesis ?? '').toLowerCase().includes(normalized)
        );
      })
      .slice(0, 8)
      .map((project) => ({
        id: project._id,
        label: project.name,
        description: project.hypothesis,
        icon: FileText,
        action: () => {
          closeSearch();
          navigate(`/projects/${project._id}/variants`);
        },
      }));
  }, [projects, query, closeSearch, navigate]);

  if (!open) return null;

  const renderGroup = (title: string, items: SearchItem[]) =>
    items.length > 0 ? (
      <div className="py-2">
        <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {title}
        </p>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.action}
            className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
          >
            <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span>
              <span className="block text-sm font-medium text-gray-900">{item.label}</span>
              {item.description && (
                <span className="block truncate text-xs text-gray-500">{item.description}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onClick={closeSearch}
      role="presentation"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search studies, pages, actions…"
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Loading studies…</p>
          )}
          {!loading && renderGroup('Actions', staticItems)}
          {!loading && renderGroup('Studies', studyItems)}
          {!loading && studyItems.length === 0 && query.trim() && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">No studies found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
