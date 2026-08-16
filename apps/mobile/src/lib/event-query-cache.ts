import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { EventAttendingSummary, EventMineSummary, EventSummary } from './api';

type EventsPage<T> = {
  success: boolean;
  data: T[];
  meta?: { page: number; limit: number; hasMore: boolean };
};

function filterInfinitePages<T extends { id: string }>(
  old: InfiniteData<EventsPage<T>> | undefined,
  eventId: string,
) {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      data: page.data.filter((item) => item.id !== eventId),
    })),
  };
}

export function removeEventFromCaches(queryClient: QueryClient, eventId: string) {
  queryClient.removeQueries({ queryKey: ['event', eventId] });
  queryClient.removeQueries({ queryKey: ['event-comments', eventId] });

  queryClient.setQueriesData<InfiniteData<EventsPage<EventSummary>>>(
    { queryKey: ['events-nearby'] },
    (old) => filterInfinitePages(old, eventId),
  );

  queryClient.setQueriesData<InfiniteData<EventsPage<EventAttendingSummary>>>(
    { queryKey: ['events-attending'] },
    (old) => filterInfinitePages(old, eventId),
  );

  queryClient.setQueriesData<{ success: boolean; data: EventMineSummary[] }>(
    { queryKey: ['my-events'] },
    (old) =>
      old
        ? {
            ...old,
            data: old.data.filter((event) => event.id !== eventId),
          }
        : old,
  );
}
