'use client';

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
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

type Tab = 'posts' | 'replies';

interface PostItem {
  id: string;
  content: string;
  status: string;
  replyCount: number;
  authorDisplayName: string | null;
  createdAt: string;
}

interface ReplyItem {
  id: string;
  content: string;
  status: string;
  postContent: string;
  authorDisplayName: string | null;
  createdAt: string;
}

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>('posts');
  const [status, setStatus] = useState('active');
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<{ items: PostItem[]; total: number; limit: number } | null>(null);
  const [replies, setReplies] = useState<{ items: ReplyItem[]; total: number; limit: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      if (userId.trim()) params.set('userId', userId.trim());
      if (tab === 'posts') {
        const data = await adminFetch<{ items: PostItem[]; total: number; limit: number }>(
          `/admin/wall/posts?${params}`,
        );
        setPosts(data);
      } else {
        const data = await adminFetch<{ items: ReplyItem[]; total: number; limit: number }>(
          `/admin/wall/replies?${params}`,
        );
        setReplies(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [page, status, tab, userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(
    id: string,
    type: 'post' | 'reply',
    action: 'delete' | 'hide' | 'restore',
  ) {
    setActionId(id);
    try {
      const path =
        action === 'delete'
          ? `/admin/wall/${type === 'post' ? 'posts' : 'replies'}/${id}`
          : action === 'hide'
            ? `/admin/wall/${type === 'post' ? 'posts' : 'replies'}/${id}/hide`
            : `/admin/wall/${type === 'post' ? 'posts' : 'replies'}/${id}/restore`;
      const method = action === 'delete' ? 'DELETE' : 'PATCH';
      await adminFetch(path, { method });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }

  const current = tab === 'posts' ? posts : replies;

  return (
    <div>
      <PageHeader title="Content moderation" description="Review and remove wall posts and replies" />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex rounded-lg border border-zinc-800 p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${tab === 'posts' ? 'bg-violet-600 text-white' : 'text-zinc-400'}`}
            onClick={() => { setTab('posts'); setPage(1); }}
          >
            Posts
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${tab === 'replies' ? 'bg-violet-600 text-white' : 'text-zinc-400'}`}
            onClick={() => { setTab('replies'); setPage(1); }}
          >
            Replies
          </button>
        </div>
        <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="hidden">Hidden</option>
          <option value="deleted">Deleted</option>
          <option value="moderated">Moderated</option>
        </Select>
        <Input
          placeholder="Filter by user ID"
          value={userId}
          onChange={(e) => { setPage(1); setUserId(e.target.value); }}
          className="min-w-[280px]"
        />
      </div>

      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
      {loading ? <LoadingBlock /> : null}

      {!loading && current?.items.length === 0 ? <EmptyState title="No content found" /> : null}

      {!loading && current && current.items.length > 0 ? (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Content</TH>
                <TH>Author</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {tab === 'posts'
                ? posts!.items.map((post) => (
                    <TR key={post.id}>
                      <TD>
                        <p className="max-w-xl text-white">{post.content}</p>
                        <p className="mt-1 text-xs text-zinc-500">{post.replyCount} replies</p>
                      </TD>
                      <TD>{post.authorDisplayName ?? '—'}</TD>
                      <TD><Badge>{post.status}</Badge></TD>
                      <TD className="text-zinc-400">{formatDate(post.createdAt)}</TD>
                      <TD>
                        <div className="flex gap-2">
                          {post.status !== 'active' ? (
                            <Button variant="secondary" disabled={actionId === post.id} onClick={() => moderate(post.id, 'post', 'restore')}>
                              Restore
                            </Button>
                          ) : null}
                          <Button
                            variant="secondary"
                            disabled={actionId === post.id}
                            onClick={() => moderate(post.id, 'post', 'hide')}
                          >
                            Hide
                          </Button>
                          <Button
                            variant="danger"
                            disabled={actionId === post.id}
                            onClick={() => moderate(post.id, 'post', 'delete')}
                          >
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))
                : replies!.items.map((reply) => (
                    <TR key={reply.id}>
                      <TD>
                        <p className="max-w-xl text-white">{reply.content}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-zinc-500">On: {reply.postContent}</p>
                      </TD>
                      <TD>{reply.authorDisplayName ?? '—'}</TD>
                      <TD><Badge>{reply.status}</Badge></TD>
                      <TD className="text-zinc-400">{formatDate(reply.createdAt)}</TD>
                      <TD>
                        <div className="flex gap-2">
                          {reply.status !== 'active' ? (
                            <Button variant="secondary" disabled={actionId === reply.id} onClick={() => moderate(reply.id, 'reply', 'restore')}>
                              Restore
                            </Button>
                          ) : null}
                          <Button
                            variant="secondary"
                            disabled={actionId === reply.id}
                            onClick={() => moderate(reply.id, 'reply', 'hide')}
                          >
                            Hide
                          </Button>
                          <Button
                            variant="danger"
                            disabled={actionId === reply.id}
                            onClick={() => moderate(reply.id, 'reply', 'delete')}
                          >
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
            </TBody>
          </Table>
          <Pagination page={page} total={current.total} limit={current.limit} onPageChange={setPage} />
        </>
      ) : null}
    </div>
  );
}
