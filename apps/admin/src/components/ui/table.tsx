import { HTMLAttributes } from 'react';

export function Table({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-scroll overflow-hidden rounded-2xl border border-border">
      <table className={`min-w-full divide-y divide-divider ${className}`} {...props} />
    </div>
  );
}

export function THead({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-surface-muted ${className}`} {...props} />;
}

export function TBody({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`divide-y divide-divider bg-surface/40 ${className}`} {...props} />;
}

export function TR({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`hover:bg-surface-muted/60 ${className}`} {...props} />;
}

export function TH({ className = '', ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary sm:px-4 ${className}`}
      {...props}
    />
  );
}

export function TD({ className = '', ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`whitespace-nowrap px-3 py-3 text-sm text-foreground sm:px-4 ${className}`} {...props} />
  );
}
