'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { LoadingBlock } from '@/components/loading-block';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HeatmapResponse {
  totalActive: number;
  availableCount: number;
  cells: Array<{ lat: number; lng: number; count: number }>;
  points: Array<{
    lat: number | null;
    lng: number | null;
    isAvailable: boolean;
    displayName: string | null;
  }>;
}

interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const MIN_SPAN_DEGREES = 0.01;

function buildBounds(lats: number[], lngs: number[]): MapBounds {
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const latSpan = Math.max(maxLat - minLat, MIN_SPAN_DEGREES);
  const lngSpan = Math.max(maxLng - minLng, MIN_SPAN_DEGREES);

  return {
    minLat: centerLat - latSpan / 2,
    maxLat: centerLat + latSpan / 2,
    minLng: centerLng - lngSpan / 2,
    maxLng: centerLng + lngSpan / 2,
  };
}

function projectPoint(lat: number, lng: number, bounds: MapBounds) {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
  const y = (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;

  return {
    x: Math.min(96, Math.max(4, x)),
    y: Math.min(96, Math.max(4, y)),
  };
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

  const bounds = useMemo(() => {
    if (!data) return null;

    const lats = [
      ...data.points.map((point) => point.lat),
      ...data.cells.map((cell) => cell.lat),
    ].filter((value): value is number => value != null);
    const lngs = [
      ...data.points.map((point) => point.lng),
      ...data.cells.map((cell) => cell.lng),
    ].filter((value): value is number => value != null);

    if (!lats.length || !lngs.length) return null;
    return buildBounds(lats, lngs);
  }, [data]);

  const visiblePoints = useMemo(
    () => (data?.points ?? []).filter((point) => point.lat != null && point.lng != null),
    [data],
  );

  if (!data && !error) return <LoadingBlock label="Loading live map…" />;

  return (
    <div>
      <PageHeader
        title="Live map"
        description="Internal heatmap of active users (fuzzy locations only). Refreshes every 30s."
      />

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

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
              <CardTitle>Heat cells</CardTitle>
              <CardValue>{data.cells.length}</CardValue>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card className="overflow-hidden p-0">
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-background">
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgb(110 108 102 / 0.35) 1px, transparent 1px),
                      linear-gradient(to bottom, rgb(110 108 102 / 0.35) 1px, transparent 1px)
                    `,
                    backgroundSize: '48px 48px',
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-accent-soft/30 via-transparent to-background/80" />

                {!bounds || visiblePoints.length === 0 ? (
                  <div className="relative z-10 flex h-full items-center justify-center text-sm text-ink-muted">
                    No active presence data right now.
                  </div>
                ) : (
                  <>
                    {data.cells.map((cell) => {
                      const { x, y } = projectPoint(cell.lat, cell.lng, bounds);
                      const intensity = Math.min(cell.count / 5, 1);
                      return (
                        <div
                          key={`${cell.lat}-${cell.lng}`}
                          className="absolute z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                            backgroundColor: `rgba(224, 90, 66, ${0.25 + intensity * 0.55})`,
                          }}
                        />
                      );
                    })}
                    {visiblePoints.map((point, index) => {
                      const { x, y } = projectPoint(point.lat!, point.lng!, bounds);
                      return (
                        <div
                          key={`${point.lat}-${point.lng}-${index}`}
                          className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${x}%`, top: `${y}%` }}
                        >
                          <div
                            title={point.displayName ?? 'User'}
                            className={`h-3 w-3 rounded-full ring-2 ring-background ${
                              point.isAvailable ? 'bg-online' : 'bg-ink-muted'
                            }`}
                          />
                          {visiblePoints.length <= 12 ? (
                            <p className="mt-1 max-w-[8rem] truncate text-center text-[10px] font-medium text-foreground">
                              {point.displayName ?? 'User'}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                )}

                {bounds ? (
                  <div className="absolute bottom-3 left-3 z-30 rounded-md bg-background/80 px-2 py-1 text-[10px] text-ink-tertiary ring-1 ring-border">
                    {bounds.minLat.toFixed(4)}, {bounds.minLng.toFixed(4)} → {bounds.maxLat.toFixed(4)}, {bounds.maxLng.toFixed(4)}
                  </div>
                ) : null}
              </div>
              <div className="border-t border-divider px-4 py-3 text-xs text-ink-muted">
                Green dots = available users. Terracotta glow = density clusters. Locations are fuzzy — never exact GPS.
              </div>
            </Card>

            <Card>
              <h2 className="font-medium text-foreground">Active users</h2>
              <p className="mt-1 text-sm text-ink-secondary">Who is currently on the map.</p>
              {visiblePoints.length === 0 ? (
                <p className="mt-4 text-sm text-ink-muted">No users with location right now.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {visiblePoints.map((point, index) => (
                    <li
                      key={`${point.displayName}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{point.displayName ?? 'User'}</p>
                        <p className="font-mono text-[11px] text-ink-muted">
                          {point.lat!.toFixed(5)}, {point.lng!.toFixed(5)}
                        </p>
                      </div>
                      <Badge color={point.isAvailable ? 'green' : 'zinc'}>
                        {point.isAvailable ? 'Available' : 'Hidden'}
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
