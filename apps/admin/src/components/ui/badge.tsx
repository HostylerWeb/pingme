import { statusColor } from '@/lib/utils';

const colors = {
  green: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  yellow: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  blue: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  red: 'bg-red-500/15 text-red-300 ring-red-500/30',
  zinc: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
  violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
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
