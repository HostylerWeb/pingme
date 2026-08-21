'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';

interface EventDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  startsAt: string;
  endsAt: string;
  placeName: string | null;
  address: string | null;
  goingCount: number;
  maybeCount: number;
  commentCount: number;
  withdrawalCount: number;
  rsvpCount: number;
  allowMessages: boolean;
  isEnded: boolean;
  createdAt: string;
  userId: string;
  hostDisplayName: string | null;
  coverUrl: string | null;
  hostLivenessVerified: boolean;
  hostIdVerified: boolean;
}

export default function AdminEventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'hide' | 'delete' | 'restore' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminFetch<EventDetail>(`/admin/events/${eventId}`);
      setEvent(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moderate(action: 'delete' | 'hide' | 'restore') {
    if (!event) return;
    setActionId(event.id);
    try {
      const path =
        action === 'delete'
          ? `/admin/events/${event.id}`
          : action === 'hide'
            ? `/admin/events/${event.id}/hide`
            : `/admin/events/${event.id}/restore`;
      const method = action === 'delete' ? 'DELETE' : 'PATCH';
      await adminFetch(path, { method });
      setConfirmAction(null);
      if (action === 'delete') {
        router.push('/events');
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return <LoadingBlock />;
  }

  if (!event) {
    return (
      <div>
        <PageHeader title="Event not found" />
        <p className="text-sm text-destructive">{error || 'This event could not be loaded.'}</p>
        <Button className="mt-4" variant="secondary" onClick={() => router.push('/events')}>
          Back to events
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={event.title}
        description={`Hosted by ${event.hostDisplayName ?? event.userId.slice(0, 8)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => router.push('/events')}>
              Back
            </Button>
            {event.status === 'active' && !event.isEnded ? (
              <Button
                variant="secondary"
                disabled={actionId === event.id}
                onClick={() => setConfirmAction('hide')}
              >
                Hide
              </Button>
            ) : event.status === 'hidden' ? (
              <Button
                variant="secondary"
                disabled={actionId === event.id}
                onClick={() => setConfirmAction('restore')}
              >
                Restore
              </Button>
            ) : null}
            <Button
              variant="danger"
              disabled={actionId === event.id}
              onClick={() => setConfirmAction('delete')}
            >
              Delete
            </Button>
          </div>
        }
      />

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge>{event.status}</Badge>
            {event.isEnded ? <Badge color="zinc">Ended</Badge> : null}
            {event.hostLivenessVerified ? <Badge color="green">Liveness</Badge> : null}
            {event.hostIdVerified ? <Badge color="blue">ID</Badge> : null}
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground">{event.description}</p>
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.coverUrl}
              alt=""
              className="mt-4 max-h-64 w-full rounded-lg object-cover"
            />
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card className="p-5 space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Host</p>
              <Link href={`/users/${event.userId}`} className="font-medium text-accent hover:underline">
                {event.hostDisplayName ?? event.userId}
              </Link>
            </div>
            <div>
              <p className="text-muted-foreground">Starts</p>
              <p>{formatDate(event.startsAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ends</p>
              <p>{formatDate(event.endsAt)}</p>
            </div>
            {event.placeName ? (
              <div>
                <p className="text-muted-foreground">Place</p>
                <p>{event.placeName}</p>
                {event.address ? <p className="text-muted-foreground">{event.address}</p> : null}
              </div>
            ) : null}
            <div>
              <p className="text-muted-foreground">RSVP</p>
              <p>
                {event.goingCount} going · {event.maybeCount} maybe · {event.rsvpCount} total
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Engagement</p>
              <p>
                {event.commentCount} comments · {event.withdrawalCount} withdrawals
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p>{formatDate(event.createdAt)}</p>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={confirmAction !== null}
        title={
          confirmAction === 'delete'
            ? 'Delete event?'
            : confirmAction === 'hide'
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
              variant={confirmAction === 'restore' ? 'primary' : 'danger'}
              disabled={actionId === event.id}
              onClick={() => {
                if (confirmAction) {
                  void moderate(confirmAction);
                }
              }}
            >
              {confirmAction === 'delete'
                ? 'Delete event'
                : confirmAction === 'hide'
                  ? 'Hide event'
                  : 'Restore event'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {confirmAction === 'delete'
            ? 'This marks the event deleted and removes it from the mobile app.'
            : confirmAction === 'hide'
              ? 'This hides the event from the mobile app immediately.'
              : 'This makes the event visible in the mobile app again if it is still upcoming.'}
        </p>
      </Modal>
    </div>
  );
}
