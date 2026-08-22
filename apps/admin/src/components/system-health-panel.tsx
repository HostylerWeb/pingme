'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ServiceHealthStatus = 'ok' | 'degraded' | 'disabled' | 'error';

interface ServiceHealthItem {
  id: string;
  label: string;
  status: ServiceHealthStatus;
  detail: string;
}

interface SystemHealthResponse {
  overall: ServiceHealthStatus;
  timestamp: string;
  runMode: string;
  workersEnabled: boolean;
  workerProcessSplit?: boolean;
  services: ServiceHealthItem[];
}

function statusBadge(status: ServiceHealthStatus) {
  switch (status) {
    case 'ok':
      return <Badge color="green">OK</Badge>;
    case 'degraded':
      return <Badge color="yellow">Degraded</Badge>;
    case 'disabled':
      return <Badge color="zinc">Disabled</Badge>;
    case 'error':
      return <Badge color="red">Error</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

function statusDot(status: ServiceHealthStatus) {
  const color =
    status === 'ok'
      ? 'bg-green-500'
      : status === 'degraded'
        ? 'bg-amber-400'
        : status === 'disabled'
          ? 'bg-zinc-500'
          : 'bg-red-500';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

export function SystemHealthPanel() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<SystemHealthResponse>('/admin/system/health');
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system health');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const services = health?.services ?? [];
  const coreServices = services.filter((s) =>
    ['api', 'database', 'redis', 'notification_queue', 'push_delivery', 'ota_updates'].includes(s.id),
  );
  const workerServices = services.filter((s) => s.id.startsWith('worker_'));

  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">System health</h2>
          <p className="text-sm text-ink-tertiary">
            Quick view of API dependencies and background workers.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? 'Checking…' : 'Refresh'}
        </Button>
      </div>

      {error ? <p className="mb-3 text-sm text-error">{error}</p> : null}

      {health ? (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-3">
            {statusDot(health.overall)}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                Overall: {health.overall.toUpperCase()}
              </p>
              <p className="text-sm text-ink-tertiary">
                RUN_MODE={health.runMode}
                {health.workerProcessSplit
                  ? ' · background workers run in pingme-worker service'
                  : health.workersEnabled
                    ? ' · workers active in this process'
                    : ' · workers disabled in this process'}
              </p>
            </div>
            <p className="text-xs text-ink-tertiary">
              Checked {new Date(health.timestamp).toLocaleString()}
            </p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-tertiary">
                Core services
              </h3>
              <ul className="space-y-3">
                {coreServices.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      {statusDot(service.status)}
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{service.label}</p>
                        <p className="text-sm text-ink-tertiary break-words">{service.detail}</p>
                      </div>
                    </div>
                    {statusBadge(service.status)}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-tertiary">
                Background workers
              </h3>
              <ul className="space-y-2">
                {workerServices.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {statusDot(service.status)}
                      <span className="text-sm text-foreground">{service.label}</span>
                    </div>
                    {statusBadge(service.status)}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      ) : loading ? (
        <Card><p className="text-sm text-ink-secondary">Loading health checks…</p></Card>
      ) : null}
    </div>
  );
}
