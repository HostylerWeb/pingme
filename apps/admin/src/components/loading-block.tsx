export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-16">
      <p className="text-sm text-zinc-400">{label}</p>
    </div>
  );
}
