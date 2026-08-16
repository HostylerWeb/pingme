'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearSession, type AdminRole } from '@/lib/api';
import { useAdminSession } from '@/hooks/use-admin-session';
import { ThemeToggle } from '@/components/theme-toggle';

const navItems: Array<{
  href: string;
  label: string;
  roles?: AdminRole[];
}> = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reports', label: 'Reports', roles: ['moderator', 'super_admin'] },
  { href: '/users', label: 'Users' },
  { href: '/content', label: 'Content', roles: ['moderator', 'super_admin'] },
  { href: '/events', label: 'Events', roles: ['moderator', 'super_admin'] },
  { href: '/map', label: 'Live map', roles: ['moderator', 'super_admin'] },
  { href: '/audit-logs', label: 'Audit logs', roles: ['moderator', 'super_admin'] },
  { href: '/admins', label: 'Admin users', roles: ['super_admin'] },
];

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { session, mounted } = useAdminSession();

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!mounted) return false;
    return session?.admin.role && item.roles.includes(session.admin.role);
  });

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-64 lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              <p className="font-display text-lg font-semibold text-foreground">PingMe Admin</p>
            </div>
            <p className="mt-2 truncate text-xs text-ink-tertiary">
              {mounted ? session?.admin.email : '\u00a0'}
            </p>
            <p className="mt-0.5 text-xs capitalize text-accent">
              {mounted ? session?.admin.role?.replace('_', ' ') : '\u00a0'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-muted lg:hidden"
          >
            ✕
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink-secondary hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => {
            clearSession();
            window.location.href = '/login';
          }}
          className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-ink-secondary transition hover:bg-surface-muted hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
