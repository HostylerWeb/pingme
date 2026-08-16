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
  signups24h: number;
  icebreakerSessions24h: number;
  mutualMatches24h: number;
  activeChats24h: number;
  matchRate: number;
  icebreakerToChatRate: number;
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
  verificationReviewUsers: Array<{
    userId: string;
    displayName: string | null;
    status: string | null;
  }>;
}

import { useAdminSession } from '@/hooks/use-admin-session';

function canModerate(role?: string) {
  return role === 'moderator' || role === 'super_admin';
}

export default function DashboardPage() {
  const { session, mounted } = useAdminSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<DashboardStats>('/admin/dashboard/stats')
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats'));
  }, []);

  if (!stats && !error) return <LoadingBlock label="Loading dashboard…" />;

  const showModeration = mounted && canModerate(session?.admin.role);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Platform overview and recent moderation activity"
        actions={
          showModeration ? (
            <>
              <Link href="/reports" className="rounded-lg bg-accent px-4 py-2 text-sm text-on-accent hover:bg-accent/90">
                View reports
              </Link>
              <Link href="/content" className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-muted">
                Moderate content
              </Link>
            </>
          ) : undefined
        }
      />

      {error ? <p className="mb-4 text-sm text-error">{error}</p> : null}

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
            <Card>
              <CardTitle>Signups (24h)</CardTitle>
              <CardValue>{stats.signups24h}</CardValue>
            </Card>
            <Card>
              <CardTitle>Icebreaker sessions (24h)</CardTitle>
              <CardValue>{stats.icebreakerSessions24h}</CardValue>
            </Card>
            <Card>
              <CardTitle>Mutual matches (24h)</CardTitle>
              <CardValue>{stats.mutualMatches24h}</CardValue>
            </Card>
            <Card>
              <CardTitle>Match rate (24h)</CardTitle>
              <CardValue>{stats.matchRate}%</CardValue>
            </Card>
            <Card>
              <CardTitle>Icebreaker → chat</CardTitle>
              <CardValue>{stats.icebreakerToChatRate}%</CardValue>
            </Card>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-medium text-foreground">Flagged users (3+ reports / 24h)</h2>
              {stats.flaggedUsers.length === 0 ? (
                <Card><p className="text-sm text-ink-secondary">No auto-flagged users.</p></Card>
              ) : (
                <div className="space-y-2">
                  {stats.flaggedUsers.map((u) => (
                    <Link key={u.userId} href={`/users/${u.userId}`}>
                      <Card className="transition hover:border-red-500/40">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{u.displayName ?? u.userId}</p>
                            <p className="text-sm text-error">{u.reportCount} reports in 24h</p>
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
              <h2 className="mb-3 text-lg font-medium text-foreground">Verification review queue</h2>
              {stats.verificationReviewUsers.length === 0 ? (
                <Card><p className="text-sm text-ink-secondary">No users flagged by Didit review.</p></Card>
              ) : (
                <div className="space-y-2">
                  {stats.verificationReviewUsers.map((u) => (
                    <Link key={u.userId} href={`/users/${u.userId}`}>
                      <Card className="transition hover:border-warning/40">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{u.displayName ?? u.userId}</p>
                            <p className="text-sm text-amber-300">Requires admin review</p>
                          </div>
                          <Badge color="yellow">{u.status ?? 'unknown'}</Badge>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-lg font-medium text-foreground">Recent reports</h2>
            {stats.recentReports.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-secondary">No reports yet.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {stats.recentReports.map((report) => (
                  <Link key={report.id} href={`/reports/${report.id}`}>
                    <Card className="transition hover:border-accent/40">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {report.reportedUserDisplayName ?? 'Unknown user'} · {report.reason}
                          </p>
                          <p className="mt-1 text-sm text-ink-tertiary">
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
