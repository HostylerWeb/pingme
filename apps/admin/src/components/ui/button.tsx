import { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

const variants = {
  primary: 'bg-accent text-on-accent hover:bg-accent/90 shadow-sm',
  secondary:
    'bg-surface-muted text-foreground hover:bg-surface-elevated border border-border',
  ghost: 'bg-transparent text-ink-secondary hover:bg-surface-muted hover:text-foreground',
  danger: 'bg-error-container text-error hover:bg-error-container/80 border border-error/30',
};

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
