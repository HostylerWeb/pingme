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
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

interface UserSummary {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  counts: {
    reportsReceived: number;
    reportsFiled: number;
    wallPosts: number;
    matches: number;
  };
}

interface ChatMessagePreview {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  sender: { id: string; displayName: string | null };
}

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
    reporter: { id: string; displayName: string | null; avatarUrl?: string | null };
    reportedUser: { id: string; displayName: string | null; avatarUrl?: string | null };
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
    createdAt?: string;
  } | null;
  context: {
    summary: string;
    reportedUser: UserSummary | null;
    reporter: UserSummary | null;
    relatedReports: Array<{
      id: string;
      reason: string;
      status: string;
      targetType: string;
      createdAt: string;
      reporterDisplayName: string | null;
    }>;
    recentPosts: Array<{
      id: string;
      content: string;
      status: string;
      createdAt: string;
    }>;
    recentChats: Array<{
      chatId: string | null;
      matchId: string;
      matchStatus: string;
      chatStatus: string | null;
      otherUser: { id: string; displayName: string | null };
      lastMessage: { content: string; createdAt: string } | null;
      createdAt: string;
    }>;
    reporterConversation: {
      chatId: string;
      matchId: string;
      matchStatus: string;
      chatStatus: string;
      messages: ChatMessagePreview[];
    } | null;
    chatContext: {
      chatId: string;
      highlightedMessageId: string;
      messages: ChatMessagePreview[];
    } | null;
  };
}

