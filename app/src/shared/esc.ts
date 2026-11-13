export function esc(str: unknown): string {
  return String(str ?? '').replace(/[&<>"']/g, (s) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]!,
  );
}

export function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function fmtVnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN') + 'đ';
}

export function fmtK(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '?';
  if (n % 1000 === 0) return n / 1000 + 'k';
  return fmtVnd(n);
}
