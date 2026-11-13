import type { Member } from '../shared/types.js';
import { state, patch } from './store.js';
import { seedMock } from './mock.js';

declare global {
  interface Window {
    __HNG_LIVE__?: boolean;
  }
}

export type LoginResult = {
  ok: boolean;
  me?: Member;
  error?: string;
  retryAfterMin?: number;
};

/** LIVE khi cùng origin HTTP(S); file:// hoặc __HNG_LIVE__=false → mock. */
export function livePreferred(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__HNG_LIVE__ === false) return false;
  if (window.__HNG_LIVE__ === true) return true;
  return location.protocol === 'http:' || location.protocol === 'https:';
}

function apiHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set('X-HNG', '1');
  return h;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const headers = apiHeaders(init?.headers);
  // Browser tự gắn Origin cho POST same-origin; gắn thêm để client không-browser cũng khớp CSRF.
  if (method !== 'GET' && method !== 'HEAD' && !headers.has('Origin')) {
    headers.set('Origin', location.origin);
  }
  return fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });
}

function asMember(raw: unknown): Member | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Partial<Member>;
  if (!m.id || !m.username) return null;
  const tierRaw = (m as { tier?: string }).tier;
  const tier =
    tierRaw === 'chu_xi' || tierRaw === 'pho_xi' || tierRaw === 'dan_den' || tierRaw === 'no_le'
      ? tierRaw
      : m.isOperator
        ? 'chu_xi'
        : 'dan_den';
  return {
    id: String(m.id),
    username: String(m.username),
    displayName: String(m.displayName || m.username),
    isOperator: !!m.isOperator || tier === 'chu_xi',
    tier,
    avatarId: (m as { avatarId?: string | null }).avatarId ?? null,
    bankBin: m.bankBin ?? null,
    bankAccount: m.bankAccount ?? null,
    bankNameDisplay: m.bankNameDisplay ?? null,
    disabled: !!m.disabled,
  };
}

export async function apiMe(): Promise<Member | null> {
  if (!livePreferred()) {
    try {
      const r = await apiFetch('/api/me');
      if (r.ok) {
        const data = (await r.json()) as { member?: Member; me?: Member };
        const me = asMember(data.member ?? data.me);
        if (me) {
          patch((s) => {
            s.mock = false;
          });
          return me;
        }
      }
    } catch {
      /* mock */
    }
    seedMock();
    return state.me;
  }
  try {
    const r = await apiFetch('/api/me');
    if (!r.ok) return null;
    const data = (await r.json()) as { member?: Member; me?: Member };
    return asMember(data.member ?? data.me);
  } catch {
    return null;
  }
}

export async function fetchLoginRoster(): Promise<{ username: string; displayName: string }[]> {
  if (!livePreferred()) {
    if (!state.members.length) seedMock();
    return state.members
      .filter((m) => !m.disabled)
      .map((m) => ({ username: m.username, displayName: m.displayName }));
  }
  try {
    const r = await apiFetch('/api/roster');
    if (r.ok) {
      return (await r.json()) as { username: string; displayName: string }[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function apiLogin(username: string, pin: string): Promise<LoginResult> {
  if (!livePreferred()) {
    seedMock();
    const me = state.members.find((m) => m.username === username);
    if (!me) return { ok: false, error: 'bad' };
    if (!/^\d{6}$/.test(pin)) return { ok: false, error: 'bad' };
    if (pin === '000000') return { ok: false, error: 'bad' };
    patch((s) => {
      s.me = me;
      s.mock = true;
    });
    return { ok: true, me };
  }
  try {
    const r = await apiFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, pin }),
    });
    const data = (await r.json().catch(() => ({}))) as {
      member?: Member;
      me?: Member;
      error?: string;
      retryAfterMin?: number;
    };
    if (!r.ok) {
      return {
        ok: false,
        error: data.error || 'bad',
        retryAfterMin: data.retryAfterMin,
      };
    }
    const me = asMember(data.member ?? data.me);
    if (!me) return { ok: false, error: 'bad' };
    patch((s) => {
      s.mock = false;
      s.me = me;
    });
    return { ok: true, me };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export async function apiLogout(): Promise<void> {
  if (state.mock) return;
  try {
    await apiFetch('/api/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
}

export async function apiAi(
  kind: 'bill' | 'menu' | 'shop',
  blob: Blob,
): Promise<{ jobId?: string; error?: string; status?: number }> {
  if (!livePreferred() || state.mock) {
    return { error: 'ai_disabled', status: 503 };
  }
  try {
    const r = await apiFetch(`/api/ai/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
    });
    if (r.status === 503) return { error: 'ai_disabled', status: 503 };
    if (r.status === 429) return { error: 'busy', status: 429 };
    if (!r.ok) return { error: 'fail', status: r.status };
    const data = (await r.json()) as { jobId: string };
    return { jobId: data.jobId };
  } catch {
    return { error: 'fail' };
  }
}
