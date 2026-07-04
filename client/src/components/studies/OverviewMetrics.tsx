import React from 'react';
import { FlaskConical, LineChart, Sparkles, Timer } from 'lucide-react';
import { shellCardClass } from '../shell/design-tokens';
import type { DashboardSummary } from '../../services/projectsService';

interface OverviewMetricsProps {
  summary: DashboardSummary;
  planName?: string;
  showPlanCard?: boolean;
}

function formatTrend(current: number, previous: number): string {
  if (previous <= 0) {
    return current > 0 ? '+100% vs last 7 days' : 'No change vs last 7 days';
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct}% vs last 7 days`;
}

const OverviewMetrics: React.FC<OverviewMetricsProps> = ({
  summary,
  planName,
  showPlanCard,
}) => {
  const cards = [
    {
      label: 'Total studies',
      value: String(summary.totalStudies),
      sub: `${summary.activeStudies} active`,
      icon: FlaskConical,
      iconClass: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Total responses',
      value: summary.totalResponses.toLocaleString(),
      sub: formatTrend(summary.responsesLast7Days, summary.responsesPrev7Days),
      icon: LineChart,
      iconClass: 'text-green-600 bg-green-50',
    },
    {
      label: 'AI analyses ready',
      value: String(summary.aiAnalysesReady),
      sub: 'View results in Analytics',
      icon: Sparkles,
      iconClass: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'A/B tests running',
      value: String(summary.abTestsRunning),
      sub: 'View experiments in Studies',
      icon: Timer,
      iconClass: 'text-blue-600 bg-blue-50',
    },
  ];

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${showPlanCard ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
      {cards.map((card) => (
        <div key={card.label} className={shellCardClass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{card.value}</p>
              <p className="mt-1 text-xs text-gray-500">{card.sub}</p>
            </div>
            <span className={`rounded-lg p-2 ${card.iconClass}`}>
              <card.icon className="h-5 w-5" />
            </span>
          </div>
        </div>
      ))}
      {showPlanCard && (
        <div className={shellCardClass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">Current plan</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{planName ?? 'Free'}</p>
              <p className="mt-1 text-xs text-blue-600">View usage in Billing</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewMetrics;
