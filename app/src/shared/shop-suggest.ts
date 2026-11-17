export type ShopSource = { name: string; type: string };

export type ShopSuggestion = {
  name: string | null;
  type: 'no' | 'vat' | 'uong' | null;
  uncertain: boolean;
};

const TYPES = new Set(['no', 'vat', 'uong']);

function norm(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

/**
 * Chỉ nhận tên có trong nguồn đã biết hoặc trong chữ người dùng đưa.
 * Không giữ địa chỉ. Tên model bịa ra thì bỏ.
 */
export function acceptShopSuggestion(
  raw: { name?: string | null; type?: string | null },
  sources: ShopSource[],
  note: string,
): ShopSuggestion {
  const name = String(raw.name || '').trim();
  if (!name) return { name: null, type: null, uncertain: true };
  const key = norm(name);
  const hit = sources.find((s) => norm(s.name) === key);
  if (hit) {
    const type = TYPES.has(hit.type) ? (hit.type as ShopSuggestion['type']) : null;
    return { name: hit.name, type, uncertain: false };
  }
  const noteKey = norm(note);
  if (key.length >= 2 && noteKey.includes(key)) {
    const type = raw.type && TYPES.has(raw.type) ? (raw.type as ShopSuggestion['type']) : null;
    return { name: name.slice(0, 120), type, uncertain: true };
  }
  return { name: null, type: null, uncertain: true };
}
