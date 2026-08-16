'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch, getStoredSession } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

interface ReportItem {
  id: string;
  reason: string;
  status: string;
  targetType: string;
  description: string | null;
  createdAt: string;
  assignedTo: { email: string } | null;
  reporter: { displayName: string | null };
  reportedUser: { id: string; displayName: string | null };
}

interface ReportsResponse {
  items: ReportItem[];
  total: number;
  page: number;
  limit: number;
}

export default function ReportsPage() {
  const [status, setStatus] = useState('open');
  const [reason, setReason] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      if (reason) params.set('reason', reason);
      if (assignedToMe) {
        const session = getStoredSession();
        if (session?.admin.id) params.set('assignedTo', session.admin.id);
      }
      const result = await adminFetch<ReportsResponse>(`/admin/reports?${params}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [assignedToMe, page, reason, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function exportCsv() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const session = getStoredSession();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1'}/admin/reports/export?${params}`,
      { headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {} },
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reports.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function bulkAssign() {
    if (!selectedIds.length) return;
    setBulkLoading(true);
    try {
      await adminFetch('/admin/reports/bulk/assign', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk assign failed');
    } finally {
      setBulkLoading(false);
    }
  }

  async function bulkResolve(status: 'resolved' | 'dismissed') {
    if (!selectedIds.length) return;
    setBulkLoading(true);
    try {
      await adminFetch('/admin/reports/bulk', {
        method: 'PATCH',
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      setSelectedIds([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Review, assign, and resolve user reports"
        actions={<Button variant="secondary" onClick={exportCsv}>Export CSV</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="reviewing">Reviewing</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </Select>
        <Select value={reason} onChange={(e) => { setPage(1); setReason(e.target.value); }}>
          <option value="">All reasons</option>
          <option value="harassment">Harassment</option>
          <option value="spam">Spam</option>
          <option value="inappropriate">Inappropriate</option>
          <option value="underage">Underage</option>
          <option value="other">Other</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input type="checkbox" checked={assignedToMe} onChange={(e) => { setPage(1); setAssignedToMe(e.target.checked); }} />
          Assigned to me
        </label>
        <Button variant="secondary" onClick={() => load()}>Refresh</Button>
        {selectedIds.length > 0 ? (
          <>
            <Button variant="secondary" disabled={bulkLoading} onClick={() => void bulkAssign()}>
              Assign selected ({selectedIds.length})
            </Button>
            <Button variant="secondary" disabled={bulkLoading} onClick={() => void bulkResolve('resolved')}>
              Resolve selected
            </Button>
            <Button variant="secondary" disabled={bulkLoading} onClick={() => void bulkResolve('dismissed')}>
              Dismiss selected
            </Button>
          </>
        ) : null}
      </div>

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
      {loading ? <LoadingBlock /> : null}

      {!loading && data?.items.length === 0 ? (
        <EmptyState title="No reports found" description="Try changing your filters." />
      ) : null}

      {!loading && data && data.items.length > 0 ? (
        <>
          <Table>
            <THead>
              <TR>
                <TH />
                <TH>Report</TH>
                <TH>Target</TH>
                <TH>Status</TH>
                <TH>Assigned</TH>
                <TH>Created</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {data.items.map((report) => (
                <TR key={report.id}>
                  <TD>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(report.id)}
                      onChange={() => toggleSelected(report.id)}
                      aria-label={`Select report ${report.id}`}
                    />
                  </TD>
                  <TD>
                    <p className="font-medium text-foreground">{report.reason}</p>
                    <p className="text-xs text-ink-tertiary">
                      by {report.reporter.displayName ?? 'Unknown'} against{' '}
                      {report.reportedUser.displayName ?? 'Unknown'}
                    </p>
                    {report.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-secondary">{report.description}</p>
                    ) : null}
                  </TD>
                  <TD><Badge color="violet">{report.targetType}</Badge></TD>
                  <TD><Badge>{report.status}</Badge></TD>
                  <TD className="text-ink-secondary">{report.assignedTo?.email ?? '—'}</TD>
                  <TD className="text-ink-secondary">{formatDate(report.createdAt)}</TD>
                  <TD>
                    <Link href={`/reports/${report.id}`}>
                      <Button variant="secondary">Review</Button>
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
