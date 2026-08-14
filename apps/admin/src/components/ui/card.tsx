import { HTMLAttributes } from 'react';

export function Card({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <h3 className={`text-sm font-medium text-ink-secondary ${className}`}>{children}</h3>;
}

export function CardValue({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={`mt-2 font-display text-2xl font-semibold text-foreground sm:text-3xl ${className}`}>
      {children}
    </p>
  );
}
