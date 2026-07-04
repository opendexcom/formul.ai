import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, FlaskConical, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QuotaLimitBanner } from '../components/common';
import {
  CreateStudyModal,
  OverviewMetrics,
  StudiesList,
  StudiesToolbar,
  useStudiesFiltering,
  type StudySortOption,
} from '../components/studies';
import { Alert, EmptyState, LoadingSpinner } from '../components/ui';
import { useBillingAvailable } from '../hooks/useBillingAvailable';
import { useUsageLimits } from '../hooks/useUsageLimits';
import projectsService, { type DashboardSummary } from '../services/projectsService';
import { shellPageDescriptionClass, shellPageTitleClass } from '../components/shell/design-tokens';
import { usePlanUsageSnapshot } from '../hooks/usePlanUsageSnapshot';

const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const hasBilling = useBillingAvailable();
  const { formsExceeded } = useUsageLimits();
  const { planName } = usePlanUsageSnapshot();
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
    if (window.location.hash === '#studies') {
      document.getElementById('studies-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading]);

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
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={shellPageTitleClass}>Overview</h1>
          <p className={shellPageDescriptionClass}>
            Track the progress of your research and uncover insights.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            disabled={formsExceeded}
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Study
            <ChevronDown className="h-4 w-4 opacity-80" />
          </button>
        </div>
      </div>

      {formsExceeded && (
        <QuotaLimitBanner message="You've reached your studies limit." className="mb-2" />
      )}
      {error && <Alert type="error" message={error} />}

      {summary && (
        <OverviewMetrics
          summary={summary}
          planName={planName}
          showPlanCard={hasBilling}
        />
      )}

      <section id="studies-section" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Your studies</h2>
          <p className="text-sm text-gray-500">
            Design variants, collect responses, and review analytics.
          </p>
        </div>

        <StudiesToolbar
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />

        {!summary || summary.studies.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No studies yet"
            description="Create your first study and start building variants with AI chat."
            actionLabel="Create first study"
            onAction={() => setCreateOpen(true)}
            actionDisabled={formsExceeded}
          />
        ) : (
          <StudiesList studies={filteredStudies} onRefresh={() => void loadSummary()} />
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
