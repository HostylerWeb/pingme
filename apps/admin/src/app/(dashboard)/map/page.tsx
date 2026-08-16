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
  wallCount: number;
  icebreakerCount: number;
  clusterRadiusMeters: number;
  ready?: boolean;
  cells: Array<{
    lat: number;
    lng: number;
    count: number;
    wallCount: number;
    icebreakerCount: number;
  }>;
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
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const topClusters = useMemo(() => (data?.cells ?? []).slice(0, 12), [data?.cells]);

  if (!data && !error) return <LoadingBlock label="Loading live map…" />;

  return (
    <div>
      <PageHeader
        title="Live map"
        description={`Users on Wall or Break the ice, grouped in ~${data?.clusterRadiusMeters ?? 550}m fuzzy areas. Refreshes every 60s.`}
      />

      {error ? <p className="mb-4 text-sm text-error">{error}</p> : null}
      {data && data.ready === false ? (
        <p className="mb-4 text-sm text-ink-secondary">Map data is warming up — refresh in a few seconds.</p>
      ) : null}

      {data ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <Card>
              <CardTitle>Online now</CardTitle>
              <CardValue>{data.totalActive}</CardValue>
            </Card>
            <Card>
              <CardTitle>On Wall</CardTitle>
              <CardValue>{data.wallCount}</CardValue>
            </Card>
            <Card>
              <CardTitle>Break the ice</CardTitle>
              <CardValue>{data.icebreakerCount}</CardValue>
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
                Shows users visible on Wall or with Break the ice on. Number = total in that zone.
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
                        <p className="text-[11px] text-ink-muted">
                          {cluster.wallCount} Wall · {cluster.icebreakerCount} ice
                        </p>
                        <p className="font-mono text-[11px] text-ink-muted">
                          {cluster.lat.toFixed(4)}, {cluster.lng.toFixed(4)}
                        </p>
                      </div>
                      <Badge color={cluster.count > 0 ? 'green' : 'zinc'}>active</Badge>
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
