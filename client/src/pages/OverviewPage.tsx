import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CreateStudyModal,
  OverviewMetrics,
  StudiesList,
  StudiesToolbar,
  useStudiesFiltering,
  type StudySortOption,
} from '../components/studies';
import { Alert, Button, LoadingSpinner } from '../components/ui';
import { useUsageLimits } from '../hooks/useUsageLimits';
import projectsService, { type DashboardSummary } from '../services/projectsService';
import { shellPageDescriptionClass, shellPageTitleClass } from '../components/shell/design-tokens';

const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { formsExceeded } = useUsageLimits();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<StudySortOption>('newest');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setSummary(await projectsService.getDashboardSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const openCreate = () => setCreateOpen(true);
    window.addEventListener('formulai:open-create-study', openCreate);
    return () => window.removeEventListener('formulai:open-create-study', openCreate);
  }, []);

  useEffect(() => {
    if (location.hash === '#studies') {
      document.getElementById('studies-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, location.hash]);

  const filteredStudies = useStudiesFiltering(
    summary?.studies ?? [],
    search,
    sort,
    statusFilter,
    typeFilter,
  );

  const handleCreate = async (payload: { name: string; hypothesis?: string }) => {
    const created = await projectsService.createProject(payload);
    await loadSummary();
    navigate(`/projects/${created._id}/variants`);
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-12" text="Loading overview..." />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className={shellPageTitleClass}>Overview</h1>
          <p className={shellPageDescriptionClass}>
            Track the progress of your research and uncover insights.
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col items-end gap-1">
          <Button
            type="button"
            variant={formsExceeded ? 'secondary' : 'primary'}
            disabled={formsExceeded}
            onClick={() => setCreateOpen(true)}
          >
            + New Study
          </Button>
          {formsExceeded && (
            <Link
              to="/settings/billing"
              className="text-right text-[13px] font-medium leading-[18px] text-red-800 hover:underline"
            >
              Study limit reached. Upgrade to create more.
            </Link>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {summary && <OverviewMetrics summary={summary} />}

      <section id="studies-section" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold leading-7 text-gray-900">Your studies</h2>
            <p className="mt-1 text-[13px] leading-[18px] text-gray-500">
              Design variants, collect responses, and review analytics.
            </p>
          </div>
          <StudiesToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
          />
        </div>

        {summary && (
          <StudiesList
            studies={filteredStudies}
            hasAnyStudies={summary.studies.length > 0}
            onRefresh={() => void loadSummary()}
            sort={sort}
            onSortChange={setSort}
            onCreate={() => setCreateOpen(true)}
            createDisabled={formsExceeded}
          />
        )}
      </section>

      <CreateStudyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        disabled={formsExceeded}
      />
    </div>
  );
};

export default OverviewPage;
