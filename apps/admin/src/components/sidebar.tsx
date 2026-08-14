'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearSession, type AdminRole } from '@/lib/api';
import { useAdminSession } from '@/hooks/use-admin-session';

const navItems: Array<{
  href: string;
  label: string;
  roles?: AdminRole[];
}> = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reports', label: 'Reports', roles: ['moderator', 'super_admin'] },
  { href: '/users', label: 'Users' },
  { href: '/content', label: 'Content', roles: ['moderator', 'super_admin'] },
  { href: '/map', label: 'Live map', roles: ['moderator', 'super_admin'] },
  { href: '/audit-logs', label: 'Audit logs', roles: ['moderator', 'super_admin'] },
  { href: '/admins', label: 'Admin users', roles: ['super_admin'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { session, mounted } = useAdminSession();

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!mounted) return false;
    return session?.admin.role && item.roles.includes(session.admin.role);
  });

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-5 py-6">
        <p className="text-lg font-semibold text-white">PingMe Admin</p>
        <p className="mt-1 truncate text-xs text-zinc-500">
          {mounted ? session?.admin.email : '\u00a0'}
        </p>
        <p className="mt-0.5 text-xs capitalize text-violet-400">
          {mounted ? session?.admin.role?.replace('_', ' ') : '\u00a0'}
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? 'bg-violet-600/20 text-violet-300'
                  : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <button
          type="button"
          onClick={() => {
            clearSession();
            window.location.href = '/login';
          }}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
