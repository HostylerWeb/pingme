'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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

interface UserItem {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  livenessVerified: boolean;
  displayName: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

interface UsersResponse {
  items: UserItem[];
  total: number;
  page: number;
  limit: number;
}

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (search = query) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) params.set('q', search.trim());
      if (status) params.set('status', status);
      const result = await adminFetch<UsersResponse>(`/admin/users?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Users" description="Search accounts, review verification, and manage status" />

      <form
        className="mb-4 flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load();
        }}
      >
        <Input
          className="min-w-[240px] flex-1"
          placeholder="Search email, phone, or display name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending_verification">Pending verification</option>
          <option value="deleted">Deleted</option>
        </Select>
        <Button type="submit">Search</Button>
      </form>

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
      {loading ? <LoadingBlock /> : null}

      {!loading && data?.items.length === 0 ? (
        <EmptyState title="No users found" />
      ) : null}

      {!loading && data && data.items.length > 0 ? (
        <>
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Contact</TH>
                <TH>Verified</TH>
                <TH>Status</TH>
                <TH>Joined</TH>
                <TH>Last seen</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {data.items.map((user) => (
                <TR key={user.id}>
                  <TD>
                    <p className="font-medium text-foreground">{user.displayName ?? 'No name'}</p>
                    <p className="text-xs text-ink-tertiary">{user.id}</p>
                  </TD>
                  <TD className="text-ink-secondary">
                    {user.email ?? user.phone ?? '—'}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {user.emailVerified ? <Badge color="green">email</Badge> : null}
                      {user.phoneVerified ? <Badge color="green">phone</Badge> : null}
                      {user.livenessVerified ? <Badge color="green">liveness</Badge> : <Badge color="yellow">no liveness</Badge>}
                    </div>
                  </TD>
                  <TD><Badge>{user.status}</Badge></TD>
                  <TD className="text-ink-secondary">{formatDate(user.createdAt)}</TD>
                  <TD className="text-ink-secondary">
                    {user.lastSeenAt ? formatDate(user.lastSeenAt) : '—'}
                  </TD>
                  <TD>
                    <Link href={`/users/${user.id}`}>
                      <Button variant="secondary">View</Button>
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={data.page} total={data.total} limit={data.limit} onPageChange={setPage} />
        </>
      ) : null}
    </div>
  );
}
