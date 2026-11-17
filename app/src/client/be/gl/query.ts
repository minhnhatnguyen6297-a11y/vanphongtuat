/** Query string after `#/chat?...` (hash routing). */
export function hashQuery(hash = location.hash): URLSearchParams {
  const raw = hash.replace(/^#\/?/, '');
  const i = raw.indexOf('?');
  return new URLSearchParams(i >= 0 ? raw.slice(i + 1) : '');
}

export function wantsAoCaGl(q = hashQuery()): boolean {
  return q.has('bench') || q.get('perf') === '1';
}
