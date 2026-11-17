/** One socket is one tab. A member stays present while any tab is open. */
export type Presence = {
  connect(memberId: string, connId: string): void;
  disconnect(memberId: string, connId: string): void;
  has(memberId: string): boolean;
  members(): Set<string>;
};

export function createPresence(): Presence {
  const tabs = new Map<string, Set<string>>();
  return {
    connect(memberId, connId) {
      let set = tabs.get(memberId);
      if (!set) {
        set = new Set();
        tabs.set(memberId, set);
      }
      set.add(connId);
    },
    disconnect(memberId, connId) {
      const set = tabs.get(memberId);
      if (!set) return;
      set.delete(connId);
      if (set.size === 0) tabs.delete(memberId);
    },
    has(memberId) {
      return (tabs.get(memberId)?.size ?? 0) > 0;
    },
    members() {
      return new Set(tabs.keys());
    },
  };
}