function UserSummaryCard({
  title,
  user,
  highlight,
}: {
  title: string;
  user: UserSummary | null;
  highlight?: boolean;
}) {
  if (!user) {
    return (
      <Card>
        <h2 className="font-medium text-white">{title}</h2>
        <p className="mt-3 text-sm text-zinc-500">User not found.</p>
      </Card>
    );
  }

  return (
    <Card className={highlight ? 'border-violet-500/40' : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-white">{title}</h2>
          <p className="mt-1 text-lg font-semibold text-white">{user.displayName ?? 'Unnamed user'}</p>
          <p className="text-sm text-zinc-400">{user.email ?? user.phone ?? user.id}</p>
        </div>
        <Link href={`/users/${user.id}`}>
          <Button variant="secondary">Open profile</Button>
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Account status</dt>
          <dd className="mt-1"><Badge>{user.status}</Badge></dd>
        </div>
        <div>
          <dt className="text-zinc-500">Verification</dt>
          <dd className="mt-1 flex flex-wrap gap-2">
            <Badge color={user.emailVerified ? 'green' : 'zinc'}>Email {user.emailVerified ? 'verified' : 'unverified'}</Badge>
            <Badge color={user.phoneVerified ? 'green' : 'zinc'}>Phone {user.phoneVerified ? 'verified' : 'unverified'}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Reports received</dt>
          <dd className={`mt-1 ${user.counts.reportsReceived >= 3 ? 'font-semibold text-red-300' : 'text-zinc-200'}`}>
            {user.counts.reportsReceived}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Matches / posts</dt>
          <dd className="mt-1 text-zinc-200">{user.counts.matches} matches · {user.counts.wallPosts} posts</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Joined</dt>
          <dd className="mt-1 text-zinc-200">{formatDate(user.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Last seen</dt>
          <dd className="mt-1 text-zinc-200">{user.lastSeenAt ? formatDate(user.lastSeenAt) : '—'}</dd>
        </div>
      </dl>

      {user.bio ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Bio</p>
          <p className="mt-1 rounded-lg bg-zinc-900 p-3 text-sm text-zinc-200">{user.bio}</p>
        </div>
      ) : null}
    </Card>
  );
}

function ChatTranscript({
  messages,
  highlightedMessageId,
  reporterId,
  reportedUserId,
}: {
  messages: ChatMessagePreview[];
  highlightedMessageId?: string;
  reporterId: string;
  reportedUserId: string;
}) {
  if (!messages.length) {
    return <p className="text-sm text-zinc-500">No messages to show.</p>;
  }

  return (
    <div className="space-y-2">
      {messages.map((message) => {
        const isHighlighted = message.id === highlightedMessageId;
        const isReporter = message.sender.id === reporterId;
        const isReported = message.sender.id === reportedUserId;

        return (
          <div
            key={message.id}
            className={`rounded-lg border p-3 ${
              isHighlighted
                ? 'border-amber-500/60 bg-amber-500/10'
                : 'border-zinc-800 bg-zinc-900/50'
            }`}
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">
                  {message.sender.displayName ?? message.sender.id}
                </p>
                {isReporter ? <Badge color="violet">Reporter</Badge> : null}
                {isReported ? <Badge color="red">Reported user</Badge> : null}
                {isHighlighted ? <Badge color="yellow">Reported message</Badge> : null}
              </div>
              <span className="text-xs text-zinc-500">{formatDate(message.createdAt)}</span>
            </div>
            <p className="text-sm text-zinc-200">{message.content}</p>
          </div>
        );
      })}
    </div>
  );
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

  const { report, target, context } = data;
  const transcriptMessages =
    context.chatContext?.messages ??
    (target?.type === 'message' &&
    context.reporterConversation?.chatId === target.chatId
      ? context.reporterConversation.messages
      : context.reporterConversation?.messages ?? []);

  return (
    <div>
      <PageHeader
        title={`${report.reason.replace(/_/g, ' ')} report`}
        description={`${report.targetType} · filed ${formatDate(report.createdAt)}`}
        actions={
          <>
            <Link href={`/users/${report.reportedUser.id}`}>
              <Button variant="secondary">Reported user profile</Button>
            </Link>
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

      <Card className="mb-4 border-violet-500/30 bg-violet-500/5">
        <p className="text-sm font-medium text-violet-100">{context.summary}</p>
        {report.description ? (
          <p className="mt-2 text-sm text-zinc-300">
            <span className="text-zinc-500">Reporter note:</span> {report.description}
          </p>
        ) : null}
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <UserSummaryCard title="Reported user" user={context.reportedUser} highlight />
        <UserSummaryCard title="Reporter" user={context.reporter} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium text-white">What was reported</h2>
              <p className="mt-1 text-sm text-zinc-400">
                <Badge color="violet">{report.targetType}</Badge>{' '}
                <Badge>{report.status}</Badge>
              </p>
            </div>
            {target && (target.type === 'post' || target.type === 'reply') ? (
              <Button variant="danger" disabled={actionLoading} onClick={removeTarget}>
                Delete content
              </Button>
            ) : null}
          </div>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Assigned to</dt>
              <dd className="text-zinc-200">{report.assignedTo?.email ?? 'Unassigned'}</dd>
            </div>
            {report.resolutionNote ? (
              <div>
                <dt className="text-zinc-500">Resolution note</dt>
                <dd className="mt-1 text-zinc-200">{report.resolutionNote}</dd>
              </div>
            ) : null}
          </dl>

          {!target ? (
            <p className="mt-4 text-sm text-zinc-500">Target content not found (may have been deleted).</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              {target.authorDisplayName ? (
                <p><span className="text-zinc-500">Author:</span> {target.authorDisplayName}</p>
              ) : null}
              {target.content ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-zinc-100">
                  {target.content}
                </div>
              ) : null}
              {target.postContent ? (
                <div>
                  <p className="text-zinc-500">Parent post</p>
                  <div className="mt-1 rounded-lg bg-zinc-900 p-3 text-zinc-200">{target.postContent}</div>
                </div>
              ) : null}
              {target.bio ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-zinc-100">{target.bio}</div>
              ) : null}
              {target.createdAt ? (
                <p className="text-zinc-500">Posted {formatDate(target.createdAt)}</p>
              ) : null}
              {target.chatId ? (
                <Link href={`/chats/${target.chatId}`}>
                  <Button variant="secondary">Open full chat viewer</Button>
                </Link>
              ) : null}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium text-white">Conversation context</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {context.reporterConversation
                  ? 'Messages between reporter and reported user'
                  : 'No direct chat found between these users'}
              </p>
            </div>
            {context.reporterConversation ? (
              <Link href={`/chats/${context.reporterConversation.chatId}`}>
                <Button variant="secondary">Full chat</Button>
              </Link>
            ) : null}
          </div>

          <div className="mt-4 max-h-[28rem] overflow-y-auto">
            <ChatTranscript
              messages={transcriptMessages}
              highlightedMessageId={context.chatContext?.highlightedMessageId ?? (target?.type === 'message' ? target.id : undefined)}
              reporterId={report.reporter.id}
              reportedUserId={report.reportedUser.id}
            />
          </div>
        </Card>
      </div>

      {context.relatedReports.length > 0 ? (
        <Card className="mb-4">
          <h2 className="font-medium text-white">Other reports against this user</h2>
          <p className="mt-1 text-sm text-zinc-400">Helps spot repeat offenders or patterns.</p>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Reason</TH>
                  <TH>Status</TH>
                  <TH>Type</TH>
                  <TH>Reporter</TH>
                  <TH>Created</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {context.relatedReports.map((item) => (
                  <TR key={item.id}>
                    <TD>{item.reason}</TD>
                    <TD><Badge>{item.status}</Badge></TD>
                    <TD>{item.targetType}</TD>
                    <TD>{item.reporterDisplayName ?? '—'}</TD>
                    <TD className="text-zinc-400">{formatDate(item.createdAt)}</TD>
                    <TD>
                      <Link href={`/reports/${item.id}`}>
                        <Button variant="secondary">View</Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-medium text-white">Recent chats</h2>
          <p className="mt-1 text-sm text-zinc-400">Other conversations involving the reported user.</p>
          {context.recentChats.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No chats found.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Other user</TH>
                    <TH>Last message</TH>
                    <TH>Match</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {context.recentChats.map((chat) => (
                    <TR key={chat.matchId}>
                      <TD>{chat.otherUser.displayName ?? chat.otherUser.id}</TD>
                      <TD className="max-w-xs truncate text-zinc-300">
                        {chat.lastMessage?.content ?? '—'}
                      </TD>
                      <TD><Badge>{chat.matchStatus}</Badge></TD>
                      <TD>
                        {chat.chatId ? (
                          <Link href={`/chats/${chat.chatId}`}>
                            <Button variant="secondary">Open</Button>
                          </Link>
                        ) : '—'}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-medium text-white">Recent wall posts</h2>
          <p className="mt-1 text-sm text-zinc-400">Latest public posts from the reported user.</p>
          {context.recentPosts.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No wall posts found.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {context.recentPosts.map((post) => (
                <div key={post.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge>{post.status}</Badge>
                    <span className="text-xs text-zinc-500">{formatDate(post.createdAt)}</span>
                  </div>
                  <p className="text-sm text-zinc-200">{post.content}</p>
                </div>
              ))}
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
