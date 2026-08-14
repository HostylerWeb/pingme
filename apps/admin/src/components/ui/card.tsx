import { HTMLAttributes } from 'react';

export function Card({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm ${className}`}
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
  return <h3 className={`text-sm font-medium text-zinc-400 ${className}`}>{children}</h3>;
}

export function CardValue({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <p className={`mt-2 text-3xl font-semibold text-zinc-50 ${className}`}>{children}</p>;
}
