export function formatDate(value: string | Date) {
  return new Date(value).toLocaleString();
}

export function formatRelative(value: string | Date) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function statusColor(status: string) {
  switch (status) {
    case 'active':
    case 'resolved':
    case 'passed':
      return 'green';
    case 'open':
    case 'pending':
      return 'yellow';
    case 'reviewing':
      return 'blue';
    case 'suspended':
    case 'failed':
      return 'red';
    case 'dismissed':
    case 'deleted':
    case 'hidden':
      return 'zinc';
    default:
      return 'zinc';
  }
}
