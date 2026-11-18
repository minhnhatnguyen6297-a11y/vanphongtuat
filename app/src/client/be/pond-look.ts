export type PondLook = 'ink' | 'form';
const KEY = 'hng_ao_look';

export function readPondLook(): PondLook {
  try {
    if (localStorage.getItem(KEY) === 'form') return 'form';
  } catch {
    // The local choice is optional.
  }
  return 'ink';
}

export function writePondLook(look: PondLook) {
  try { localStorage.setItem(KEY, look); } catch {
    // The live renderer can still use the choice for this visit.
  }
}
