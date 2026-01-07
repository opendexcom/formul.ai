import React from 'react';
import { AnalyticsData } from '../../types/analytics';
import { FormData } from '../../services/formsService';
import { 
  TrendingUp, 
  Users, 
  MessageCircle, 
  BarChart3, 
  Lightbulb,
  Target,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Network,
  Cloud,
  Filter
} from 'lucide-react';

interface PrintableAnalyticsReportProps {
  form: FormData;
  analytics: AnalyticsData;
}

export const PrintableAnalyticsReport: React.FC<PrintableAnalyticsReportProps> = ({ form, analytics }) => {
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    // Split by lines for better processing
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let currentList: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    
    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          listType === 'ol' ? (
            <ol key={elements.length} className="list-decimal list-inside space-y-1 mb-3">
              {currentList.map((item, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }} />
              ))}
            </ol>
          ) : (
            <ul key={elements.length} className="list-disc list-inside space-y-1 mb-3">
              {currentList.map((item, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }} />
              ))}
            </ul>
          )
        );
        currentList = [];
        listType = null;
      }
    };
    
    const formatInlineMarkdown = (line: string): string => {
      return line
        // Bold: **text** or __text__
        .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
        .replace(/__(.+?)__/g, '<strong class="font-bold">$1</strong>')
        // Italic: *text* or _text_
        .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
        .replace(/_(.+?)_/g, '<em class="italic">$1</em>')
        // Code: `text`
        .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');
    };
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Check for unordered list (-, *, +)
      if (/^[-*+]\s/.test(trimmedLine)) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        currentList.push(trimmedLine.replace(/^[-*+]\s/, ''));
      }
      // Check for ordered list (1., 2., etc)
      else if (/^\d+\.\s/.test(trimmedLine)) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        currentList.push(trimmedLine.replace(/^\d+\.\s/, ''));
      }
      // Regular paragraph
      else {
        flushList();
        if (trimmedLine) {
          elements.push(
            <p key={index} className="mb-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmedLine) }} />
          );
        }
      }
    });
    
    flushList(); // Flush any remaining list
    
    return <div>{elements}</div>;
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
      case 'mostly positive':
        return 'text-green-700 bg-green-50';
      case 'negative':
      case 'mostly negative':
        return 'text-red-700 bg-red-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
      case 'mostly positive':
        return <ThumbsUp className="w-4 h-4" />;
      case 'negative':
      case 'mostly negative':
        return <ThumbsDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-blue-100 text-blue-800 border-blue-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[confidence as keyof typeof colors] || colors.medium;
  };

  const getCorrelationStrength = (frequency: number, maxFrequency: number) => {
    const ratio = frequency / maxFrequency;
    if (ratio >= 0.7) return 'strong';
    if (ratio >= 0.4) return 'medium';
    return 'weak';
  };

  const getCorrelationColors = (strength: string) => {
    switch (strength) {
      case 'strong':
        return {
          gradient: 'from-emerald-50 to-green-50',
          border: 'border-emerald-300',
          badge: 'bg-emerald-600 text-white',
          tag: 'bg-emerald-100 text-emerald-800'
        };
      case 'medium':
        return {
          gradient: 'from-amber-50 to-yellow-50',
          border: 'border-amber-300',
          badge: 'bg-amber-600 text-white',
          tag: 'bg-amber-100 text-amber-800'
        };
      case 'weak':
        return {
          gradient: 'from-gray-50 to-slate-50',
          border: 'border-gray-300',
          badge: 'bg-gray-600 text-white',
          tag: 'bg-gray-100 text-gray-700'
        };
      default:
        return {
          gradient: 'from-purple-50 to-pink-50',
          border: 'border-purple-200',
          badge: 'bg-purple-600 text-white',
          tag: 'bg-purple-100 text-purple-700'
        };
    }
  };

  return (
    <div className="bg-white p-8 print:p-0">
        {/* Header */}
        <div className="mb-8 pb-6 border-b-2 border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {form.title} - Analytics Report
          </h1>
          <p className="text-sm text-gray-600">
            Generated on {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          {form.description && (
            <p className="text-sm text-gray-700 mt-2">{form.description}</p>
          )}
        </div>

        {/* Executive Summary */}
        {analytics.insights?.summary && (
          <section className="mb-8 break-inside-avoid">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <h2 className="text-2xl font-bold text-gray-900">Executive Summary</h2>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r">
              <div className="text-gray-800">
                {renderMarkdown(analytics.insights.summary)}
              </div>
            </div>
          </section>
        )}

        {/* Overall Statistics */}
        <section className="mb-8 break-inside-avoid">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600 flex-shrink-0" />
            Overall Statistics
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-gray-600 mb-1">Total Responses</div>
              <div className="text-3xl font-bold text-blue-700">
                {analytics.totalResponsesAnalyzed || 0}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
              <div className="text-sm font-medium text-gray-600 mb-1">Overall Sentiment</div>
              <div className="text-lg font-bold text-green-700 capitalize">
                {(() => {
                  if (!analytics.sentiment?.overall) return 'N/A';
                  const { positive, neutral, negative } = analytics.sentiment.overall;
                  const max = Math.max(positive, neutral, negative);
                  if (max === positive) return 'Positive';
                  if (max === neutral) return 'Neutral';
                  return 'Negative';
                })()}
              </div>
              {analytics.sentiment?.overall?.averageScore !== undefined && (
                <div className="text-sm text-gray-600 mt-1">
                  Score: {analytics.sentiment.overall.averageScore.toFixed(2)}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <div className="text-sm font-medium text-gray-600 mb-1">Topics Identified</div>
              <div className="text-3xl font-bold text-purple-700">
                {analytics.sentiment?.topicCorrelations?.length || 0}
              </div>
            </div>
          </div>
        </section>

        {/* Sentiment Breakdown */}
        {analytics.sentiment?.overall && (
          <section className="mb-8 break-inside-avoid">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Cloud className="w-6 h-6 text-blue-600 flex-shrink-0" />
              Overall Response Climate
            </h2>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="text-center mb-4">
                <div className="text-5xl font-bold text-gray-900 mb-2">
                  {analytics.sentiment.overall.positive}%
                </div>
                <div className="text-lg font-medium text-gray-700 capitalize">
                  {(() => {
                    const { positive, neutral, negative } = analytics.sentiment.overall;
                    const max = Math.max(positive, neutral, negative);
                    if (max === positive) return 'Positive Sentiment';
                    if (max === neutral) return 'Neutral Sentiment';
                    return 'Negative Sentiment';
                  })()}
                </div>
              </div>
              <div className="space-y-3">
                {analytics.sentiment.overall.positive > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <ThumbsUp className="w-4 h-4 text-green-600" />
                        Positive
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {analytics.sentiment.overall.positive}%
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${analytics.sentiment.overall.positive}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {analytics.sentiment.overall.neutral > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Minus className="w-4 h-4 text-gray-600" />
                        Neutral
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {analytics.sentiment.overall.neutral}%
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gray-400 rounded-full"
                        style={{ width: `${analytics.sentiment.overall.neutral}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {analytics.sentiment.overall.negative > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <ThumbsDown className="w-4 h-4 text-red-600" />
                        Negative
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {analytics.sentiment.overall.negative}%
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${analytics.sentiment.overall.negative}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Key Findings */}
        {analytics.insights?.keyFindings && analytics.insights.keyFindings.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <h2 className="text-2xl font-bold text-gray-900">Key Findings</h2>
            </div>
            <div className="space-y-4">
              {analytics.insights.keyFindings.slice(0, 10).map((finding, index) => (
                <div key={index} className="break-inside-avoid bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-900 flex-1">
                      {finding.finding}
                    </p>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getConfidenceBadge(finding.confidence)}`}>
                      {finding.confidence} confidence
                    </span>
                  </div>
                  
                  {finding.evidence?.pattern && (
                    <p className="text-xs text-gray-600 mb-2">
                      <span className="font-medium">Pattern:</span> {finding.evidence.pattern}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Based on {finding.basedOnResponses} responses</span>
                    {finding.evidence?.significance && (
                      <span>• Significance: {(finding.evidence.significance * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  
                  {finding.evidence?.supportingQuotes && finding.evidence.supportingQuotes.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-gray-200">
                      <p className="text-xs text-gray-700 italic">
                        "{finding.evidence.supportingQuotes[0].substring(0, 150)}..."
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Dominant Themes */}
        {analytics.topics?.dominantThemes && analytics.topics.dominantThemes.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <h2 className="text-2xl font-bold text-gray-900">Dominant Themes</h2>
            </div>
            <div className="space-y-3">
              {analytics.topics.dominantThemes.slice(0, 10).map((theme, index) => (
                <div key={index} className="break-inside-avoid bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{theme.theme}</h3>
                    <span className="text-sm font-bold text-gray-700">{theme.frequency}×</span>
                  </div>
                  {theme.representativeQuotes && theme.representativeQuotes.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {theme.representativeQuotes.slice(0, 2).map((quote, qIdx) => (
                        <p key={qIdx} className="text-sm text-gray-700 italic">
                          "{quote}"
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Topic Sentiment Analysis */}
        {analytics.sentiment?.topicCorrelations && analytics.sentiment.topicCorrelations.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-6 h-6 text-indigo-600 flex-shrink-0" />
              <h2 className="text-2xl font-bold text-gray-900">Topic Sentiment Analysis</h2>
            </div>
            <div className="space-y-3">
              {analytics.sentiment.topicCorrelations.slice(0, 10).map((correlation, index) => {
                const sentiment = correlation.sentiment || { positive: 0, neutral: 0, negative: 0 };
                const averageScore = correlation.averageScore ?? 0;
                const responseCount = correlation.responseCount ?? 0;
                
                return (
                  <div key={index} className="break-inside-avoid bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-medium text-gray-900">{correlation.topic}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getSentimentColor(correlation.dominantSentiment)}`}>
                          {getSentimentIcon(correlation.dominantSentiment)}
                          {correlation.dominantSentiment}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {responseCount} responses
                      </span>
                    </div>
                    
                    {/* Sentiment bar */}
                    <div className="flex items-center gap-1 h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                      {sentiment.positive > 0 && (
                        <div className="bg-green-500 h-full" style={{ width: `${sentiment.positive}%` }} />
                      )}
                      {sentiment.neutral > 0 && (
                        <div className="bg-gray-400 h-full" style={{ width: `${sentiment.neutral}%` }} />
                      )}
                      {sentiment.negative > 0 && (
                        <div className="bg-red-500 h-full" style={{ width: `${sentiment.negative}%` }} />
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        {sentiment.positive > 0 && (
                          <span className="text-green-700">{sentiment.positive}% positive</span>
                        )}
                        {sentiment.neutral > 0 && (
                          <span className="text-gray-600">{sentiment.neutral}% neutral</span>
                        )}
                        {sentiment.negative > 0 && (
                          <span className="text-red-700">{sentiment.negative}% negative</span>
                        )}
                      </div>
                      <span className="text-gray-500">avg: {averageScore.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {analytics.insights?.recommendations && analytics.insights.recommendations.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-6 h-6 text-green-600 flex-shrink-0" />
              <h2 className="text-2xl font-bold text-gray-900">Recommendations</h2>
            </div>
            <div className="space-y-3">
              {analytics.insights.recommendations.slice(0, 10).map((rec, index) => (
                <div key={index} className="break-inside-avoid bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{rec.recommendation}</h3>
                      {rec.rationale && (
                        <p className="text-sm text-gray-700 mb-2">{rec.rationale}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="capitalize">Priority: {rec.priority}</span>
                        {rec.expectedImpact && (
                          <span>• Impact: {rec.expectedImpact}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Topic Relationships */}
        {analytics.topics?.cooccurrence && analytics.topics.cooccurrence.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Network className="w-6 h-6 text-purple-600 flex-shrink-0" />
              <h2 className="text-2xl font-bold text-gray-900">Topic Relationships</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Topics that frequently appear together in responses
            </p>
            <div className="grid grid-cols-2 gap-3">
              {analytics.topics.cooccurrence!.slice(0, 16).map((co, index) => {
                // Use the relationship field to determine color (it contains the strength)
                const relationshipLower = co.relationship.toLowerCase();
                let strength = 'weak';
                if (relationshipLower.includes('strong')) {
                  strength = 'strong';
                } else if (relationshipLower.includes('moderate') || relationshipLower.includes('medium')) {
                  strength = 'medium';
                }
                
                const colors = getCorrelationColors(strength);
                
                return (
                  <div key={index} className={`break-inside-avoid bg-gradient-to-r ${colors.gradient} border ${colors.border} rounded-lg p-3 hover:shadow-sm transition-shadow`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-7 h-7 ${colors.badge} rounded-full flex items-center justify-center font-bold text-xs`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-gray-900 bg-white px-2 py-0.5 rounded">
                            {co.topic1}
                          </span>
                          <span className="text-gray-400">↔</span>
                          <span className="text-sm font-semibold text-gray-900 bg-white px-2 py-0.5 rounded">
                            {co.topic2}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`font-medium capitalize ${colors.tag} px-2 py-0.5 rounded`}>
                            {co.relationship}
                          </span>
                          <span className="text-gray-600">
                            • {co.frequency}× co-occurrence
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Answer Segmentation */}
        {analytics.correlations?.closedQuestionTopics && analytics.correlations.closedQuestionTopics.length > 0 && (
          <section className="mb-8" style={{ pageBreakBefore: 'always' }}>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-6 h-6 text-indigo-600 flex-shrink-0" />
              <h2 className="text-2xl font-bold text-gray-900">Answer Segmentation</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Topic preferences by answer choices
            </p>
            <div className="grid grid-cols-2 gap-4">
              {analytics.correlations.closedQuestionTopics.map((question, qIndex) => (
                <div key={qIndex} className="break-inside-avoid border border-gray-200 rounded-lg p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">{question.questionTitle}</h3>
                    <span className="text-xs text-gray-500 capitalize">{question.questionType}</span>
                  </div>
                  
                  <div className="space-y-3">
                    {question.correlations.map((answer, aIndex) => (
                      <div key={aIndex} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">{answer.answerValue}</span>
                          <span className="text-xs text-gray-600">
                            {answer.responseCount} {answer.responseCount === 1 ? 'response' : 'responses'}
                          </span>
                        </div>
                        
                        {answer.topicDistribution && answer.topicDistribution.length > 0 ? (
                          <div className="space-y-1.5">
                            {answer.topicDistribution.slice(0, 5).map((topic, tIndex) => (
                              <div key={tIndex} className="flex items-center gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="font-medium text-gray-900">{topic.topic}</span>
                                    <span className="text-gray-600">{topic.percentage}%</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-indigo-500"
                                      style={{ width: `${topic.percentage}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-xs text-gray-500 w-8 text-right">
                                  {topic.count}
                                </span>
                              </div>
                            ))}
                            {answer.topicDistribution.length > 5 && (
                              <p className="text-xs text-gray-500 text-center mt-2">
                                +{answer.topicDistribution.length - 5} more topics
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">No topics discussed</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>Generated by FormulAI Analytics • {new Date().toISOString().split('T')[0]}</p>
        </footer>
      </div>
    );
};
