import React from 'react';
import {
  Citation,
  CrossVariantCorrelation,
  CrossVariantInsight,
  HypothesisEvaluation,
  HypothesisVerdict,
} from '../../types/comparative-report';
import { CitationChips } from './CitationChips';

const verdictStyles: Record<HypothesisVerdict, string> = {
  supported: 'bg-green-100 text-green-800',
  partially_supported: 'bg-yellow-100 text-yellow-800',
  inconclusive: 'bg-gray-100 text-gray-800',
  not_supported: 'bg-red-100 text-red-800',
};

const verdictLabels: Record<HypothesisVerdict, string> = {
  supported: 'Supported',
  partially_supported: 'Partially supported',
  inconclusive: 'Inconclusive',
  not_supported: 'Not supported',
};

interface HypothesisVerdictCardProps {
  evaluations: HypothesisEvaluation[];
  onCitationClick?: (citation: Citation) => void;
}

export const HypothesisVerdictCard: React.FC<HypothesisVerdictCardProps> = ({
  evaluations,
  onCitationClick,
}) => {
  if (!evaluations.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Hypothesis evaluation</h2>
        <p className="mt-2 text-sm text-gray-500">No hypotheses defined for this project.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Hypothesis evaluation</h2>
      <div className="mt-4 space-y-4">
        {evaluations.map((evaluation) => (
          <div key={evaluation.hypothesis} className="rounded-lg border border-gray-100 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-gray-900">{evaluation.hypothesis}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${verdictStyles[evaluation.verdict]}`}
              >
                {verdictLabels[evaluation.verdict]}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">{evaluation.reasoning}</p>
            <CitationChips
              citations={evaluation.citations}
              onCitationClick={onCitationClick}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

interface CrossVariantInsightsCardProps {
  insights: CrossVariantInsight[];
  onCitationClick?: (citation: Citation) => void;
}

export const CrossVariantInsightsCard: React.FC<CrossVariantInsightsCardProps> = ({
  insights,
  onCitationClick,
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-gray-900">Cross-variant insights</h2>
    {!insights.length ? (
      <p className="mt-2 text-sm text-gray-500">No cross-variant insights generated.</p>
    ) : (
      <ul className="mt-4 space-y-3">
        {insights.map((insight, index) => (
          <li key={index} className="rounded-lg bg-gray-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-white px-2 py-0.5 text-xs font-medium uppercase text-gray-600">
                {insight.type}
              </span>
              <span className="text-xs text-gray-500">
                {insight.relatedVariants.join(' vs ')}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-800">{insight.text}</p>
            <CitationChips citations={insight.citations} onCitationClick={onCitationClick} />
          </li>
        ))}
      </ul>
    )}
  </div>
);

interface CrossVariantCorrelationsCardProps {
  correlations: CrossVariantCorrelation[];
  onCitationClick?: (citation: Citation) => void;
}

export const CrossVariantCorrelationsCard: React.FC<CrossVariantCorrelationsCardProps> = ({
  correlations,
  onCitationClick,
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-gray-900">Correlations</h2>
    {!correlations.length ? (
      <p className="mt-2 text-sm text-gray-500">No notable cross-variant correlations detected.</p>
    ) : (
      <ul className="mt-4 space-y-3">
        {correlations.map((correlation, index) => (
          <li key={index} className="text-sm text-gray-700">
            <p>{correlation.description}</p>
            <p className="mt-1 text-xs text-gray-500">
              {correlation.metric} · {correlation.variants.join(', ')}
              {correlation.strength != null ? ` · strength ${correlation.strength.toFixed(1)}` : ''}
            </p>
            <CitationChips citations={correlation.citations} onCitationClick={onCitationClick} />
          </li>
        ))}
      </ul>
    )}
  </div>
);

interface VariantInsightsCardProps {
  variantKey: string;
  summary: string;
  insights: Array<{ text: string; confidence: string; citations: Citation[] }>;
  onCitationClick?: (citation: Citation) => void;
}

export const VariantInsightsCard: React.FC<VariantInsightsCardProps> = ({
  variantKey,
  summary,
  insights,
  onCitationClick,
}) => (
  <div className="space-y-4">
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Variant {variantKey} summary</h3>
      <div className="prose prose-sm mt-3 max-w-none text-gray-700">
        {summary.split('\n').map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </div>
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Key insights</h3>
      <ul className="mt-4 space-y-3">
        {insights.map((insight, index) => (
          <li key={index} className="rounded-lg bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-800">{insight.text}</p>
              <span className="rounded bg-white px-2 py-0.5 text-xs text-gray-500">
                {insight.confidence}
              </span>
            </div>
            <CitationChips citations={insight.citations} onCitationClick={onCitationClick} />
          </li>
        ))}
      </ul>
    </div>
  </div>
);
