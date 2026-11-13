/** Lấy tên quán từ URL Google Maps — không fetch. */
export function parseMapsName(url: string): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const place = u.pathname.match(/\/maps\/place\/([^/]+)/);
    if (place?.[1]) {
      const name = decodeURIComponent(place[1].replace(/\+/g, ' ')).replace(/@.*$/, '').trim();
      return name || null;
    }
    const q = u.searchParams.get('q');
    if (q && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(q)) return q.trim();
  } catch {
    const m = raw.match(/\/maps\/place\/([^/]+)/);
    if (m?.[1]) {
      try {
        return decodeURIComponent(m[1].replace(/\+/g, ' ')).replace(/@.*$/, '').trim() || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}
