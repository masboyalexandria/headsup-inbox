import type { IncomingMessage } from './demo-data';

/**
 * Klien backend HeadsUp Inbox (server/). Base URL:
 * - dev/preview: relatif '' — Vite mem-proxy /api ke 127.0.0.1:8787.
 * - build mandiri: set VITE_API_BASE saat build bila backend di host lain.
 * Semua kegagalan jaringan → null/false; pemanggil jatuh ke data demo lokal.
 */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export interface BackendDigest {
  mode: string;
  engine: string;
  messages: IncomingMessage[];
}

export async function fetchBackendDigest(timeoutMs = 2500): Promise<BackendDigest | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/api/digest`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as BackendDigest;
    if (!Array.isArray(data.messages) || data.messages.length === 0) return null;
    console.log(`[HeadsUp] backend digest: ${data.messages.length} pesan (mode ${data.mode}, engine ${data.engine})`);
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendDraftViaBackend(id: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, text }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return data?.ok === true;
  } catch {
    return false;
  }
}
