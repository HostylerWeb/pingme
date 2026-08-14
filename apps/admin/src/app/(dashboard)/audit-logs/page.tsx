'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Tabs } from '@/components/tabs';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

export default function AuditLogsPage() {
  const [tab, setTab] = useState<'admin' | 'user'>('admin');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Array<Record<string, unknown>>; total: number; limit: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (action.trim()) params.set('action', action.trim());
      if (entityType.trim()) params.set('entityType', entityType.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (tab === 'user' && userId.trim()) params.set('userId', userId.trim());

      const path = tab === 'admin' ? '/admin/audit-logs/admin' : '/admin/audit-logs/user';
      const result = await adminFetch<typeof data>(`${path}?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [action, entityType, from, page, tab, to, userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Audit logs" description="Admin actions and user activity history" />

      <Tabs
        tabs={[
          { id: 'admin', label: 'Admin actions' },
          { id: 'user', label: 'User activity' },
        ]}
        active={tab}
        onChange={(id) => { setPage(1); setTab(id as 'admin' | 'user'); }}
      />

      <form className="mb-4 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
        <Input placeholder="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} className="min-w-[200px]" />
        <Input placeholder="Entity type" value={entityType} onChange={(e) => setEntityType(e.target.value)} className="min-w-[140px]" />
        {tab === 'user' ? (
          <Input placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} className="min-w-[280px]" />
        ) : null}
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button type="submit">Search</Button>
      </form>

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
      {loading ? <LoadingBlock /> : null}

      {!loading && data?.items.length === 0 ? <EmptyState title="No audit logs found" /> : null}

      {!loading && data && data.items.length > 0 ? (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Action</TH>
                {tab === 'admin' ? <TH>Admin</TH> : <TH>User ID</TH>}
                <TH>Entity</TH>
                <TH>When</TH>
              </TR>
            </THead>
            <TBody>
              {data.items.map((log) => (
                <TR key={String(log.id)}>
                  <TD className="font-medium text-white">{String(log.action)}</TD>
                  <TD>
                    {tab === 'admin' ? (
                      <>
                        <p>{(log.adminUser as { email?: string })?.email}</p>
                        <Badge color="violet">{(log.adminUser as { role?: string })?.role}</Badge>
                      </>
                    ) : (
                      <span className="font-mono text-xs">{String(log.userId ?? '—')}</span>
                    )}
                  </TD>
                  <TD className="text-zinc-400">
                    {String(log.entityType ?? '—')}
                    {log.entityId ? <span className="block text-xs">{String(log.entityId)}</span> : null}
                  </TD>
                  <TD className="text-zinc-400">{formatDate(String(log.createdAt))}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} total={data.total} limit={data.limit} onPageChange={setPage} />
        </>
      ) : null}
    </div>
  );
}
