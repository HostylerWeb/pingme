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
import { Modal } from '@/components/ui/modal';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

interface EventItem {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  goingCount: number;
  maybeCount: number;
  withdrawalCount: number;
  isEnded: boolean;
  hostDisplayName: string | null;
  userId: string;
  hostLivenessVerified: boolean;
  hostIdVerified: boolean;
}

interface WithdrawalItem {
  id: string;
  userId: string;
  displayName: string;
  previousStatus: string;
  reasonCode: string;
  reasonLabel: string;
  reasonDetail: string | null;
  createdAt: string;
}

export default function EventsPage() {
  const [status, setStatus] = useState('active');
  const [lifecycle, setLifecycle] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: EventItem[]; total: number; limit: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [withdrawalsOpen, setWithdrawalsOpen] = useState(false);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalsEvent, setWithdrawalsEvent] = useState<{ id: string; title: string } | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    title: string;
    action: 'hide' | 'delete' | 'restore';
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      if (lifecycle) params.set('lifecycle', lifecycle);
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
  }, [page, status, lifecycle, q]);

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
      setConfirmAction(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }

  async function openWithdrawals(event: EventItem) {
    setWithdrawalsOpen(true);
    setWithdrawalsLoading(true);
    setWithdrawalsEvent({ id: event.id, title: event.title });
    setWithdrawals([]);
    try {
      const result = await adminFetch<{
        event: { id: string; title: string };
        items: WithdrawalItem[];
      }>(`/admin/events/${event.id}/withdrawals`);
      setWithdrawalsEvent(result.event);
      setWithdrawals(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load withdrawals');
      setWithdrawalsOpen(false);
    } finally {
      setWithdrawalsLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Events"
        description="Moderate user-created meetups, review host verification, and study RSVP withdrawals."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
          <option value="hidden">Hidden</option>
          <option value="deleted">Deleted</option>
        </Select>
        <Select value={lifecycle} onChange={(e) => { setPage(1); setLifecycle(e.target.value); }}>
          <option value="">All lifecycles</option>
          <option value="upcoming">Upcoming</option>
          <option value="ended">Ended (past)</option>
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
                <TH>Withdrawals</TH>
                <TH>Trust</TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {data.items.map((event) => (
                <TR key={event.id}>
                  <TD className="max-w-xs truncate font-medium">
                    <Link href={`/events/${event.id}`} className="hover:text-accent hover:underline">
                      {event.title}
                    </Link>
                  </TD>
                  <TD>
                    <Link href={`/users/${event.userId}`} className="text-accent hover:underline">
                      {event.hostDisplayName ?? event.userId.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD>{formatDate(event.startsAt)}</TD>
                  <TD>
                    {event.goingCount} / {event.maybeCount}
                  </TD>
                  <TD>
                    {event.withdrawalCount > 0 ? (
                      <button
                        type="button"
                        className="font-medium text-accent hover:underline"
                        onClick={() => void openWithdrawals(event)}
                      >
                        {event.withdrawalCount}
                      </button>
                    ) : (
                      '0'
                    )}
                  </TD>
                  <TD className="space-x-1">
                    {event.hostLivenessVerified ? <Badge color="green">Liveness</Badge> : null}
                    {event.hostIdVerified ? <Badge color="blue">ID</Badge> : null}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <Badge>{event.status}</Badge>
                      {event.isEnded ? <Badge color="zinc">Ended</Badge> : null}
                    </div>
                  </TD>
                  <TD className="space-x-2 text-right">
                    {event.status === 'active' && !event.isEnded ? (
                      <Button
                        variant="secondary"
                        disabled={actionId === event.id}
                        onClick={() =>
                          setConfirmAction({ id: event.id, title: event.title, action: 'hide' })
                        }
                      >
                        Hide
                      </Button>
                    ) : event.status === 'hidden' ? (
                      <Button
                        variant="secondary"
                        disabled={actionId === event.id}
                        onClick={() =>
                          setConfirmAction({ id: event.id, title: event.title, action: 'restore' })
                        }
                      >
                        Restore
                      </Button>
                    ) : null}
                    <Button
                      variant="danger"
                      disabled={actionId === event.id}
                      onClick={() =>
                        setConfirmAction({ id: event.id, title: event.title, action: 'delete' })
                      }
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

      <Modal
        open={confirmAction !== null}
        title={
          confirmAction?.action === 'delete'
            ? 'Delete event?'
            : confirmAction?.action === 'hide'
              ? 'Hide event?'
              : 'Restore event?'
        }
        onClose={() => setConfirmAction(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.action === 'restore' ? 'primary' : 'danger'}
              disabled={actionId === confirmAction?.id}
              onClick={() => {
                if (confirmAction) {
                  void moderate(confirmAction.id, confirmAction.action);
                }
              }}
            >
              {confirmAction?.action === 'delete'
                ? 'Delete event'
                : confirmAction?.action === 'hide'
                  ? 'Hide event'
                  : 'Restore event'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {confirmAction?.action === 'delete' ? (
            <>
              <strong className="text-foreground">{confirmAction.title}</strong> will be marked
              deleted and removed from the mobile app. This cannot be undone from the admin panel.
            </>
          ) : confirmAction?.action === 'hide' ? (
            <>
              <strong className="text-foreground">{confirmAction.title}</strong> will be hidden from
              the mobile app immediately. You can restore it later.
            </>
          ) : (
            <>
              <strong className="text-foreground">{confirmAction?.title}</strong> will be visible in
              the mobile app again if it is still upcoming.
            </>
          )}
        </p>
      </Modal>

      <Modal
        open={withdrawalsOpen}
        title={withdrawalsEvent ? `Withdrawals — ${withdrawalsEvent.title}` : 'Withdrawals'}
        onClose={() => setWithdrawalsOpen(false)}
        wide
      >
        {withdrawalsLoading ? (
          <LoadingBlock />
        ) : withdrawals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawals recorded for this event.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Was</TH>
                <TH>Reason</TH>
                <TH>Details</TH>
                <TH>When</TH>
              </TR>
            </THead>
            <TBody>
              {withdrawals.map((item) => (
                <TR key={item.id}>
                  <TD>
                    <Link href={`/users/${item.userId}`} className="text-accent hover:underline">
                      {item.displayName}
                    </Link>
                  </TD>
                  <TD>{item.previousStatus}</TD>
                  <TD>{item.reasonLabel}</TD>
                  <TD className="max-w-xs truncate">{item.reasonDetail ?? '—'}</TD>
                  <TD>{formatDate(item.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Modal>
    </div>
  );
}
