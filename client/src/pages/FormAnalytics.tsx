import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Calendar,
  Download,
  BarChart3,
  PieChart,
  TrendingUp,
  RefreshCw,
  Filter
} from 'lucide-react';
import formsService, { FormData } from '../services/formsService';
import { Header } from '../components/common';
import { Button, LoadingSpinner, Alert } from '../components/ui';
import { computeOverallClimate } from '../utils/analysis';
import {
  AnalyticsSummaryCard,
  OverallClimateCard,

  FilterPanel,
  TopicsThemesCard,
  RefreshAnalyticsModal,
  TopicRelationshipsCard,
  TopicSentimentCard,
  RawResponsesTable
} from '../components/analytics';
import { KeyFindingsCard } from '../components/analytics/KeyFindingsCard';
import { RecommendationsCard } from '../components/analytics/RecommendationsCard';
import { ClosedQuestionTopicsCard } from '../components/analytics/ClosedQuestionTopicsCard';
import { AnalyticsData } from '../types/analytics';
import { AnalyticsFilters } from '../components/analytics/FilterPanel';
import type { RefreshOptions } from '../components/analytics/RefreshAnalyticsModal';
import { logger } from '../utils/logger';

interface ResponseData {
  _id: string;
  answers: { questionId: string; value: any }[];
  submittedAt: Date | string;
  respondentEmail?: string;
  ipAddress?: string;
  metadata?: {
    processedForAnalytics?: boolean;
    processingTaskId?: string; // Task ID if currently being processed
    hasTextContent?: boolean;
    lastAnalyzed?: Date | string;
    overallSentiment?: {
      label?: string;
      score?: number;
      emotionalTone?: string;
    };
  };
}

