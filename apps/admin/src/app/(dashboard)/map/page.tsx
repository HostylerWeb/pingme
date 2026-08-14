'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { LoadingBlock } from '@/components/loading-block';
import { Card, CardTitle, CardValue } from '@/components/ui/card';

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
    if (!data?.points.length) return null;
    const lats = data.points.map((p) => p.lat).filter((v): v is number => v != null);
    const lngs = data.points.map((p) => p.lng).filter((v): v is number => v != null);
    if (!lats.length || !lngs.length) return null;
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [data]);

  function project(lat: number, lng: number) {
    if (!bounds) return { x: 50, y: 50 };
    const pad = 0.01;
    const latSpan = Math.max(bounds.maxLat - bounds.minLat, pad);
    const lngSpan = Math.max(bounds.maxLng - bounds.minLng, pad);
    const x = ((lng - bounds.minLng) / lngSpan) * 100;
    const y = (1 - (lat - bounds.minLat) / latSpan) * 100;
    return { x, y };
  }

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

          <Card className="overflow-hidden p-0">
            <div className="relative aspect-[16/10] w-full bg-zinc-900">
              {!bounds || data.points.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No active presence data right now.
                </div>
              ) : (
                <>
                  {data.cells.map((cell) => {
                    const { x, y } = project(cell.lat, cell.lng);
                    const intensity = Math.min(cell.count / 5, 1);
                    return (
                      <div
                        key={`${cell.lat}-${cell.lng}`}
                        className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          backgroundColor: `rgba(139, 92, 246, ${0.2 + intensity * 0.6})`,
                        }}
                      />
                    );
                  })}
                  {data.points.map((point, index) => {
                    if (point.lat == null || point.lng == null) return null;
                    const { x, y } = project(point.lat, point.lng);
                    return (
                      <div
                        key={`${point.lat}-${point.lng}-${index}`}
                        title={point.displayName ?? 'User'}
                        className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-950 ${
                          point.isAvailable ? 'bg-emerald-400' : 'bg-zinc-400'
                        }`}
                        style={{ left: `${x}%`, top: `${y}%` }}
                      />
                    );
                  })}
                </>
              )}
            </div>
            <div className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-500">
              Green dots = available users. Purple glow = density clusters. Locations are fuzzy — never exact GPS.
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
