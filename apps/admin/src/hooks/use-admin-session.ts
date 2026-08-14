'use client';

import { useEffect, useState } from 'react';
import { getStoredSession, type AdminSession } from '@/lib/api';

export function useAdminSession() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSession(getStoredSession());
    setMounted(true);
  }, []);

  return { session, mounted };
}
