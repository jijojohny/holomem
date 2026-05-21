'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiKey } from './api';

export function useRequireAuth() {
  const router = useRouter();
  useEffect(() => {
    if (!getApiKey()) router.replace('/login');
  }, [router]);
}

export function useRedirectIfAuthed() {
  const router = useRouter();
  useEffect(() => {
    if (getApiKey()) router.replace('/dashboard');
  }, [router]);
}
