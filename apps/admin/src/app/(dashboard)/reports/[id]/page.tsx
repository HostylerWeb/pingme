'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { adminFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';

interface ReportDetail {
  report: {
    id: string;
    reason: string;
    status: string;
    targetType: string;
    targetId: string;
    description: string | null;
    resolutionNote: string | null;
    createdAt: string;
    assignedTo: { email: string } | null;
    reporter: { id: string; displayName: string | null };
    reportedUser: { id: string; displayName: string | null };
  };
  target: {
    type: string;
    id: string;
    content?: string;
    chatId?: string;
    postId?: string;
    postContent?: string;
    displayName?: string | null;
    bio?: string | null;
    status?: string;
    authorDisplayName?: string | null;
  } | null;
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ReportDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolveStatus, setResolveStatus] = useState<'resolved' | 'dismissed'>('resolved');

  async function load() {
    setLoading(true);
    try {
      const result = await adminFetch<ReportDetail>(`/admin/reports/${params.id}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function assignToMe() {
    setActionLoading(true);
    try {
      await adminFetch(`/admin/reports/${params.id}/assign`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign report');
    } finally {
      setActionLoading(false);
    }
  }

  async function submitResolution() {
    setActionLoading(true);
    try {
      await adminFetch(`/admin/reports/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: resolveStatus, resolutionNote }),
      });
      setResolveOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update report');
    } finally {
      setActionLoading(false);
    }
  }

  async function removeTarget() {
    if (!data?.target) return;
    setActionLoading(true);
    try {
      if (data.target.type === 'post') {
        await adminFetch(`/admin/wall/posts/${data.target.id}`, { method: 'DELETE' });
      } else if (data.target.type === 'reply') {
        await adminFetch(`/admin/wall/replies/${data.target.id}`, { method: 'DELETE' });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove content');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading report…" />;
  if (!data) return <p className="text-red-400">{error || 'Report not found'}</p>;

  const { report, target } = data;

  return (
    <div>
      <PageHeader
        title={`Report: ${report.reason}`}
        description={`${report.targetType} report filed ${formatDate(report.createdAt)}`}
        actions={
          <>
            {!report.assignedTo ? (
              <Button variant="secondary" disabled={actionLoading} onClick={assignToMe}>
                Assign to me
              </Button>
            ) : null}
            {report.status !== 'resolved' && report.status !== 'dismissed' ? (
              <Button disabled={actionLoading} onClick={() => setResolveOpen(true)}>
                Resolve / dismiss
              </Button>
            ) : null}
          </>
        }
      />

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-medium text-white">Report details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Status</dt>
              <dd><Badge>{report.status}</Badge></dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Assigned to</dt>
              <dd className="text-zinc-200">{report.assignedTo?.email ?? 'Unassigned'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Reporter</dt>
              <dd className="text-zinc-200">{report.reporter.displayName ?? report.reporter.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Reported user</dt>
              <dd>
                <Link href={`/users/${report.reportedUser.id}`} className="text-violet-300 hover:underline">
                  {report.reportedUser.displayName ?? report.reportedUser.id}
                </Link>
              </dd>
            </div>
            {report.description ? (
              <div>
                <dt className="text-zinc-500">Description</dt>
                <dd className="mt-1 text-zinc-200">{report.description}</dd>
              </div>
            ) : null}
            {report.resolutionNote ? (
              <div>
                <dt className="text-zinc-500">Resolution note</dt>
                <dd className="mt-1 text-zinc-200">{report.resolutionNote}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-medium text-white">Reported content</h2>
            {target && (target.type === 'post' || target.type === 'reply') ? (
              <Button variant="danger" disabled={actionLoading} onClick={removeTarget}>
                Delete content
              </Button>
            ) : null}
          </div>

          {!target ? (
            <p className="mt-4 text-sm text-zinc-500">Target content not found (may have been deleted).</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              <p><span className="text-zinc-500">Type:</span> <Badge color="violet">{target.type}</Badge></p>
              {target.authorDisplayName ? (
                <p><span className="text-zinc-500">Author:</span> {target.authorDisplayName}</p>
              ) : null}
              {target.content ? (
                <div className="rounded-lg bg-zinc-900 p-3 text-zinc-200">{target.content}</div>
              ) : null}
              {target.postContent ? (
                <div>
                  <p className="text-zinc-500">Parent post</p>
                  <div className="mt-1 rounded-lg bg-zinc-900 p-3 text-zinc-200">{target.postContent}</div>
                </div>
              ) : null}
              {target.bio ? (
                <div className="rounded-lg bg-zinc-900 p-3 text-zinc-200">{target.bio}</div>
              ) : null}
              {target.chatId ? (
                <Link href={`/chats/${target.chatId}`}>
                  <Button variant="secondary">Open chat viewer</Button>
                </Link>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={resolveOpen}
        title="Resolve report"
        onClose={() => setResolveOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolveOpen(false)}>Cancel</Button>
            <Button disabled={actionLoading} onClick={submitResolution}>Submit</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={resolveStatus === 'resolved' ? 'primary' : 'secondary'}
              onClick={() => setResolveStatus('resolved')}
            >
              Resolved
            </Button>
            <Button
              variant={resolveStatus === 'dismissed' ? 'primary' : 'secondary'}
              onClick={() => setResolveStatus('dismissed')}
            >
              Dismissed
            </Button>
          </div>
          <Textarea
            placeholder="Resolution note (optional)"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={4}
          />
        </div>
      </Modal>
    </div>
  );
}
