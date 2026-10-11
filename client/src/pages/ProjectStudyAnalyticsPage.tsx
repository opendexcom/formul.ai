import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Alert, Button, LoadingSpinner } from '../components/ui';
import { AnalyticsSummaryCard } from '../components/analytics';
import { HypothesisVerdictCard } from '../components/comparative';
import { useProjectShell } from '../components/shell/ProjectShell';
import { shellCardClass } from '../components/shell/design-tokens';
import projectsService from '../services/projectsService';
import type { StudyAnalysis, StudyAnalysisReadiness } from '../types/study-analysis';

const confidenceStyles: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-800',
};

const scopeLabels: Record<string, string> = {
  core: 'Core',
  branch: 'Branch',
  study: 'Study',
};

const ProjectStudyAnalyticsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, refresh } = useProjectShell();
  const [analytics, setAnalytics] = useState<StudyAnalysis | null>(null);
  const [readiness, setReadiness] = useState<StudyAnalysisReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await projectsService.getStudyAnalysis(projectId);
      setAnalytics(data.analytics);
      setReadiness(data.readiness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load study analysis');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    if (!projectId) return;
    setGenerating(true);
    setError('');
    setProgressMessage('Starting study analysis...');
    setProgressPercent(0);

    try {
      const existingTaskId = sessionStorage.getItem(`study-analysis-task-${projectId}`);
      await projectsService.streamStudyAnalysis(
        projectId,
        (event) => {
          if (event.type === 'progress' || event.type === 'complete' || event.type === 'error') {
            if (typeof event.message === 'string') setProgressMessage(event.message);
            if (typeof event.progress === 'number') setProgressPercent(event.progress);
          }
          if (event.type === 'complete') {
            void loadData();
            void refresh();
            setGenerating(false);
          }
          if (event.type === 'error') {
            setError(typeof event.message === 'string' ? event.message : 'Generation failed');
            setGenerating(false);
          }
        },
        existingTaskId,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate study analysis');
      setGenerating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-12" text="Loading study analysis..." />;
  }

  const isSplit = project?.researchDesignType === 'split_questionnaire';
  const hasCompleteAnalysis = analytics?.status === 'complete';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-600">
            Study-level synthesis across all variants — executive summary, hypothesis evaluation,
            and rolled-up metrics.
          </p>
          {isSplit && (
            <p className="mt-2 text-sm text-amber-800">
              Split questionnaire: respondents saw one branch. Analysis combines shared core
              questions and branch-specific results.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {isSplit && (
              <span className="inline-flex rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-800 ring-1 ring-inset ring-purple-200">
                Split questionnaire
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void loadData()} disabled={generating}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={BarChart3}
            onClick={() => void handleGenerate()}
            disabled={generating || !readiness?.ready}
          >
            {hasCompleteAnalysis ? 'Regenerate study analysis' : 'Generate study analysis'}
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {generating && (
        <div className={shellCardClass}>
          <p className="text-sm font-medium text-gray-900">{progressMessage}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {readiness && !readiness.ready && (
        <div className={shellCardClass}>
          <h2 className="text-sm font-semibold text-gray-900">Prerequisites</h2>
          <p className="mt-2 text-sm text-gray-600">
            {readiness.message ??
              'Run variant analytics on each branch before generating study analysis.'}
          </p>
          <ul className="mt-4 space-y-2">
            {readiness.variants.map((variant) => (
              <li
                key={variant.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
              >
                <span>
                  Variant {variant.key} — {variant.responseCount} responses
                  {variant.hasAnalytics ? ' (analytics ready)' : ' (needs analytics)'}
                </span>
                {!variant.hasAnalytics && variant.responseCount > 0 && projectId && (
                  <Link
                    to={`/projects/${projectId}/variants/${variant.key}/analytics`}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    Run variant analytics →
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {projectId && (
            <Link
              to={`/projects/${projectId}/variants`}
              className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Go to Variants tab →
            </Link>
          )}
        </div>
      )}

      {hasCompleteAnalysis && analytics && (
        <>
          <AnalyticsSummaryCard
            summary={analytics.executiveSummary}
            totalResponses={analytics.rolledUpMetrics.totalResponses}
            lastUpdated={analytics.generatedAt ? new Date(analytics.generatedAt) : undefined}
          />

          <HypothesisVerdictCard evaluations={analytics.hypothesisEvaluation} />

          <div className={shellCardClass}>
            <h2 className="text-lg font-semibold text-gray-900">Rolled-up metrics</h2>
            <p className="mt-1 text-sm text-gray-500">
              {analytics.rolledUpMetrics.totalResponses.toLocaleString()} total responses across{' '}
              {analytics.rolledUpMetrics.variants.length} variant(s)
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analytics.rolledUpMetrics.variants.map((variant) => (
                <div key={variant.key} className="rounded-lg border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-900">Variant {variant.key}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {variant.responseCount} responses · P{variant.sentiment.positive.toFixed(0)}% /
                    N{variant.sentiment.neutral.toFixed(0)}% / Neg
                    {variant.sentiment.negative.toFixed(0)}%
                  </p>
                  {variant.topTopics.length > 0 && (
                    <p className="mt-2 text-xs text-gray-600">
                      Top topics: {variant.topTopics.slice(0, 4).join(', ')}
                    </p>
                  )}
                  {projectId && (
                    <Link
                      to={`/projects/${projectId}/variants/${variant.key}/analytics`}
                      className="mt-2 inline-block text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      View variant analytics →
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {analytics.rolledUpMetrics.dominantTopics.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900">Dominant study topics</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analytics.rolledUpMetrics.dominantTopics.slice(0, 12).map((topic) => (
                    <span
                      key={topic.topic}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                    >
                      {topic.topic} ({topic.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {analytics.rolledUpMetrics.coreQuestionMetrics &&
              analytics.rolledUpMetrics.coreQuestionMetrics.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-900">Core questions</h3>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    {analytics.rolledUpMetrics.coreQuestionMetrics.map((q) => (
                      <li key={q.questionId}>{q.title}</li>
                    ))}
                  </ul>
                </div>
              )}

            {analytics.rolledUpMetrics.branchSpecificMetrics &&
              analytics.rolledUpMetrics.branchSpecificMetrics.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-900">Branch-specific</h3>
                  <div className="mt-2 space-y-3">
                    {analytics.rolledUpMetrics.branchSpecificMetrics.map((branch) => (
                      <div key={branch.variantKey} className="rounded-lg bg-gray-50 p-3 text-sm">
                        <p className="font-medium text-gray-900">Variant {branch.variantKey}</p>
                        {branch.summary && (
                          <p className="mt-1 text-gray-600 line-clamp-3">{branch.summary}</p>
                        )}
                        {branch.topTopics.length > 0 && (
                          <p className="mt-1 text-xs text-gray-500">
                            Topics: {branch.topTopics.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {analytics.studyInsights.length > 0 && (
            <div className={shellCardClass}>
              <h2 className="text-lg font-semibold text-gray-900">Study insights</h2>
              <ul className="mt-4 space-y-3">
                {analytics.studyInsights.map((insight, index) => (
                  <li key={`${insight.text}-${index}`} className="rounded-lg border border-gray-100 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceStyles[insight.confidence] ?? confidenceStyles.medium}`}
                      >
                        {insight.confidence}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                        {scopeLabels[insight.scope] ?? insight.scope}
                        {insight.variantKey ? ` · ${insight.variantKey}` : ''}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">{insight.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {readiness?.ready && !hasCompleteAnalysis && !generating && (
        <div className={`${shellCardClass} text-center py-8`}>
          <p className="text-sm text-gray-600">
            Variant analytics are ready. Generate study analysis to see study-level insights.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProjectStudyAnalyticsPage;
