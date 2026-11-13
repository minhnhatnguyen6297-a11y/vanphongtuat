import type { RouteId } from './store.js';
import { state, notify } from './store.js';

const ROUTES: RouteId[] = ['home', 'ban', 'quay', 'tien', 'so', 'kho', 'quyen', 'sanh'];

export function parseHash(hash = location.hash): RouteId {
  const m = hash.replace(/^#\/?/, '').split(/[/?#]/)[0];
  if (!m || m === '') return 'home';
  if (ROUTES.includes(m as RouteId)) return m as RouteId;
  return 'home';
}

export function setRoute(id: RouteId): void {
  if (location.hash !== `#/${id}`) location.hash = `#/${id}`;
  if (state.route !== id) {
    state.route = id;
    notify();
  }
}

export function startRouter(): void {
  const sync = () => {
    const id = parseHash();
    if (state.route !== id) {
      state.route = id;
      notify();
    }
    if (!location.hash || location.hash === '#') {
      history.replaceState(null, '', `#/${id}`);
    }
  };
  window.addEventListener('hashchange', sync);
  sync();
}