const FormAnalytics: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData | null>(null);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshingAnalytics, setRefreshingAnalytics] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [, setCurrentTaskId] = useState<string | null>(null);

  // Detailed progress stats
  const [progressStats, setProgressStats] = useState<{
    stage?: string;
    currentResponse?: number;
    totalToProcess?: number;
    processedResponses?: number;
    totalResponses?: number;
    substage?: string;
    uniqueTopics?: number;
  } | null>(null);

  // Filters state
  const [filters, setFilters] = useState<AnalyticsFilters>({});

  // Track if filters are active to differentiate empty states
  const hasActiveFilters = Object.keys(filters).length > 0;

  useEffect(() => {
    if (formId) {
      loadFormAnalytics(formId);

      // Check if there's an ongoing task from session storage
      const existingTaskId = sessionStorage.getItem(`analytics-task-${formId}`);
      if (existingTaskId) {
        logger.debug('[Frontend] Found existing taskId in session:', existingTaskId);
        setCurrentTaskId(existingTaskId);
        // We'll reconnect in handleRefreshAnalytics or we can check task status here
      }
    }
  }, [formId]);

  const loadResponses = async (id: string) => {
    try {
      const responsesData = await formsService.getFormResponses(id);
      setResponses(responsesData);
    } catch (error) {
      logger.error('Error loading responses:', error);
    }
  };

  const loadFormAnalytics = async (id: string, forceRefresh = false) => {
    try {
      setLoading(true);
      setError('');

      // Load form data
      const formData = await formsService.getForm(id);
      setForm(formData);

      // Load responses (basic for table display)
      await loadResponses(id);

      // Load analytics data - only try to fetch cached analytics on initial load
      try {
        const analyticsData = await formsService.getFormAnalytics(id, forceRefresh);
        // Only set analytics if we got actual data (cache hit)
        if (analyticsData) {
          setAnalytics(analyticsData);
        }
      } catch (analyticsError) {
        // Don't fail the whole page if analytics fail
        const errorMessage = analyticsError instanceof Error ? analyticsError.message : 'Analytics not available';
        logger.warn('Analytics not available:', errorMessage);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load form analytics';
      setError(errorMessage);
      logger.error('Error loading form analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAnalytics = async (options: RefreshOptions) => {
    if (!formId) return;

    logger.debug('[Frontend] Starting analytics refresh with options:', options);

    try {
      setRefreshingAnalytics(true);
      setError('');
      setProgressMessage('Connecting...');
      setProgressPercent(0);

      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in.');
        setRefreshingAnalytics(false);
        return;
      }

      // Clear any existing taskId if reprocessing - we want a fresh start
      if (options.reprocessResponses) {
        sessionStorage.removeItem(`analytics-task-${formId}`);
        logger.debug('[Frontend] Cleared existing taskId for fresh start with reprocessing');
      }

      logger.debug('[Frontend] Starting SSE connection to:', `/api/forms/${formId}/analytics/stream`);

      // Use fetch with streaming for SSE with proper Authorization header
      const controller = new AbortController();

      // Check if there's an existing taskId to reconnect to (unless we're reprocessing)
      const existingTaskId = options.reprocessResponses ? null : sessionStorage.getItem(`analytics-task-${formId}`);

      // Build URL with query parameters
      const params = new URLSearchParams();
      if (existingTaskId) {
        params.append('taskId', existingTaskId);
      }
      if (options.reprocessResponses) {
        params.append('reprocess', 'true');
        if (options.onlyFailed) {
          params.append('onlyFailed', 'true');
        }
      }

      const url = `/api/forms/${formId}/analytics/stream${params.toString() ? '?' + params.toString() : ''}`;

      logger.debug('[Frontend] SSE URL:', url, existingTaskId ? `(reconnecting to taskId: ${existingTaskId})` : '(new task)');

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
          },
          signal: controller.signal,
        });

        logger.debug('[Frontend] SSE response status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        logger.debug('[Frontend] Stream reader obtained, processing stream...');

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                logger.debug('[Frontend] Stream done');
                break;
              }

              const chunk = decoder.decode(value, { stream: true });
              logger.debug('[Frontend] Received chunk:', chunk);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.substring(6));
                    logger.debug('[Frontend] Parsed SSE data:', data);

                    // Store taskId for reconnection
                    if (data.taskId) {
                      setCurrentTaskId(data.taskId);
                      // Store in sessionStorage for page refresh
                      sessionStorage.setItem(`analytics-task-${formId}`, data.taskId);
                    }

                    if (data.type === 'connected') {
                      setProgressMessage(data.message);
                      // If reconnecting to existing task, restore progress
                      if (data.existing && data.progress) {
                        setProgressPercent(data.progress);
                        setProgressMessage(data.currentMessage || data.message);
                      }
                    } else if (data.type === 'reprocessed') {
                      // Responses have been marked for reprocessing
                      // Don't refetch - wait for responses_claimed event to update state
                      setProgressMessage(data.message);
                      setProgressPercent(data.progress || 2);
                      logger.debug('[Frontend] Reprocessing initiated, waiting for responses_claimed event...');
                    } else if (data.type === 'start') {
                      setProgressMessage(data.message);
                      setProgressPercent(data.progress || 0);
                      setProgressStats(data.stats || null);
                    } else if (data.type === 'progress') {
                      setProgressMessage(data.message);
                      setProgressPercent(data.progress || 0);
                      setProgressStats(data.stats || null);
                    } else if (data.type === 'responses_claimed') {
                      // Ensure responses are in "Not started" state (clear any stale processingTaskId)
                      if (data.processedResponseIds && Array.isArray(data.processedResponseIds)) {
                        setResponses(prevResponses =>
                          prevResponses.map(r =>
                            data.processedResponseIds.includes(r._id)
                              ? { ...r, metadata: { ...r.metadata, processingTaskId: undefined, processedForAnalytics: false } }
                              : r
                          )
                        );
                        logger.debug('[Frontend] Reset', data.processedResponseIds.length, 'responses to "Not started" (claimed)');
                      }
                      setProgressMessage(data.message);
                      setProgressPercent(data.progress || 0);
                    } else if (data.type === 'responses_processing') {
                      // Mark responses as "Pending" (currently being processed)
                      if (data.processedResponseIds && Array.isArray(data.processedResponseIds)) {
                        setResponses(prevResponses =>
                          prevResponses.map(r =>
                            data.processedResponseIds.includes(r._id)
                              ? { ...r, metadata: { ...r.metadata, processingTaskId: data.taskId } }
                              : r
                          )
                        );
                        logger.debug('[Frontend] Marked', data.processedResponseIds.length, 'responses as "Pending" (processing)');
                      }
                      setProgressMessage(data.message);
                      setProgressPercent(data.progress || 0);
                    } else if (data.type === 'responses_processed') {
                      // Update processed response IDs in real-time
                      if (data.processedResponseIds && Array.isArray(data.processedResponseIds)) {
                        setResponses(prevResponses =>
                          prevResponses.map(r =>
                            data.processedResponseIds.includes(r._id)
                              ? { ...r, metadata: { ...r.metadata, processedForAnalytics: true, processingTaskId: undefined } }
                              : r
                          )
                        );
                        logger.debug('[Frontend] Updated status for', data.processedResponseIds.length, 'processed responses');
                      }
                      setProgressMessage(data.message);
                      setProgressPercent(data.progress || 0);
                    } else if (data.type === 'stage') {
                      // Stage update (substage info like "1/4")
                      setProgressMessage(data.message);
                      setProgressStats(prev => ({
                        ...prev,
                        stage: data.stage,
                        substage: data.substage
                      }));
                    } else if (data.type === 'complete') {
                      logger.debug('[Frontend] Analytics complete, reloading...');
                      setProgressMessage('Complete!');
                      setProgressPercent(100);

                      // Clear taskId
                      setCurrentTaskId(null);
                      sessionStorage.removeItem(`analytics-task-${formId}`);

                      // Reload analytics and responses after completion
                      setTimeout(async () => {
                        const analyticsData = await formsService.getFormAnalytics(formId, false);
                        if (analyticsData) {
                          try {
                            const insights = analyticsData.insights;
                            logger.debug('[Frontend] Reloaded analytics meta:', analyticsData);
                            logger.debug('[Frontend] Insights summary length:', insights?.summary?.length || 0, 'keyFindings:', (insights?.keyFindings || []).length);
                          } catch { }
                          setAnalytics(analyticsData);
                        }
                        // Reload responses to update any remaining statuses
                        await loadResponses(formId);
                        setRefreshingAnalytics(false);
                        setProgressMessage('');
                        setProgressPercent(0);
                      }, 500);
                      break;
                    } else if (data.type === 'error') {
                      logger.error('[Frontend] Server error:', data.message);
                      setError(data.message || 'Analytics generation failed');
                      setRefreshingAnalytics(false);
                      setProgressMessage('');
                      setProgressPercent(0);
                      setCurrentTaskId(null);
                      sessionStorage.removeItem(`analytics-task-${formId}`);
                      break;
                    }
                  } catch (parseError) {
                    logger.error('[Frontend] Failed to parse SSE message:', parseError, 'Line:', line);
                  }
                }
              }
            }
          } catch (streamError) {
            if (streamError instanceof Error && streamError.name !== 'AbortError') {
              logger.error('[Frontend] Stream processing error:', streamError);
              setError('Connection error during analytics generation');
              setRefreshingAnalytics(false);
              setProgressMessage('');
              setProgressPercent(0);
            }
          } finally {
            reader.releaseLock();
          }
        };

        processStream();
      } catch (fetchError) {
        logger.error('SSE fetch error:', fetchError);
        setError('Connection error during analytics generation');
        setRefreshingAnalytics(false);
        setProgressMessage('');
        setProgressPercent(0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start analytics generation';
      setError('Failed to start analytics generation: ' + errorMessage);
      logger.error('Error starting analytics:', error);
      setRefreshingAnalytics(false);
      setProgressMessage('');
      setProgressPercent(0);
    }
  };

  const handleExportCSV = () => {
    if (!form || !responses.length) return;

    // Only include the Email column if any response actually has respondentEmail
    const includeEmail = responses.some(r => !!r.respondentEmail);

    const headers = ['Submitted At'];
    if (includeEmail) headers.push('Email');
    form.questions.forEach(q => headers.push(q.title));

    const csvData = [headers];

    responses.forEach(response => {
      const row: string[] = [
        new Date(response.submittedAt).toLocaleString(),
      ];

      if (includeEmail) {
        row.push(response.respondentEmail || '');
      }

      form.questions.forEach(question => {
        const answer = response.answers.find(a => a.questionId === question.id);
        const value = answer ? answer.value : '';
        row.push(Array.isArray(value) ? value.join(', ') : String(value));
      });

      csvData.push(row);
    });

    const csvContent = csvData.map(row =>
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title}_responses.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle topic click - toggle topic in filters
  const handleTopicClick = (topic: string) => {
    setFilters(currentFilters => {
      const currentTopics = currentFilters.topics || [];
      const isTopicSelected = currentTopics.includes(topic);

      if (isTopicSelected) {
        // Remove topic from filter
        const newTopics = currentTopics.filter(t => t !== topic);
        return {
          ...currentFilters,
          topics: newTopics.length > 0 ? newTopics : undefined
        };
      } else {
        // Add topic to filter
        return {
          ...currentFilters,
          topics: [...currentTopics, topic]
        };
      }
    });
  };

  // Apply filters - fetch filtered responses from backend
  const getFilteredResponses = () => {
    // If no filters are active, return all responses
    if (Object.keys(filters).length === 0) {
      return responses;
    }

    // Filtering will be handled server-side when we implement real-time filtering
    // For now, return all responses (backend will handle filtering when we refetch)
    return responses;
  };

  // Effect to fetch filtered responses when filters change
  useEffect(() => {
    if (formId && Object.keys(filters).length > 0) {
      // Fetch filtered responses from backend
      const fetchFilteredResponses = async () => {
        try {
          const filterParams: any = {};
          if (filters.sentiment) filterParams.sentiment = filters.sentiment;
          if (filters.topics && filters.topics.length > 0) {
            filterParams.topics = filters.topics.join(',');
          }
          if (filters.representativeness) filterParams.representativeness = filters.representativeness;
          if (filters.depth) filterParams.depth = filters.depth;

          const filteredData = await formsService.getFormResponses(formId, filterParams);
          setResponses(filteredData);
        } catch (error) {
          logger.error('Error fetching filtered responses:', error);
        }
      };

      fetchFilteredResponses();
    } else if (formId && Object.keys(filters).length === 0) {
      // No filters - reload all responses
      loadResponses(formId);
    }
  }, [filters, formId]);

  const filteredResponses = getFilteredResponses();

  // Extract available topics from analytics for filter panel
  const availableTopics = analytics?.topics?.topTopics || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading analytics..." />
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Alert type="error" message={error} className="mb-4" />
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              icon={ArrowLeft}
              onClick={() => navigate('/dashboard')}
            >
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
              <p className="text-gray-600">Form Analytics</p>
            </div>
          </div>

          <div className="flex space-x-3">
            {analytics && (
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={() => setShowRefreshModal(true)}
                disabled={refreshingAnalytics || responses.length < 10}
                loading={refreshingAnalytics}
              >
                Refresh Analytics
              </Button>
            )}
            <Button
              variant="secondary"
              icon={Download}
              onClick={handleExportCSV}
              disabled={!responses.length}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <Alert type="error" message={error} className="mb-6" />
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {responses.length}
                </div>
                <div className="text-sm text-gray-600">Total Responses</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center space-x-3">
              <Calendar className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {responses.length > 0
                    ? new Date(responses[responses.length - 1].submittedAt).toLocaleDateString()
                    : 'No responses'
                  }
                </div>
                <div className="text-sm text-gray-600">Last Response</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-8 h-8 text-purple-600" />
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {form.questions.length}
                </div>
                <div className="text-sm text-gray-600">Questions</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-8 h-8 text-orange-600" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {form.isActive ? 'Active' : 'Inactive'}
                </div>
                <div className="text-sm text-gray-600">Status</div>
              </div>
            </div>
          </div>
        </div>

        {!hasActiveFilters && responses.length === 0 ? (
          // Truly no responses - show empty state
          <div className="bg-white rounded-lg shadow-sm border p-10 text-center">
            <PieChart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No responses yet</h3>
            <p className="text-gray-600 mb-4">Share your form to start collecting responses and see analytics here.</p>
            <Button variant="primary" onClick={() => navigate(`/forms/${formId}/edit`)}>
              Share Form
            </Button>
          </div>
        ) : hasActiveFilters && filteredResponses.length === 0 ? (
          // Filters active but no matching responses - show FilterPanel + empty message
          <>
            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              availableTopics={availableTopics}
            />
            <div className="bg-white rounded-lg shadow-sm border p-10 text-center">
              <Filter className="w-16 h-16 text-amber-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matching responses</h3>
              <p className="text-gray-600 mb-4">
                No responses match your current filters. Try adjusting the filters above or clearing them to see results.
              </p>
              <Button
                variant="secondary"
                onClick={() => setFilters({})}
              >
                Clear All Filters
              </Button>
            </div>
          </>
        ) : !analytics ? (
          // No analytics generated yet - show generate button
          <div className="bg-white rounded-lg shadow-sm border p-10 text-center">
            <BarChart3 className="w-16 h-16 text-blue-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Not Generated</h3>
            <p className="text-gray-600 mb-4">
              You have {responses.length} responses. Generate AI-powered analytics to see insights, correlations, themes, and recommendations.
            </p>
            {responses.length < 10 ? (
              <p className="text-sm text-amber-600 mb-4">
                Note: At least 10 responses are recommended for meaningful analytics.
              </p>
            ) : null}

            {refreshingAnalytics ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="font-medium">{progressMessage || 'Generating analytics...'}</span>
                </div>
                {progressPercent > 0 && (
                  <div className="max-w-md mx-auto">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{progressPercent}%</p>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="primary"
                icon={RefreshCw}
                onClick={() => setShowRefreshModal(true)}
                disabled={responses.length < 10}
              >
                Generate Analytics
              </Button>
            )}
          </div>
        ) : (
          <>
            {refreshingAnalytics ? (
              /* Show regeneration card while generating */
              <div className="bg-white rounded-lg shadow-sm border p-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <h3 className="text-xl font-medium text-gray-900">Generating Analytics</h3>
                  </div>

                  <p className="text-gray-600 text-center">{progressMessage || 'Processing responses...'}</p>

                  {/* Progress bar */}
                  {progressPercent > 0 && (
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <p className="text-sm font-medium text-gray-700 text-center">{progressPercent}%</p>
                    </div>
                  )}

                  {/* Detailed stats */}
                  {progressStats && (
                    <div className="max-w-lg mx-auto mt-6 p-4 bg-gray-50 rounded-lg border">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Progress Details</h4>
                      <div className="space-y-2 text-sm">
                        {progressStats.stage && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Current Stage:</span>
                            <span className="font-medium text-gray-900">
                              {progressStats.stage}
                              {progressStats.substage && ` (${progressStats.substage})`}
                            </span>
                          </div>
                        )}

                        {progressStats.currentResponse !== undefined && progressStats.totalToProcess !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Processing Response:</span>
                            <span className="font-medium text-gray-900">
                              {progressStats.currentResponse} / {progressStats.totalToProcess}
                            </span>
                          </div>
                        )}

                        {progressStats.processedResponses !== undefined && progressStats.totalResponses !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Responses Analyzed:</span>
                            <span className="font-medium text-gray-900">
                              {progressStats.processedResponses} / {progressStats.totalResponses}
                            </span>
                          </div>
                        )}

                        {progressStats.uniqueTopics !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Topics Discovered:</span>
                            <span className="font-medium text-blue-600">
                              {progressStats.uniqueTopics}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-gray-500 mt-4 text-center">
                    This may take a few minutes. You can refresh this page to check progress.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Analytics Summary Card */}
                {analytics?.insights?.summary && (
                  <AnalyticsSummaryCard
                    summary={analytics.insights.summary}
                    totalResponses={analytics.totalResponsesAnalyzed || responses.length}
                    lastUpdated={analytics.lastUpdated}
                  />
                )}

                {/* Key Findings and Recommendations - right after summary */}
                <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <KeyFindingsCard analytics={analytics || undefined} />
                  <RecommendationsCard analytics={analytics || undefined} />
                </div>

                {/* Filter Panel */}
                <FilterPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableTopics={availableTopics}
                />

                {/* Analytics grid */}
                <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {(() => {
                    const climate = computeOverallClimate(form, filteredResponses);
                    return (
                      <>
                        <OverallClimateCard
                          positivityScore={analytics?.climate?.positivityScore ?? climate.positivityScore}
                          sentimentBreakdown={analytics?.climate?.sentimentBreakdown ?? climate.sentimentBreakdown}
                          dominantTendency={analytics?.climate?.dominantTendency ?? climate.dominantTendency}
                          semanticAxis={analytics?.climate?.semanticAxis ?? climate.semanticAxis}
                        />
                        <TopicsThemesCard
                          analytics={analytics || undefined}
                          onTopicClick={handleTopicClick}
                          selectedTopics={filters.topics || []}
                        />
                        <TopicSentimentCard
                          analytics={analytics || undefined}
                          selectedTopics={filters.topics || []}
                        />
                        <TopicRelationshipsCard
                          analytics={analytics || undefined}
                          selectedTopics={filters.topics || []}
                        />
                        <div className="lg:col-span-2">
                          <ClosedQuestionTopicsCard
                            analytics={analytics || undefined}
                            selectedTopics={filters.topics || []}
                            hasActiveFilters={hasActiveFilters}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </>
        )}

        {/* Raw Responses Table */}
        <RawResponsesTable
          form={form}
          responses={responses}
          showAnalyticsStatus={!!analytics}
        />
      </div>

      {/* Refresh Analytics Modal */}
      <RefreshAnalyticsModal
        isOpen={showRefreshModal}
        onClose={() => setShowRefreshModal(false)}
        onConfirm={handleRefreshAnalytics}
        totalResponses={responses.length}
        analyzedResponses={responses.filter(r => r.metadata?.processedForAnalytics).length}
        pendingResponses={responses.filter(r => !r.metadata?.processedForAnalytics && r.metadata?.hasTextContent).length}
      />
    </div>
  );
};

export default FormAnalytics;