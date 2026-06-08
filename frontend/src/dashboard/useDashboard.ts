/**
 * Dashboard data hook — fetches all dashboard aggregation data from the REST API.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export interface BreakCountData {
  last24h: number;
  last7d: number;
}

export interface TrendPoint {
  timestamp: string;
  count: number;
}

export interface ServiceBreakCount {
  service: string;
  count: number;
}

export interface SeverityCount {
  severity: string;
  count: number;
}

export interface DeploymentEvent {
  timestamp: string;
  version: string;
  service: string;
}

export interface DashboardData {
  breakCounts: BreakCountData;
  errorRateTrend: TrendPoint[];
  topServices: ServiceBreakCount[];
  timeSeries: TrendPoint[];
  severityBreakdown: SeverityCount[];
  deploymentEvents: DeploymentEvent[];
  airbrakeUnreachable: boolean;
}

const EMPTY: DashboardData = {
  breakCounts: { last24h: 0, last7d: 0 },
  errorRateTrend: [],
  topServices: [],
  timeSeries: [],
  severityBreakdown: [],
  deploymentEvents: [],
  airbrakeUnreachable: false,
};

export function useDashboard(apiBase = '/api'): {
  data: DashboardData;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`${apiBase}/dashboard`);
        const json = await res.json();
        if (!cancelled) setData(json as DashboardData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setData((prev) => ({ ...prev, airbrakeUnreachable: true }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchAll();
    return () => { cancelled = true; };
  }, [apiBase]);

  return { data, loading, error };
}
