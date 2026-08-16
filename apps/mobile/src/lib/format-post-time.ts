function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** e.g. "Today - 3:45 PM", "Yesterday - 9:12 AM" */
export function formatWallPostTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const timeLabel = formatTime(date);
  const dayDiff = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dayDiff === 0) {
    return `Today - ${timeLabel}`;
  }
  if (dayDiff === 1) {
    return `Yesterday - ${timeLabel}`;
  }

  const dateLabel = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${dateLabel} - ${timeLabel}`;
}
