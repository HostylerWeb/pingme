export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-surface-muted/50 px-4 py-12 sm:py-16">
      <p className="text-sm text-ink-secondary">{label}</p>
    </div>
  );
}
