import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { Alert, Button, LoadingSpinner } from '../components/ui';
import projectsService, { ProjectData } from '../services/projectsService';
import {
  ComparativeReport,
  ComparativeReportReadiness,
  Citation,
  VariantKey,
} from '../types/comparative-report';
import {
  CrossVariantCorrelationsCard,
  CrossVariantGate,
  CrossVariantInsightsCard,
  CrossVariantResponsesTable,
  HypothesisVerdictCard,
  QuestionDiffCard,
  ClosedQuestionComparisonCard,
  ResearchSetupPanel,
  VariantInsightsCard,
  scrollToCitation,
} from '../components/comparative';
import { AnalyticsSummaryCard } from '../components/analytics';

const ProjectComparePageContent: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [report, setReport] = useState<ComparativeReport | null>(null);
  const [readiness, setReadiness] = useState<ComparativeReportReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState('');
  const [activeVariant, setActiveVariant] = useState<VariantKey>('main');
  const [highlightedResponseId, setHighlightedResponseId] = useState<string>();
  const [responsesPage, setResponsesPage] = useState(1);
  const [variantFilter, setVariantFilter] = useState<VariantKey | 'all'>('all');
  const [responsesData, setResponsesData] = useState({
    items: [] as Array<{
      _id: string;
      formId: string;
      variantKey: string;
      answers: Array<{ questionId: string; value: unknown }>;
      submittedAt: string;
    }>,
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
  });

  const loadPageData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const [projectData, reportData] = await Promise.all([
        projectsService.getProject(projectId),
        projectsService.getComparativeReport(projectId),
      ]);
      setProject(projectData);
      setReport(reportData.comparativeReport);
      setReadiness(reportData.readiness);
      if (projectData.variants.length > 0) {
        setActiveVariant(projectData.variants[0].key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparative report');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadResponses = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await projectsService.getProjectResponses(projectId, {
        page: responsesPage,
        limit: 25,
        variant: variantFilter === 'all' ? undefined : variantFilter,
      });
      setResponsesData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load responses');
    }
  }, [projectId, responsesPage, variantFilter]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  const handleCitationClick = (citation: Citation) => {
    setHighlightedResponseId(citation.responseId);
    if (variantFilter !== 'all' && variantFilter !== citation.variantKey) {
      setVariantFilter('all');
    }
    scrollToCitation(citation);
  };

  const handleGenerateReport = async () => {
    if (!projectId) return;
    setGenerating(true);
    setError('');
    setProgressMessage('Starting comparative report generation...');
    setProgressPercent(0);

    try {
      const existingTaskId = sessionStorage.getItem(`comparative-report-task-${projectId}`);
      const abort = await projectsService.streamComparativeReport(
        projectId,
        (event) => {
          if (event.type === 'progress' || event.type === 'complete' || event.type === 'error') {
            if (typeof event.message === 'string') setProgressMessage(event.message);
            if (typeof event.progress === 'number') setProgressPercent(event.progress);
          }
          if (event.type === 'complete') {
            void loadPageData();
            setGenerating(false);
          }
          if (event.type === 'error') {
            setError(typeof event.message === 'string' ? event.message : 'Generation failed');
            setGenerating(false);
          }
        },
        existingTaskId,
      );

      return () => abort();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
      setGenerating(false);
    }
  };

  const activeVariantSection = useMemo(
    () => report?.variantSections.find((section) => section.key === activeVariant),
    [report, activeVariant],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-600">
            Cross-variant report synthesizing per-variant analytics, hypotheses, and responses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => void loadPageData()}
            disabled={generating}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => void handleGenerateReport()} disabled={generating || !readiness?.ready}>
            <BarChart3 className="mr-2 h-4 w-4" />
            {report?.status === 'complete' ? 'Regenerate report' : 'Generate report'}
          </Button>
        </div>
      </div>

      {error && <Alert type="error" className="mb-4" message={error} />}

      {project && (
        <ResearchSetupPanel project={project} onProjectUpdated={setProject} />
      )}

      {readiness?.requiresMultipleVariants && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Add another variant</h2>
          <p className="mt-2 text-sm text-amber-800">
            Comparative analysis requires at least two variants. Add a variant from the project page.
          </p>
          <Link
            to={`/projects/${projectId}/variants`}
            className="mt-4 inline-block text-sm font-medium text-amber-900 underline"
          >
            Go to project variants
          </Link>
        </div>
      )}

      {!readiness?.requiresMultipleVariants && readiness && !readiness.ready && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold text-blue-900">Per-variant analytics required</h2>
          <p className="mt-2 text-sm text-blue-800">
            Run analytics on each variant before generating the comparative report.
          </p>
          <ul className="mt-4 space-y-2">
            {readiness.variants.map((variant) => (
              <li key={variant.key} className="flex items-center justify-between text-sm">
                <span>
                  Variant {variant.key} — {variant.responseCount} responses
                  {variant.hasAnalytics ? ' (analytics ready)' : ' (analytics missing)'}
                </span>
                {!variant.hasAnalytics && (
                  <Link
                    to={`/projects/${projectId}/variants/${variant.key}/analytics`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    Analyze
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {generating && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-900">{progressMessage}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {report?.status === 'complete' && (
        <div className="space-y-6">
          <AnalyticsSummaryCard
            summary={report.executiveSummary}
            totalResponses={report.variantContext.reduce((sum, v) => sum + v.responseCount, 0)}
            lastUpdated={report.generatedAt ? new Date(report.generatedAt) : undefined}
          />
          <QuestionDiffCard
            questionDiff={report.questionDiff}
            splitQuestionnaireDesign={report.splitQuestionnaireDesign}
          />
          {report.closedQuestionComparison && report.closedQuestionComparison.length > 0 && (
            <ClosedQuestionComparisonCard comparisons={report.closedQuestionComparison} />
          )}
          <HypothesisVerdictCard
            evaluations={report.hypothesisEvaluation}
            onCitationClick={handleCitationClick}
          />
          <CrossVariantInsightsCard
            insights={report.crossVariantInsights}
            onCitationClick={handleCitationClick}
          />

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {report.variantSections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveVariant(section.key)}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    activeVariant === section.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Variant {section.key}
                </button>
              ))}
            </div>
          </div>

          {activeVariantSection && (
            <VariantInsightsCard
              variantKey={activeVariantSection.key}
              summary={activeVariantSection.summary}
              insights={activeVariantSection.insights}
              onCitationClick={handleCitationClick}
            />
          )}

          <CrossVariantCorrelationsCard
            correlations={report.correlations}
            onCitationClick={handleCitationClick}
          />
        </div>
      )}

      {!report && readiness?.ready && !generating && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-600">No comparative report yet. Click Generate report to start.</p>
        </div>
      )}

      <div className="mt-8">
        <CrossVariantResponsesTable
          responses={responsesData.items}
          page={responsesData.page}
          totalPages={responsesData.totalPages}
          total={responsesData.total}
          highlightedResponseId={highlightedResponseId}
          variantFilter={variantFilter}
          onVariantFilterChange={(variant) => {
            setVariantFilter(variant);
            setResponsesPage(1);
          }}
          onPageChange={setResponsesPage}
        />
      </div>
    </div>
  );
};

const ProjectComparePage: React.FC = () => (
  <CrossVariantGate>
    <ProjectComparePageContent />
  </CrossVariantGate>
);

export default ProjectComparePage;
