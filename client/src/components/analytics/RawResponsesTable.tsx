import { CheckCircle, Circle } from 'lucide-react';
import { FormData } from '../../services/formsService';

interface ResponseData {
  _id: string;
  answers: { questionId: string; value: any }[];
  submittedAt: string;
  respondentEmail?: string;
  ipAddress?: string;
  metadata?: {
    processedForAnalytics?: boolean;
    processingTaskId?: string;
    hasTextContent?: boolean;
    lastAnalyzed?: string;
    overallSentiment?: {
      label?: string;
      score?: number;
      emotionalTone?: string;
    };
  };
}

interface RawResponsesTableProps {
  form: FormData;
  responses: ResponseData[];
  showAnalyticsStatus?: boolean;
}

export const RawResponsesTable: React.FC<RawResponsesTableProps> = ({
  form,
  responses,
  showAnalyticsStatus = false
}) => {
  if (responses.length === 0) {
    return null;
  }

  // Only show Email column if any response includes respondentEmail
  const includeEmail = responses.some(r => !!r.respondentEmail);

  // Calculate status counts
  const analyzedCount = responses.filter(r => r.metadata?.processedForAnalytics).length;
  const pendingCount = responses.filter(r => r.metadata?.processingTaskId && !r.metadata?.processedForAnalytics).length;
  const notStartedCount = responses.filter(r => !r.metadata?.processingTaskId && !r.metadata?.processedForAnalytics && r.metadata?.hasTextContent).length;
  const notAnalyzedCount = responses.filter(r => !r.metadata?.hasTextContent).length;

  return (
    <div className="mt-8 bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">All Responses</h2>
            <p className="text-sm text-gray-600 mt-1">
              Complete list of all form submissions
            </p>
          </div>
          {showAnalyticsStatus && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">
                  {analyzedCount} analyzed
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-amber-500" />
                <span className="text-gray-700">
                  {pendingCount} pending
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">
                  {notStartedCount} not started
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-gray-300" />
                <span className="text-gray-700">
                  {notAnalyzedCount} not analyzed
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {showAnalyticsStatus && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted
              </th>
              {includeEmail && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
              )}
              {form.questions.map(question => (
                <th key={question.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {question.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {responses.map((response, index) => {
              const isProcessed = response.metadata?.processedForAnalytics === true;
              const isPending = response.metadata?.processingTaskId && !isProcessed;
              const hasText = response.metadata?.hasTextContent === true;
              
              return (
                <tr key={response._id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {showAnalyticsStatus && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isProcessed ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-xs text-green-700 font-medium">Analyzed</span>
                        </div>
                      ) : isPending ? (
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 text-amber-500 animate-pulse" />
                          <span className="text-xs text-amber-700 font-medium">Pending</span>
                        </div>
                      ) : hasText ? (
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-600">Not started</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-600">Not analyzed</span>
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(response.submittedAt).toLocaleString()}
                  </td>
                  {includeEmail && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {response.respondentEmail || '-'}
                    </td>
                  )}
                  {form.questions.map(question => {
                    const answer = response.answers.find(a => a.questionId === question.id);
                    const value = answer ? answer.value : '';
                    return (
                      <td key={question.id} className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
