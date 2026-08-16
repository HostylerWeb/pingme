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
import { Pagination } from '@/components/ui/pagination';

interface ChatMessagesResponse {
  chatId: string;
  messages: Array<{
    id: string;
    content: string;
    messageType: string;
    status: string;
    createdAt: string;
    sender: { id: string; displayName: string | null };
  }>;
  total: number;
  page: number;
  limit: number;
}

export default function ChatViewerPage() {
  const params = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ChatMessagesResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminFetch<ChatMessagesResponse>(`/admin/chats/${params.id}/messages?page=${page}&limit=50`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load chat'))
      .finally(() => setLoading(false));
  }, [params.id, page]);

  if (loading && !data) return <LoadingBlock label="Loading chat…" />;

  return (
    <div>
      <PageHeader
        title="Chat viewer"
        description={`Read-only view of chat ${params.id}`}
        actions={
          <Link href="/reports">
            <Button variant="secondary">Back to reports</Button>
          </Link>
        }
      />

      {error ? <p className="mb-4 text-sm text-error">{error}</p> : null}

      <Card>
        <p className="mb-4 text-sm text-amber-300">
          Read-only moderation view. Do not share chat contents outside the moderation team.
        </p>

        {!data || data.messages.length === 0 ? (
          <p className="text-sm text-ink-tertiary">No messages in this chat.</p>
        ) : (
          <div className="space-y-3">
            {data.messages.map((message) => (
              <div key={message.id} className="rounded-lg border border-border bg-surface-muted/50 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {message.sender.displayName ?? message.sender.id}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge>{message.status}</Badge>
                    <span className="text-xs text-ink-tertiary">{formatDate(message.createdAt)}</span>
                  </div>
                </div>
                <p className="text-sm text-foreground">{message.content}</p>
              </div>
            ))}
          </div>
        )}

        {data ? (
          <Pagination page={data.page} total={data.total} limit={data.limit} onPageChange={setPage} />
        ) : null}
      </Card>
    </div>
  );
}
