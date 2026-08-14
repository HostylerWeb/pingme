'use client';

import { Button } from './button';

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className={`relative z-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl ${wide ? 'max-w-4xl max-h-[85vh] overflow-y-auto' : 'max-w-lg'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <Button variant="ghost" onClick={onClose} className="px-2 py-1">
            ✕
          </Button>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
