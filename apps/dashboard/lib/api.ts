const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hm_api_key');
}

export function setApiKey(key: string): void {
  localStorage.setItem('hm_api_key', key);
}

export function clearApiKey(): void {
  localStorage.removeItem('hm_api_key');
}

async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const key = getApiKey();
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(opts.headers as Record<string, string> | undefined),
    },
  });
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 401) throw new AuthError();
  if (res.status === 204) return null as T;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `API ${res.status}`);
  return json as T;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: 'DELETE' });
  if (res.status === 401) throw new AuthError();
  if (!res.ok && res.status !== 404) throw new Error(`API ${res.status}`);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
  if (res.status === 401) throw new AuthError();
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `API ${res.status}`);
  return json as T;
}

export class AuthError extends Error {
  constructor() { super('Not authenticated'); }
}

// ── typed helpers ────────────────────────────────────────────────────────────

export interface Usage {
  tier: string;
  writes: { used: number; limit: number | null; remaining: number | null; resets_at: string };
  reads: { this_month: number };
  memories: { active: number };
}

export interface ApiKey {
  id: string;
  prefix: string;
  env: string;
  tier: string;
  created_at: string;
  active: boolean;
}

export interface Session {
  session_id: string;
  memory_count: number;
  last_activity: string;
}

export interface MemoryEntry {
  entity_key: string;
  session_id: string;
  agent_id: string | null;
  ttl_tier: 'working' | 'episodic' | 'persistent';
  created_at: string;
  expires_at: string;
  pinned: boolean;
}

export interface DayUsage {
  day: string;
  writes: number;
}

export interface Account {
  email: string;
  created_at: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  last_status: number | null;
  last_delivered_at: string | null;
}

export interface WebhookDelivery {
  id: string;
  event_type: string;
  status_code: number | null;
  error: string | null;
  created_at: string;
}

export interface ActivityEvent {
  event_type: string;
  session_id: string | null;
  entity_key: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  role: string;
  created_at: string;
}

export interface TeamMember {
  customer_id: string;
  email: string;
  role: string;
  joined_at: string;
}
