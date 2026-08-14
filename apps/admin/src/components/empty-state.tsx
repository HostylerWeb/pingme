export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-muted/50 px-4 py-10 text-center sm:px-6 sm:py-12">
      <p className="text-base font-medium text-foreground">{title}</p>
      {description ? <p className="mt-2 text-sm text-ink-tertiary">{description}</p> : null}
    </div>
  );
}
