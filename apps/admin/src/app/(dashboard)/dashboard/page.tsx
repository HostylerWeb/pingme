'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingBlock } from '@/components/loading-block';

interface DashboardStats {
  dau: number;
  postsToday: number;
  openReports: number;
  reviewingReports: number;
  totalUsers: number;
  suspendedUsers: number;
  activePresence: number;
  recentReports: Array<{
    id: string;
    reason: string;
    status: string;
    createdAt: string;
    reportedUserDisplayName: string | null;
  }>;
  flaggedUsers: Array<{
    userId: string;
    reportCount: number;
    displayName: string | null;
    status: string | null;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<DashboardStats>('/admin/dashboard/stats')
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats'));
  }, []);

  if (!stats && !error) return <LoadingBlock label="Loading dashboard…" />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Platform overview and recent moderation activity"
        actions={
          <>
            <Link href="/reports" className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500">
              View reports
            </Link>
            <Link href="/content" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900">
              Moderate content
            </Link>
          </>
        }
      />

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      {stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardTitle>DAU (24h)</CardTitle>
              <CardValue>{stats.dau}</CardValue>
            </Card>
            <Card>
              <CardTitle>Posts today</CardTitle>
              <CardValue>{stats.postsToday}</CardValue>
            </Card>
            <Card>
              <CardTitle>Open reports</CardTitle>
              <CardValue>{stats.openReports}</CardValue>
            </Card>
            <Card>
              <CardTitle>In review</CardTitle>
              <CardValue>{stats.reviewingReports}</CardValue>
            </Card>
            <Card>
              <CardTitle>Total users</CardTitle>
              <CardValue>{stats.totalUsers}</CardValue>
            </Card>
            <Card>
              <CardTitle>Suspended</CardTitle>
              <CardValue>{stats.suspendedUsers}</CardValue>
            </Card>
            <Card>
              <CardTitle>Active presence</CardTitle>
              <CardValue>{stats.activePresence}</CardValue>
            </Card>
            <Card>
              <CardTitle>Queue health</CardTitle>
              <CardValue className="text-xl">
                {stats.openReports + stats.reviewingReports === 0 ? 'Clear' : 'Needs attention'}
              </CardValue>
            </Card>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-medium text-white">Flagged users (3+ reports / 24h)</h2>
              {stats.flaggedUsers.length === 0 ? (
                <Card><p className="text-sm text-zinc-400">No auto-flagged users.</p></Card>
              ) : (
                <div className="space-y-2">
                  {stats.flaggedUsers.map((u) => (
                    <Link key={u.userId} href={`/users/${u.userId}`}>
                      <Card className="transition hover:border-red-500/40">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{u.displayName ?? u.userId}</p>
                            <p className="text-sm text-red-300">{u.reportCount} reports in 24h</p>
                          </div>
                          <Badge color="red">{u.status ?? 'unknown'}</Badge>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-medium text-white">Recent reports</h2>
            {stats.recentReports.length === 0 ? (
              <Card>
                <p className="text-sm text-zinc-400">No reports yet.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {stats.recentReports.map((report) => (
                  <Link key={report.id} href={`/reports/${report.id}`}>
                    <Card className="transition hover:border-violet-500/40">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-white">
                            {report.reportedUserDisplayName ?? 'Unknown user'} · {report.reason}
                          </p>
                          <p className="mt-1 text-sm text-zinc-500">
                            {formatRelative(report.createdAt)} · {formatDate(report.createdAt)}
                          </p>
                        </div>
                        <Badge>{report.status}</Badge>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
