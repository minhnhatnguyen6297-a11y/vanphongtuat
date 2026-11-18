/** Ao cá V3 worker entry → public/ao-ca-worker.js (P0 stub; P2 fills preprocess). */
const scope = self as unknown as {
  onmessage: ((ev: MessageEvent<{ type?: string }>) => void) | null;
  postMessage: (data: unknown) => void;
};
scope.onmessage = (ev) => {
  const type = ev.data?.type;
  if (type === 'ping') scope.postMessage({ type: 'pong' });
};

export {};
