import { statusColor } from '@/lib/utils';

const colors = {
  green: 'bg-online-soft text-online ring-online/30',
  yellow: 'bg-warning-soft text-warning ring-warning/30',
  blue: 'bg-accent-soft text-accent ring-accent/30',
  red: 'bg-error-container text-error ring-error/30',
  zinc: 'bg-surface-muted text-ink-secondary ring-border',
  violet: 'bg-premium-soft text-premium ring-premium/30',
};

export function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: keyof typeof colors;
}) {
  const resolved = color ?? statusColor(String(children));
  const className = colors[resolved as keyof typeof colors] ?? colors.zinc;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}
