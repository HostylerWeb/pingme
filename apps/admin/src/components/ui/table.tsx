import { HTMLAttributes } from 'react';

export function Table({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className={`min-w-full divide-y divide-zinc-800 ${className}`} {...props} />
    </div>
  );
}

export function THead({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-zinc-900/80 ${className}`} {...props} />;
}

export function TBody({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-zinc-800 bg-zinc-950/40 ${className}`} {...props} />;
}

export function TR({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`hover:bg-zinc-900/50 ${className}`} {...props} />;
}

export function TH({ className = '', ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 ${className}`}
      {...props}
    />
  );
}

export function TD({ className = '', ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 text-sm text-zinc-200 ${className}`} {...props} />;
}
