'use client';

import { FormEvent, useEffect, useState } from 'react';
import { adminFetch, type AdminRole } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

interface AdminItem {
  id: string;
  email: string;
  role: AdminRole;
  createdAt: string;
  actionCount: number;
  assignedReportCount: number;
}

export default function AdminsPage() {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('moderator');
  const [editRole, setEditRole] = useState<AdminRole>('moderator');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch<{ items: AdminItem[] }>('/admin/admins');
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createAdmin(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await adminFetch('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({ email, password, role }),
      });
      setOpen(false);
      setEmail('');
      setPassword('');
      setRole('moderator');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  }

  async function updateAdmin(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    try {
      await adminFetch(`/admin/admins/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(editRole ? { role: editRole } : {}),
          ...(editPassword ? { password: editPassword } : {}),
        }),
      });
      setEditOpen(false);
      setEditPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update admin');
    } finally {
      setSaving(false);
    }
  }

  async function removeAdmin(id: string) {
    if (!confirm('Delete this admin account?')) return;
    try {
      await adminFetch(`/admin/admins/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete admin');
    }
  }

  return (
    <div>
      <PageHeader
        title="Admin users"
        description="Manage moderator and support accounts"
        actions={<Button onClick={() => setOpen(true)}>Create admin</Button>}
      />

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
      {loading ? <LoadingBlock /> : null}

      {!loading && items.length === 0 ? <EmptyState title="No admin users" /> : null}

      {!loading && items.length > 0 ? (
        <Table>
          <THead>
            <TR>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Actions logged</TH>
              <TH>Assigned reports</TH>
              <TH>Created</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {items.map((admin) => (
              <TR key={admin.id}>
                <TD className="font-medium text-foreground">{admin.email}</TD>
                <TD><Badge color="violet">{admin.role}</Badge></TD>
                <TD>{admin.actionCount}</TD>
                <TD>{admin.assignedReportCount}</TD>
                <TD className="text-ink-secondary">{formatDate(admin.createdAt)}</TD>
                <TD>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditId(admin.id);
                        setEditRole(admin.role);
                        setEditPassword('');
                        setEditOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => removeAdmin(admin.id)}>
                      Delete
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : null}

      <Modal
        open={open}
        title="Create admin account"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="create-admin-form" type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <form id="create-admin-form" onSubmit={createAdmin} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <Select value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
            <option value="moderator">Moderator</option>
            <option value="support">Support</option>
            <option value="super_admin">Super admin</option>
          </Select>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        title="Edit admin account"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button form="edit-admin-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form id="edit-admin-form" onSubmit={updateAdmin} className="space-y-4">
          <Select value={editRole} onChange={(e) => setEditRole(e.target.value as AdminRole)}>
            <option value="moderator">Moderator</option>
            <option value="support">Support</option>
            <option value="super_admin">Super admin</option>
          </Select>
          <Input
            type="password"
            placeholder="New password (leave blank to keep)"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            minLength={8}
          />
        </form>
      </Modal>
    </div>
  );
}
