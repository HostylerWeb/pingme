'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { adminFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { LoadingBlock } from '@/components/loading-block';
import { Tabs } from '@/components/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Textarea } from '@/components/ui/textarea';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

interface UserDetail {
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    status: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    livenessVerified: boolean;
    isAvailable: boolean;
    createdAt: string;
    lastSeenAt: string | null;
    profile: {
      displayName: string;
      bio: string | null;
      dateOfBirth: string;
    } | null;
    settings: {
      radiusMeters: number;
      quietMode: boolean;
    } | null;
    verifications: Array<{
      id: string;
      type: string;
      status: string;
      provider: string;
      verifiedAt: string | null;
      createdAt: string;
    }>;
    counts: Record<string, number>;
  };
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'posts', label: 'Posts' },
  { id: 'reports', label: 'Reports' },
  { id: 'chats', label: 'Chats' },
  { id: 'matches', label: 'Matches' },
  { id: 'devices', label: 'Devices' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'audit', label: 'Audit log' },
];

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusModal, setStatusModal] = useState<'suspended' | 'active' | 'deleted' | null>(null);
  const [note, setNote] = useState('');

  const [form, setForm] = useState({
    email: '',
    phone: '',
    displayName: '',
    bio: '',
    radiusMeters: 250,
    quietMode: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminFetch<UserDetail>(`/admin/users/${params.id}`);
      setData(result);
      setForm({
        email: result.user.email ?? '',
        phone: result.user.phone ?? '',
        displayName: result.user.profile?.displayName ?? '',
        bio: result.user.profile?.bio ?? '',
        radiusMeters: result.user.settings?.radiusMeters ?? 250,
        quietMode: result.user.settings?.quietMode ?? false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile() {
    setSaving(true);
    setError('');
    try {
      await adminFetch(`/admin/users/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: form.email || null,
          phone: form.phone || null,
          displayName: form.displayName,
          bio: form.bio || null,
          radiusMeters: Number(form.radiusMeters),
          quietMode: form.quietMode,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFlag(field: 'emailVerified' | 'phoneVerified', value: boolean) {
    setSaving(true);
    try {
      await adminFetch(`/admin/users/${params.id}/verification-flags`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function verificationAction(
    path: string,
    method: 'POST' | 'PATCH' = 'POST',
    body?: object,
  ) {
    setSaving(true);
    try {
      await adminFetch(`/admin/users/${params.id}${path}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: 'active' | 'suspended' | 'deleted') {
    setSaving(true);
    try {
      await adminFetch(`/admin/users/${params.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      });
      setStatusModal(null);
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) return <LoadingBlock label="Loading user…" />;
  if (!data) return <p className="text-red-400">{error || 'User not found'}</p>;

  const { user } = data;

  return (
    <div>
      <PageHeader
        title={user.profile?.displayName ?? 'User'}
        description={`${user.email ?? user.phone ?? user.id} · ${user.status}`}
        actions={
          <>
            <Badge color={user.livenessVerified ? 'green' : 'yellow'}>
              Liveness {user.livenessVerified ? 'passed' : 'not passed'}
            </Badge>
            {user.status !== 'suspended' ? (
              <Button variant="danger" disabled={saving} onClick={() => setStatusModal('suspended')}>
                Suspend
              </Button>
            ) : (
              <Button disabled={saving} onClick={() => setStatusModal('active')}>Reactivate</Button>
            )}
            {user.status !== 'deleted' ? (
              <Button variant="secondary" disabled={saving} onClick={() => setStatusModal('deleted')}>
                Ban
              </Button>
            ) : null}
          </>
        }
      />

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-medium text-white">Edit profile</h2>
            <div className="mt-4 space-y-3">
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              <Textarea placeholder="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
              <Input type="number" placeholder="Radius (m)" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: Number(e.target.value) })} />
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={form.quietMode} onChange={(e) => setForm({ ...form, quietMode: e.target.checked })} />
                Quiet mode
              </label>
              <Button disabled={saving} onClick={saveProfile}>Save changes</Button>
            </div>
          </Card>

          <Card>
            <h2 className="font-medium text-white">Verification controls</h2>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-zinc-900 p-3">
                <div>
                  <p className="text-white">Email verified</p>
                  <Badge>{user.emailVerified ? 'yes' : 'no'}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={saving} onClick={() => verificationAction('/verification/resend-email')}>
                    Resend OTP
                  </Button>
                  <Button variant="secondary" disabled={saving} onClick={() => toggleFlag('emailVerified', !user.emailVerified)}>
                    {user.emailVerified ? 'Unverify' : 'Mark verified'}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-zinc-900 p-3">
                <div>
                  <p className="text-white">Phone verified</p>
                  <Badge>{user.phoneVerified ? 'yes' : 'no'}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={saving} onClick={() => verificationAction('/verification/resend-phone')}>
                    Resend OTP
                  </Button>
                  <Button variant="secondary" disabled={saving} onClick={() => toggleFlag('phoneVerified', !user.phoneVerified)}>
                    {user.phoneVerified ? 'Unverify' : 'Mark verified'}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-zinc-900 p-3">
                <p className="text-white">Liveness (Didit)</p>
                <p className="mt-1 text-zinc-400">
                  Current: {user.livenessVerified ? 'Passed' : 'Not passed'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={saving} onClick={() => verificationAction('/verification/reset-liveness')}>
                    Force re-verify
                  </Button>
                  <Button variant="secondary" disabled={saving} onClick={() => verificationAction('/verification/start-kyc')}>
                    Start full KYC
                  </Button>
                  <Button variant="secondary" disabled={saving} onClick={() => verificationAction('/verification/clear-review')}>
                    Clear review flag
                  </Button>
                  <Button disabled={saving} onClick={() => verificationAction('/verification/liveness', 'PATCH', { status: 'passed' })}>
                    Mark passed
                  </Button>
                  <Button variant="danger" disabled={saving} onClick={() => verificationAction('/verification/liveness', 'PATCH', { status: 'failed' })}>
                    Mark failed
                  </Button>
                  <Button variant="secondary" disabled={saving} onClick={() => verificationAction('/verification/liveness', 'PATCH', { status: 'expired' })}>
                    Mark expired
                  </Button>
                </div>
              </div>

              {user.verifications.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-zinc-500">Verification history</p>
                  {user.verifications.map((v) => (
                    <div key={v.id} className="flex justify-between rounded border border-zinc-800 px-3 py-2">
                      <span>{v.type} · {v.provider}</span>
                      <Badge>{v.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="font-medium text-white">Account info</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-zinc-500">Joined</dt><dd>{formatDate(user.createdAt)}</dd></div>
              <div><dt className="text-zinc-500">Last seen</dt><dd>{user.lastSeenAt ? formatDate(user.lastSeenAt) : '—'}</dd></div>
              <div><dt className="text-zinc-500">Available now</dt><dd>{user.isAvailable ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-zinc-500">Posts</dt><dd>{user.counts.wallPosts}</dd></div>
              <div><dt className="text-zinc-500">Reports received</dt><dd>{user.counts.reportsReceived}</dd></div>
              <div><dt className="text-zinc-500">Devices</dt><dd>{user.counts.devices}</dd></div>
              <div><dt className="text-zinc-500">Matches</dt><dd>{(user.counts.matchesAsUserA ?? 0) + (user.counts.matchesAsUserB ?? 0)}</dd></div>
              <div><dt className="text-zinc-500">Blocks</dt><dd>{(user.counts.blocksInitiated ?? 0) + (user.counts.blocksReceived ?? 0)}</dd></div>
            </dl>
          </Card>
        </div>
      ) : null}

      {tab === 'posts' ? <UserPostsTab userId={params.id} /> : null}
      {tab === 'reports' ? <UserReportsTab userId={params.id} /> : null}
      {tab === 'chats' ? <UserChatsTab userId={params.id} /> : null}
      {tab === 'matches' ? <UserMatchesTab userId={params.id} /> : null}
      {tab === 'devices' ? <UserDevicesTab userId={params.id} /> : null}
      {tab === 'blocks' ? <UserBlocksTab userId={params.id} /> : null}
      {tab === 'audit' ? <UserAuditTab userId={params.id} /> : null}

      <Modal
        open={statusModal !== null}
        title={statusModal === 'deleted' ? 'Ban user' : statusModal === 'suspended' ? 'Suspend user' : 'Reactivate user'}
        onClose={() => setStatusModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusModal(null)}>Cancel</Button>
            <Button variant={statusModal === 'active' ? 'primary' : 'danger'} disabled={saving} onClick={() => statusModal && updateStatus(statusModal)}>
              Confirm
            </Button>
          </>
        }
      >
        <Textarea placeholder="Optional note for audit log" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </Modal>
    </div>
  );
}

function UserPostsTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Array<{ id: string; content: string; status: string; createdAt: string }>; total: number; limit: number } | null>(null);

  useEffect(() => {
    adminFetch<{ items: Array<{ id: string; content: string; status: string; createdAt: string }>; total: number; limit: number }>(
      `/admin/users/${userId}/posts?page=${page}`,
    ).then(setData);
  }, [userId, page]);

  return (
    <ActivityTable
      data={data}
      page={page}
      onPageChange={setPage}
      columns={['Content', 'Status', 'Created', '']}
      renderRow={(post) => (
        <TR key={post.id}>
          <TD className="max-w-md">{post.content}</TD>
          <TD><Badge>{post.status}</Badge></TD>
          <TD className="text-zinc-400">{formatDate(post.createdAt)}</TD>
          <TD>
            {post.status !== 'deleted' ? (
              <Button variant="danger" onClick={() => adminFetch(`/admin/wall/posts/${post.id}`, { method: 'DELETE' }).then(() => setPage(1))}>
                Delete
              </Button>
            ) : null}
          </TD>
        </TR>
      )}
    />
  );
}

function UserReportsTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Array<{ id: string; reason: string; status: string; createdAt: string; reporterDisplayName: string | null }>; total: number; limit: number } | null>(null);

  useEffect(() => {
    adminFetch<{ items: Array<{ id: string; reason: string; status: string; createdAt: string; reporterDisplayName: string | null }>; total: number; limit: number }>(
      `/admin/users/${userId}/reports?page=${page}`,
    ).then(setData);
  }, [userId, page]);

  return (
    <ActivityTable
      data={data}
      page={page}
      onPageChange={setPage}
      columns={['Reason', 'Status', 'Reporter', 'Created', '']}
      renderRow={(r) => (
        <TR key={r.id}>
          <TD>{r.reason}</TD>
          <TD><Badge>{r.status}</Badge></TD>
          <TD>{r.reporterDisplayName ?? '—'}</TD>
          <TD className="text-zinc-400">{formatDate(r.createdAt)}</TD>
          <TD><Link href={`/reports/${r.id}`}><Button variant="secondary">View</Button></Link></TD>
        </TR>
      )}
    />
  );
}

function UserChatsTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Array<{ chatId: string | null; otherUserDisplayName: string; status: string; createdAt: string }>; total: number; limit: number } | null>(null);

  useEffect(() => {
    adminFetch<{ items: Array<{ chatId: string | null; otherUserDisplayName: string; status: string; createdAt: string }>; total: number; limit: number }>(
      `/admin/users/${userId}/chats?page=${page}`,
    ).then(setData);
  }, [userId, page]);

  return (
    <ActivityTable
      data={data}
      page={page}
      onPageChange={setPage}
      columns={['Other user', 'Match status', 'Created', '']}
      renderRow={(c) => (
        <TR key={`${c.chatId}-${c.createdAt}`}>
          <TD>{c.otherUserDisplayName}</TD>
          <TD><Badge>{c.status}</Badge></TD>
          <TD className="text-zinc-400">{formatDate(c.createdAt)}</TD>
          <TD>
            {c.chatId ? (
              <Link href={`/chats/${c.chatId}`}><Button variant="secondary">Open chat</Button></Link>
            ) : '—'}
          </TD>
        </TR>
      )}
    />
  );
}

function UserMatchesTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Array<{ id: string; source: string; status: string; otherDisplayName: string; createdAt: string }>; total: number; limit: number } | null>(null);

  useEffect(() => {
    adminFetch<{ items: Array<{ id: string; source: string; status: string; otherDisplayName: string; createdAt: string }>; total: number; limit: number }>(
      `/admin/users/${userId}/matches?page=${page}`,
    ).then(setData);
  }, [userId, page]);

  return (
    <ActivityTable
      data={data}
      page={page}
      onPageChange={setPage}
      columns={['Other user', 'Source', 'Status', 'Created']}
      renderRow={(m) => (
        <TR key={m.id}>
          <TD>{m.otherDisplayName}</TD>
          <TD><Badge color="violet">{m.source}</Badge></TD>
          <TD><Badge>{m.status}</Badge></TD>
          <TD className="text-zinc-400">{formatDate(m.createdAt)}</TD>
        </TR>
      )}
    />
  );
}

function UserDevicesTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<Array<{ id: string; platform: string; pushToken: string; appVersion: string | null; lastActiveAt: string | null }>>([]);

  useEffect(() => {
    adminFetch<{ items: typeof items }>(`/admin/users/${userId}/devices`).then((d) => setItems(d.items));
  }, [userId]);

  if (!items.length) return <Card><p className="text-sm text-zinc-500">No registered devices.</p></Card>;

  return (
    <Table>
      <THead><TR><TH>Platform</TH><TH>Push token</TH><TH>App version</TH><TH>Last active</TH></TR></THead>
      <TBody>
        {items.map((d) => (
          <TR key={d.id}>
            <TD>{d.platform}</TD>
            <TD className="max-w-xs truncate font-mono text-xs">{d.pushToken}</TD>
            <TD>{d.appVersion ?? '—'}</TD>
            <TD className="text-zinc-400">{d.lastActiveAt ? formatDate(d.lastActiveAt) : '—'}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function UserBlocksTab({ userId }: { userId: string }) {
  const [data, setData] = useState<{ initiated: Array<{ displayName: string | null; userId: string; createdAt: string }>; received: Array<{ displayName: string | null; userId: string; createdAt: string }> } | null>(null);

  useEffect(() => {
    adminFetch<{ initiated: Array<{ displayName: string | null; userId: string; createdAt: string }>; received: Array<{ displayName: string | null; userId: string; createdAt: string }> }>(
      `/admin/users/${userId}/blocks`,
    ).then(setData);
  }, [userId]);

  if (!data) return <LoadingBlock />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-medium text-white">Blocked by this user</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {data.initiated.map((b) => (
            <li key={b.userId} className="flex justify-between">
              <Link href={`/users/${b.userId}`} className="text-violet-300 hover:underline">{b.displayName ?? b.userId}</Link>
              <span className="text-zinc-500">{formatDate(b.createdAt)}</span>
            </li>
          ))}
          {data.initiated.length === 0 ? <li className="text-zinc-500">None</li> : null}
        </ul>
      </Card>
      <Card>
        <h3 className="font-medium text-white">Blocked this user</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {data.received.map((b) => (
            <li key={b.userId} className="flex justify-between">
              <Link href={`/users/${b.userId}`} className="text-violet-300 hover:underline">{b.displayName ?? b.userId}</Link>
              <span className="text-zinc-500">{formatDate(b.createdAt)}</span>
            </li>
          ))}
          {data.received.length === 0 ? <li className="text-zinc-500">None</li> : null}
        </ul>
      </Card>
    </div>
  );
}

function UserAuditTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Array<{ id: string; action: string; entityType: string | null; createdAt: string }>; total: number; limit: number } | null>(null);

  useEffect(() => {
    adminFetch<{ items: Array<{ id: string; action: string; entityType: string | null; createdAt: string }>; total: number; limit: number }>(
      `/admin/users/${userId}/audit-logs?page=${page}`,
    ).then(setData);
  }, [userId, page]);

  return (
    <ActivityTable
      data={data}
      page={page}
      onPageChange={setPage}
      columns={['Action', 'Entity', 'When']}
      renderRow={(log) => (
        <TR key={log.id}>
          <TD className="font-medium text-white">{log.action}</TD>
          <TD className="text-zinc-400">{log.entityType ?? '—'}</TD>
          <TD className="text-zinc-400">{formatDate(log.createdAt)}</TD>
        </TR>
      )}
    />
  );
}

function ActivityTable<T>({
  data,
  page,
  onPageChange,
  columns,
  renderRow,
}: {
  data: { items: T[]; total: number; limit: number } | null;
  page: number;
  onPageChange: (p: number) => void;
  columns: string[];
  renderRow: (item: T) => React.ReactNode;
}) {
  if (!data) return <LoadingBlock />;
  if (!data.items.length) return <Card><p className="text-sm text-zinc-500">No records.</p></Card>;

  return (
    <>
      <Table>
        <THead><TR>{columns.map((c) => <TH key={c}>{c}</TH>)}</TR></THead>
        <TBody>{data.items.map((item) => renderRow(item))}</TBody>
      </Table>
      <Pagination page={page} total={data.total} limit={data.limit} onPageChange={onPageChange} />
    </>
  );
}
