export function formatEventDateRange(startsAt: Date | string, endsAt: Date | string): string {
  const start = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  const end = typeof endsAt === 'string' ? new Date(endsAt) : endsAt;

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };

  const datePart = start.toLocaleDateString(undefined, dateOpts);
  const startTime = start.toLocaleTimeString(undefined, timeOpts);
  const endTime = end.toLocaleTimeString(undefined, timeOpts);

  if (sameDay) {
    return `${datePart} · ${startTime} – ${endTime}`;
  }

  const endDatePart = end.toLocaleDateString(undefined, dateOpts);
  return `${datePart} ${startTime} – ${endDatePart} ${endTime}`;
}

export function formatEventListDate(startsAt: Date | string): string {
  const start = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  return start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
