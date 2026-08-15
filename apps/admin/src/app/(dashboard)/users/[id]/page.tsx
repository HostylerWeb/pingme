'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { adminFetch, API_BASE_URL } from '@/lib/api';
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
      gender?: string | null;
    } | null;
    settings: {
      radiusMeters: number;
      quietMode: boolean;
    } | null;
    subscription?: {
      plan: string;
      status: string;
      isPremium: boolean;
      paymentProvider: string | null;
      currentPeriodEnd: string | null;
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
  { id: 'security', label: 'Security' },
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
    radiusMeters: 0,
    quietMode: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let defaultWallRadius: number | undefined;
      try {
        const configResponse = await fetch(`${API_BASE_URL}/config`);
        const configJson = (await configResponse.json()) as {
          data?: { distance?: { wall?: { defaultMeters?: number } } };
        };
        const meters = configJson.data?.distance?.wall?.defaultMeters;
        if (typeof meters === 'number') {
          defaultWallRadius = meters;
        }
      } catch {
        // Admin form falls back to the user's saved radius only.
      }

      const result = await adminFetch<UserDetail>(`/admin/users/${params.id}`);
      setData(result);
      setForm({
        email: result.user.email ?? '',
        phone: result.user.phone ?? '',
        displayName: result.user.profile?.displayName ?? '',
        bio: result.user.profile?.bio ?? '',
        radiusMeters: result.user.settings?.radiusMeters ?? defaultWallRadius ?? 0,
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
            <h2 className="font-medium text-foreground">Edit profile</h2>
            <div className="mt-4 space-y-3">
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              <Textarea placeholder="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
              <Input type="number" placeholder="Radius (m)" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: Number(e.target.value) })} />
              <label className="flex items-center gap-2 text-sm text-ink-secondary">
                <input type="checkbox" checked={form.quietMode} onChange={(e) => setForm({ ...form, quietMode: e.target.checked })} />
                Quiet mode
              </label>
              <Button disabled={saving} onClick={saveProfile}>Save changes</Button>
            </div>
          </Card>

          <Card>
            <h2 className="font-medium text-foreground">Premium subscription</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-surface-muted p-3">
                <div>
                  <p className="text-foreground">Plan</p>
                  <Badge color={user.subscription?.isPremium ? 'green' : 'zinc'}>
                    {user.subscription?.isPremium ? 'Premium' : 'Free'}
                  </Badge>
                  {user.subscription?.currentPeriodEnd ? (
                    <p className="mt-1 text-ink-secondary">
                      Until {formatDate(user.subscription.currentPeriodEnd)}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {!user.subscription?.isPremium ? (
                    <Button
                      disabled={saving}
                      onClick={() => verificationAction('/subscription/grant-premium', 'POST', { note: 'Admin grant' })}
                    >
                      Grant premium
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      disabled={saving}
                      onClick={() => verificationAction('/subscription/revoke-premium')}
                    >
                      Revoke premium
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="font-medium text-foreground">Verification controls</h2>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-surface-muted p-3">
                <div>
                  <p className="text-foreground">Email verified</p>
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

              <div className="flex items-center justify-between rounded-lg bg-surface-muted p-3">
                <div>
                  <p className="text-foreground">Phone verified</p>
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

              <div className="rounded-lg bg-surface-muted p-3">
                <p className="text-foreground">Liveness (Didit)</p>
                <p className="mt-1 text-ink-secondary">
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
                  <p className="text-ink-tertiary">Verification history</p>
                  {user.verifications.map((v) => (
                    <div key={v.id} className="flex justify-between rounded border border-border px-3 py-2">
                      <span>{v.type} · {v.provider}</span>
                      <Badge>{v.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="font-medium text-foreground">Account info</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-ink-tertiary">User ID</dt><dd className="font-mono text-xs break-all">{user.id}</dd></div>
              <div><dt className="text-ink-tertiary">Joined</dt><dd>{formatDate(user.createdAt)}</dd></div>
              <div><dt className="text-ink-tertiary">Date of birth</dt><dd>{user.profile?.dateOfBirth ? formatDate(user.profile.dateOfBirth) : '—'}</dd></div>
              <div><dt className="text-ink-tertiary">Gender</dt><dd>{user.profile?.gender ?? '—'}</dd></div>
              <div><dt className="text-ink-tertiary">Last seen</dt><dd>{user.lastSeenAt ? formatDate(user.lastSeenAt) : '—'}</dd></div>
              <div><dt className="text-ink-tertiary">Available now</dt><dd>{user.isAvailable ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-ink-tertiary">Posts</dt><dd>{user.counts.wallPosts}</dd></div>
              <div><dt className="text-ink-tertiary">Reports received</dt><dd>{user.counts.reportsReceived}</dd></div>
              <div><dt className="text-ink-tertiary">Devices</dt><dd>{user.counts.devices}</dd></div>
              <div><dt className="text-ink-tertiary">Matches</dt><dd>{(user.counts.matchesAsUserA ?? 0) + (user.counts.matchesAsUserB ?? 0)}</dd></div>
              <div><dt className="text-ink-tertiary">Blocks</dt><dd>{(user.counts.blocksInitiated ?? 0) + (user.counts.blocksReceived ?? 0)}</dd></div>
            </dl>
          </Card>
        </div>
      ) : null}

      {tab === 'posts' ? <UserPostsTab userId={params.id} /> : null}
      {tab === 'reports' ? <UserReportsTab userId={params.id} /> : null}
      {tab === 'chats' ? <UserChatsTab userId={params.id} /> : null}
      {tab === 'matches' ? <UserMatchesTab userId={params.id} /> : null}
      {tab === 'devices' ? <UserDevicesTab userId={params.id} /> : null}
      {tab === 'security' ? <UserSecurityTab userId={params.id} /> : null}
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
          <TD className="text-ink-secondary">{formatDate(post.createdAt)}</TD>
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
          <TD className="text-ink-secondary">{formatDate(r.createdAt)}</TD>
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
          <TD className="text-ink-secondary">{formatDate(c.createdAt)}</TD>
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
          <TD className="text-ink-secondary">{formatDate(m.createdAt)}</TD>
        </TR>
      )}
    />
  );
}

function UserDevicesTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<Array<{
    id: string;
    platform: string;
    pushToken: string;
    deviceId: string | null;
    deviceModel: string | null;
    osVersion: string | null;
    userAgent: string | null;
    appVersion: string | null;
    lastIpAddress: string | null;
    lastActiveAt: string | null;
    createdAt: string;
  }>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ items: typeof items }>(`/admin/users/${userId}/devices`).then((d) => setItems(d.items));
  }, [userId]);

  if (!items.length) return <Card><p className="text-sm text-ink-tertiary">No registered devices.</p></Card>;

  return (
    <>
      <p className="mb-3 text-sm text-ink-tertiary">Click a device row for full forensic details (identity, IP, location, security events).</p>
      <Table>
        <THead>
          <TR>
            <TH>Platform</TH>
            <TH>Device</TH>
            <TH>OS</TH>
            <TH>Push token</TH>
            <TH>Last IP</TH>
            <TH>App version</TH>
            <TH>Last active</TH>
          </TR>
        </THead>
        <TBody>
          {items.map((d) => (
            <TR
              key={d.id}
              className="cursor-pointer hover:bg-surface-muted/60"
              onClick={() => setSelectedDeviceId(d.id)}
            >
              <TD>{d.platform}</TD>
              <TD>{d.deviceModel ?? '—'}</TD>
              <TD>{d.osVersion ?? '—'}</TD>
              <TD className="max-w-xs truncate font-mono text-xs">{d.pushToken}</TD>
              <TD className="font-mono text-xs">{d.lastIpAddress ?? '—'}</TD>
              <TD>{d.appVersion ?? '—'}</TD>
              <TD className="text-ink-secondary">{d.lastActiveAt ? formatDate(d.lastActiveAt) : '—'}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {selectedDeviceId ? (
        <DeviceForensicModal
          userId={userId}
          deviceId={selectedDeviceId}
          onClose={() => setSelectedDeviceId(null)}
        />
      ) : null}
    </>
  );
}

interface DeviceForensics {
  device: {
    id: string;
    platform: string;
    pushToken: string;
    deviceId: string | null;
    deviceModel: string | null;
    osVersion: string | null;
    userAgent: string | null;
    appVersion: string | null;
    lastIpAddress: string | null;
    lastActiveAt: string | null;
    createdAt: string;
  };
  identity: {
    userId: string;
    email: string | null;
    phone: string | null;
    status: string;
    authProvider: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    requiresAdminReview: boolean;
    isAvailable: boolean;
    createdAt: string;
    lastSeenAt: string | null;
    deletedAt: string | null;
  };
  profile: {
    displayName: string;
    bio: string | null;
    dateOfBirth: string;
    gender: string | null;
    avatarUrl: string | null;
  } | null;
  location: {
    fuzzyLat: number | null;
    fuzzyLng: number | null;
    latitude: number | null;
    longitude: number | null;
    locationAccuracy: number | null;
    locationUpdatedAt: string | null;
    isActive: boolean;
  } | null;
  verifications: Array<{
    id: string;
    type: string;
    status: string;
    provider: string;
    providerReference: string | null;
    verifiedAt: string | null;
    createdAt: string;
  }>;
  securityEvents: Array<{
    id: string;
    action: string;
    ipAddress: string | null;
    userAgent: string | null;
    platform: string | null;
    deviceModel: string | null;
    osVersion: string | null;
    appVersion: string | null;
    deviceId: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
}

function DeviceForensicModal({
  userId,
  deviceId,
  onClose,
}: {
  userId: string;
  deviceId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DeviceForensics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    adminFetch<DeviceForensics>(`/admin/users/${userId}/devices/${deviceId}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load device details'))
      .finally(() => setLoading(false));
  }, [userId, deviceId]);

  return (
    <Modal open wide title="Device forensic details" onClose={onClose}>
      {loading ? <LoadingBlock label="Loading device details…" /> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {data ? (
        <div className="space-y-6 text-sm">
          <ForensicSection title="User identity">
            <ForensicGrid>
              <ForensicField label="User ID" value={data.identity.userId} mono />
              <ForensicField label="Display name" value={data.profile?.displayName ?? '—'} />
              <ForensicField label="Email" value={data.identity.email ?? '—'} />
              <ForensicField label="Phone" value={data.identity.phone ?? '—'} />
              <ForensicField label="Status" value={data.identity.status} />
              <ForensicField label="Auth provider" value={data.identity.authProvider} />
              <ForensicField label="Email verified" value={data.identity.emailVerified ? 'Yes' : 'No'} />
              <ForensicField label="Phone verified" value={data.identity.phoneVerified ? 'Yes' : 'No'} />
              <ForensicField label="Date of birth" value={data.profile?.dateOfBirth ? formatDate(data.profile.dateOfBirth) : '—'} />
              <ForensicField label="Gender" value={data.profile?.gender ?? '—'} />
              <ForensicField label="Account created" value={formatDate(data.identity.createdAt)} />
              <ForensicField label="Last seen" value={data.identity.lastSeenAt ? formatDate(data.identity.lastSeenAt) : '—'} />
              <ForensicField label="Deleted at" value={data.identity.deletedAt ? formatDate(data.identity.deletedAt) : '—'} />
            </ForensicGrid>
          </ForensicSection>

          <ForensicSection title="Device">
            <ForensicGrid>
              <ForensicField label="Record ID" value={data.device.id} mono />
              <ForensicField label="Platform" value={data.device.platform} />
              <ForensicField label="Device model" value={data.device.deviceModel ?? '—'} />
              <ForensicField label="OS version" value={data.device.osVersion ?? '—'} />
              <ForensicField label="Hardware device ID" value={data.device.deviceId ?? '—'} mono />
              <ForensicField label="App version" value={data.device.appVersion ?? '—'} />
              <ForensicField label="Last IP address" value={data.device.lastIpAddress ?? '—'} mono />
              <ForensicField label="Registered" value={formatDate(data.device.createdAt)} />
              <ForensicField label="Last active" value={data.device.lastActiveAt ? formatDate(data.device.lastActiveAt) : '—'} />
              <ForensicField label="Push token" value={data.device.pushToken} mono full />
              <ForensicField label="User agent" value={data.device.userAgent ?? '—'} mono full />
            </ForensicGrid>
          </ForensicSection>

          {data.location ? (
            <ForensicSection title="Last known location">
              <ForensicGrid>
                <ForensicField label="Session active" value={data.location.isActive ? 'Yes' : 'No'} />
                <ForensicField label="Fuzzy coordinates" value={`${data.location.fuzzyLat ?? '—'}, ${data.location.fuzzyLng ?? '—'}`} mono />
                <ForensicField label="Precise coordinates" value={`${data.location.latitude ?? '—'}, ${data.location.longitude ?? '—'}`} mono />
                <ForensicField label="Accuracy (m)" value={data.location.locationAccuracy?.toString() ?? '—'} />
                <ForensicField label="Updated at" value={data.location.locationUpdatedAt ? formatDate(data.location.locationUpdatedAt) : '—'} />
              </ForensicGrid>
            </ForensicSection>
          ) : null}

          {data.verifications.length > 0 ? (
            <ForensicSection title="Verifications">
              <Table>
                <THead>
                  <TR>
                    <TH>Type</TH>
                    <TH>Provider</TH>
                    <TH>Status</TH>
                    <TH>Provider ref</TH>
                    <TH>Verified</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.verifications.map((v) => (
                    <TR key={v.id}>
                      <TD>{v.type}</TD>
                      <TD>{v.provider}</TD>
                      <TD><Badge>{v.status}</Badge></TD>
                      <TD className="font-mono text-xs">{v.providerReference ?? '—'}</TD>
                      <TD className="text-ink-secondary">{v.verifiedAt ? formatDate(v.verifiedAt) : '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </ForensicSection>
          ) : null}

          <ForensicSection title={`Security events (${data.securityEvents.length})`}>
            {data.securityEvents.length === 0 ? (
              <p className="text-ink-tertiary">No security events linked to this device.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Action</TH>
                    <TH>IP</TH>
                    <TH>Device</TH>
                    <TH>When</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.securityEvents.map((e) => (
                    <TR key={e.id}>
                      <TD>{e.action}</TD>
                      <TD className="font-mono text-xs">{e.ipAddress ?? '—'}</TD>
                      <TD>{e.deviceModel ?? e.deviceId ?? '—'}</TD>
                      <TD className="text-ink-secondary">{formatDate(e.createdAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </ForensicSection>

          <ForensicSection title={`Recent audit log (${data.auditLogs.length})`}>
            {data.auditLogs.length === 0 ? (
              <p className="text-ink-tertiary">No audit log entries.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Action</TH>
                    <TH>Entity</TH>
                    <TH>IP</TH>
                    <TH>When</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.auditLogs.map((log) => (
                    <TR key={log.id}>
                      <TD>{log.action}</TD>
                      <TD>{log.entityType ?? '—'}</TD>
                      <TD className="font-mono text-xs">{log.ipAddress ?? '—'}</TD>
                      <TD className="text-ink-secondary">{formatDate(log.createdAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </ForensicSection>
        </div>
      ) : null}
    </Modal>
  );
}

function ForensicSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-border pb-2 font-medium text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function ForensicGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>;
}

function ForensicField({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <dt className="text-ink-tertiary">{label}</dt>
      <dd className={`mt-0.5 break-all text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function UserSecurityTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: Array<{
      id: string;
      action: string;
      ipAddress: string | null;
      userAgent: string | null;
      platform: string | null;
      deviceModel: string | null;
      osVersion: string | null;
      appVersion: string | null;
      deviceId: string | null;
      createdAt: string;
    }>;
    total: number;
    limit: number;
  } | null>(null);

  useEffect(() => {
    adminFetch<typeof data>(`/admin/users/${userId}/security-events?page=${page}`).then(setData);
  }, [userId, page]);

  return (
    <ActivityTable
      data={data}
      page={page}
      onPageChange={setPage}
      columns={['Action', 'IP', 'Device', 'OS', 'App', 'When']}
      renderRow={(event) => (
        <TR key={event.id}>
          <TD>{event.action}</TD>
          <TD className="font-mono text-xs">{event.ipAddress ?? '—'}</TD>
          <TD>{event.deviceModel ?? event.deviceId ?? '—'}</TD>
          <TD>{event.osVersion ?? event.platform ?? '—'}</TD>
          <TD>{event.appVersion ?? '—'}</TD>
          <TD className="text-ink-secondary">{formatDate(event.createdAt)}</TD>
        </TR>
      )}
    />
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
        <h3 className="font-medium text-foreground">Blocked by this user</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {data.initiated.map((b) => (
            <li key={b.userId} className="flex justify-between">
              <Link href={`/users/${b.userId}`} className="text-accent hover:underline">{b.displayName ?? b.userId}</Link>
              <span className="text-ink-tertiary">{formatDate(b.createdAt)}</span>
            </li>
          ))}
          {data.initiated.length === 0 ? <li className="text-ink-tertiary">None</li> : null}
        </ul>
      </Card>
      <Card>
        <h3 className="font-medium text-foreground">Blocked this user</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {data.received.map((b) => (
            <li key={b.userId} className="flex justify-between">
              <Link href={`/users/${b.userId}`} className="text-accent hover:underline">{b.displayName ?? b.userId}</Link>
              <span className="text-ink-tertiary">{formatDate(b.createdAt)}</span>
            </li>
          ))}
          {data.received.length === 0 ? <li className="text-ink-tertiary">None</li> : null}
        </ul>
      </Card>
    </div>
  );
}

function UserAuditTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Array<{ id: string; action: string; entityType: string | null; ipAddress: string | null; userAgent: string | null; createdAt: string }>; total: number; limit: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    adminFetch<{ items: Array<{ id: string; action: string; entityType: string | null; ipAddress: string | null; userAgent: string | null; createdAt: string }>; total: number; limit: number }>(
      `/admin/users/${userId}/audit-logs?page=${page}`,
    )
      .then(setData)
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to load audit log');
      });
  }, [userId, page]);

  if (error) return <Card><p className="text-sm text-red-400">{error}</p></Card>;

  return (
    <ActivityTable
      data={data}
      page={page}
      onPageChange={setPage}
      columns={['Action', 'Entity', 'IP', 'User agent', 'When']}
      renderRow={(log) => (
        <TR key={log.id}>
          <TD>{log.action}</TD>
          <TD>{log.entityType ?? '—'}</TD>
          <TD className="font-mono text-xs">{log.ipAddress ?? '—'}</TD>
          <TD className="max-w-md truncate text-xs text-ink-secondary">{log.userAgent ?? '—'}</TD>
          <TD className="text-ink-secondary">{formatDate(log.createdAt)}</TD>
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
  if (!data.items.length) return <Card><p className="text-sm text-ink-tertiary">No records.</p></Card>;

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
