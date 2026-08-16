'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

interface EventItem {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  goingCount: number;
  maybeCount: number;
  hostDisplayName: string | null;
  userId: string;
  hostLivenessVerified: boolean;
  hostIdVerified: boolean;
}

export default function EventsPage() {
  const [status, setStatus] = useState('active');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: EventItem[]; total: number; limit: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      const result = await adminFetch<{ items: EventItem[]; total: number; limit: number }>(
        `/admin/events?${params}`,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [page, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(id: string, action: 'delete' | 'hide' | 'restore') {
    setActionId(id);
    try {
      const path =
        action === 'delete'
          ? `/admin/events/${id}`
          : action === 'hide'
            ? `/admin/events/${id}/hide`
            : `/admin/events/${id}/restore`;
      const method = action === 'delete' ? 'DELETE' : 'PATCH';
      await adminFetch(path, { method });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Events" description="Moderate user-created meetups and review host verification." />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
          <option value="hidden">Hidden</option>
          <option value="deleted">Deleted</option>
        </Select>
        <Input
          placeholder="Search title or description"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <Button onClick={() => { setPage(1); void load(); }}>Search</Button>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <LoadingBlock />
      ) : !data?.items.length ? (
        <EmptyState title="No events" description="No events match your filters." />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Event</TH>
                <TH>Host</TH>
                <TH>Starts</TH>
                <TH>RSVP</TH>
                <TH>Trust</TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {data.items.map((event) => (
                <TR key={event.id}>
                  <TD className="max-w-xs truncate font-medium">{event.title}</TD>
                  <TD>
                    <Link href={`/users/${event.userId}`} className="text-accent hover:underline">
                      {event.hostDisplayName ?? event.userId.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD>{formatDate(event.startsAt)}</TD>
                  <TD>
                    {event.goingCount} / {event.maybeCount}
                  </TD>
                  <TD className="space-x-1">
                    {event.hostLivenessVerified ? <Badge color="green">Liveness</Badge> : null}
                    {event.hostIdVerified ? <Badge color="blue">ID</Badge> : null}
                  </TD>
                  <TD>
                    <Badge>{event.status}</Badge>
                  </TD>
                  <TD className="space-x-2 text-right">
                    {event.status === 'active' ? (
                      <Button
                        variant="secondary"
                        disabled={actionId === event.id}
                        onClick={() => moderate(event.id, 'hide')}
                      >
                        Hide
                      </Button>
                    ) : event.status === 'hidden' ? (
                      <Button
                        variant="secondary"
                        disabled={actionId === event.id}
                        onClick={() => moderate(event.id, 'restore')}
                      >
                        Restore
                      </Button>
                    ) : null}
                    <Button
                      variant="danger"
                      disabled={actionId === event.id}
                      onClick={() => moderate(event.id, 'delete')}
                    >
                      Delete
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={page}
            total={data.total}
            limit={data.limit}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
