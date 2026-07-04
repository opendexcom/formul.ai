import React from 'react';
import { Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  formatUsageLine,
  resolveProjectUsage,
  resolveTokenUsage,
  usePlanUsageSnapshot,
} from '../../hooks/usePlanUsageSnapshot';

const SidebarPlanWidget: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const { billingEnabled, loading, planName, usage } = usePlanUsageSnapshot();

  if (!billingEnabled) return null;

  const tokens = resolveTokenUsage(usage);
  const projects = resolveProjectUsage(usage);
  const showTokens = loading || tokens.unlimited || (tokens.limit != null && tokens.limit > 0);
  const showProjects = loading || projects.unlimited || (projects.limit != null && projects.limit > 0);

  if (collapsed) {
    return (
      <Link
        to="/settings/billing"
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
        title={`Your plan: ${planName}`}
      >
        <Crown className="h-5 w-5" />
      </Link>
    );
  }

  return (
    <div className="mx-3 mb-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-blue-600" />
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your plan</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-900">
        {loading ? 'Loading…' : planName}
      </p>
      {showProjects && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Studies</span>
            <span>
              {loading
                ? '…'
                : formatUsageLine(projects.used, projects.limit, projects.unlimited)}
            </span>
          </div>
          {!loading && !projects.unlimited && projects.limit != null && projects.limit > 0 && (
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${projects.percentage}%` }}
              />
            </div>
          )}
        </div>
      )}
      {showTokens && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500">
            <span>AI tokens</span>
            <span>
              {loading
                ? '…'
                : formatUsageLine(tokens.used, tokens.limit, tokens.unlimited)}
            </span>
          </div>
          {!loading && !tokens.unlimited && tokens.limit != null && tokens.limit > 0 && (
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${tokens.percentage}%` }}
              />
            </div>
          )}
        </div>
      )}
      <Link
        to="/settings/billing"
        className="mt-3 block w-full rounded-lg bg-blue-50 py-2 text-center text-xs font-medium text-blue-700 hover:bg-blue-100"
      >
        View usage
      </Link>
    </div>
  );
};

export default SidebarPlanWidget;
