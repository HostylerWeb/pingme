'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { LoadingBlock } from '@/components/loading-block';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminLiveMap } from '@/components/admin-live-map';

interface HeatmapResponse {
  totalActive: number;
  availableCount: number;
  clusterRadiusMeters: number;
  cells: Array<{ lat: number; lng: number; count: number; availableCount: number }>;
}

export default function MapPage() {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<HeatmapResponse>('/admin/map/heatmap')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load map data'));

    const interval = setInterval(() => {
      adminFetch<HeatmapResponse>('/admin/map/heatmap').then(setData).catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const topClusters = useMemo(() => (data?.cells ?? []).slice(0, 12), [data?.cells]);

  if (!data && !error) return <LoadingBlock label="Loading live map…" />;

  return (
    <div>
      <PageHeader
        title="Live map"
        description={`Grouped presence clusters (~${data?.clusterRadiusMeters ?? 550}m fuzzy areas). Refreshes every 30s.`}
      />

      {error ? <p className="mb-4 text-sm text-error">{error}</p> : null}

      {data ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardTitle>Active sessions</CardTitle>
              <CardValue>{data.totalActive}</CardValue>
            </Card>
            <Card>
              <CardTitle>Available now</CardTitle>
              <CardValue>{data.availableCount}</CardValue>
            </Card>
            <Card>
              <CardTitle>Clusters</CardTitle>
              <CardValue>{data.cells.length}</CardValue>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card className="overflow-hidden p-0">
              <AdminLiveMap cells={data.cells} clusterRadiusMeters={data.clusterRadiusMeters} />
              <div className="border-t border-divider px-4 py-3 text-xs text-ink-muted">
                Circles group users into ~{data.clusterRadiusMeters}m fuzzy areas. Number = users in that zone.
                Locations are never exact GPS.
              </div>
            </Card>

            <Card>
              <h2 className="font-medium text-foreground">Top clusters</h2>
              <p className="mt-1 text-sm text-ink-secondary">Where activity is concentrated right now.</p>
              {topClusters.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">No active clusters right now.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {topClusters.map((cluster) => (
                    <li
                      key={`${cluster.lat}-${cluster.lng}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {cluster.count} user{cluster.count === 1 ? '' : 's'}
                        </p>
                        <p className="font-mono text-[11px] text-ink-muted">
                          {cluster.lat.toFixed(4)}, {cluster.lng.toFixed(4)}
                        </p>
                      </div>
                      <Badge color={cluster.availableCount > 0 ? 'green' : 'zinc'}>
                        {cluster.availableCount} visible
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
