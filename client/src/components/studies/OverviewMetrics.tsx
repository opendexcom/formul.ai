import React from 'react';
import { shellCardClass } from '../shell/design-tokens';
import type { DashboardSummary } from '../../services/projectsService';

interface OverviewMetricsProps {
  summary: DashboardSummary;
}

function formatTrend(current: number, previous: number): string {
  if (previous <= 0) {
    return current > 0 ? '+100% vs 7d' : 'No change vs 7d';
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct}% vs 7d`;
}

function aiCompleteLabel(ready: number, total: number): string {
  if (total <= 0) return '0% complete';
  return `${Math.round((ready / total) * 100)}% complete`;
}

const OverviewMetrics: React.FC<OverviewMetricsProps> = ({ summary }) => {
  const cards = [
    {
      label: 'Total studies',
      value: String(summary.totalStudies),
      sub: `${summary.activeStudies} active`,
    },
    {
      label: 'Total responses',
      value: summary.totalResponses.toLocaleString(),
      sub: formatTrend(summary.responsesLast7Days, summary.responsesPrev7Days),
    },
    {
      label: 'AI analyses ready',
      value: String(summary.aiAnalysesReady),
      sub: aiCompleteLabel(summary.aiAnalysesReady, summary.totalStudies),
    },
    {
      label: 'A/B tests running',
      value: String(summary.abTestsRunning),
      sub: summary.abTestsRunning > 0 ? `${summary.abTestsRunning} active` : 'None active',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className={`${shellCardClass} flex flex-col gap-1`}>
          <p className="text-[13px] font-medium leading-normal text-gray-500">{card.label}</p>
          <p className="text-[32px] font-bold leading-10 text-gray-900">{card.value}</p>
          <p className="text-xs leading-normal text-gray-400">{card.sub}</p>
        </div>
      ))}
    </div>
  );
};

export default OverviewMetrics;
