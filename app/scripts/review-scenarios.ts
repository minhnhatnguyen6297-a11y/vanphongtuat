/** Read-only review of production code using disposable in-memory fixtures.
 * Run: npx tsx scripts/review-scenarios.ts
 * Prints observed defects; does not change the LAN database.
 */
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket as RealWebSocket } from 'ws';
import { setupTestDb, makeMember } from '../tests/server/helpers.ts';
import { closeDb } from '../src/server/db.ts';
import { dispatchCommand } from '../src/server/dispatch.ts';
import { createSession, revokeSession, memberFromSession } from '../src/server/auth.ts';
import { attachWs } from '../src/server/ws.ts';
import { snapGames, snapPerms } from '../src/server/snapshots.ts';
import { state } from '../src/client/store.ts';
import { renderSanh } from '../src/client/screens/sanh.ts';
import * as clientWs from '../src/client/ws.ts';

const results: Array<{ scenario: string; defect: boolean; observed: unknown }> = [];
const db = setupTestDb();
const host = makeMember(db, { username: 'review_host', isOperator: true }).member;
const player = makeMember(db, { username: 'review_player' }).member;
function cmd(who: typeof host, name: string, args: unknown, opId = randomUUID()) {
  return dispatchCommand(db, who, { opId, name, args });
}
function record(scenario: string, defect: boolean, observed: unknown) {
  results.push({ scenario, defect, observed });
}
function createPlayingRoom() {
  const c = cmd(host, 'game.create', { kind: 'caro', title: 'Review fixture' });
  if (!c.ok) throw new Error(JSON.stringify(c));
  const id = (c.result as { id: string }).id;
  cmd(player, 'game.join', { roomId: id, as: 'play' });
  cmd(host, 'game.start', { roomId: id });
  return id;
}

try {
  const roomId = createPlayingRoom();
  state.me = player as any;
  state.games = snapGames(db).data as any;
  state.perms = snapPerms(db).data as any;
  state.ui.gameRoomId = null; // browser refresh loses selected room
  const html = renderSanh();
  const playButton = html.match(new RegExp(`<button[^>]*data-enter="${roomId}"[^>]*data-as="play"[^>]*>`))?.[0];
  record('Refresh playing game: existing player cannot select PLAY', !!playButton?.includes('disabled'), playButton);

  const leave = cmd(player, 'game.leave', { roomId });
  const rejoin = cmd(player, 'game.join', { roomId, as: 'play' });
  record('Back-to-lobby/leave during game prevents return to seat', leave.ok && !rejoin.ok,
    { leave: leave.ok, rejoin: rejoin.ok ? 'ok' : rejoin.error });

  const c = cmd(host, 'game.create', { kind: 'caro', title: 'Spectator upgrade' });
  if (!c.ok) throw new Error('create failed');
  const id = (c.result as { id: string }).id;
  cmd(player, 'game.join', { roomId: id, as: 'spectate' });
  const upgrade = cmd(player, 'game.join', { roomId: id, as: 'play' });
  record('Spectator selects PLAY in open room but remains spectator', upgrade.ok && (upgrade.result as any).seat === 'spectator', upgrade);

  const opId = randomUUID();
  const reset = cmd(host, 'admin.resetPin', { memberId: player.id }, opId);
  const replay = cmd(player, 'admin.resetPin', { memberId: player.id }, opId);
  record('Different member replays privileged opId and receives cached PIN', reset.ok && replay.ok,
    { replayAccepted: replay.ok, pinReturned: replay.ok && !!(replay.result as any).pin });

  const server = createServer();
  const hub = attachWs(server, db);
  server.on('upgrade', hub.handleUpgrade);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as any).port;
  const sid = createSession(db, player.id);
  const ws = new RealWebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { Cookie: `hng_sid=${sid}` } });
  await once(ws, 'open');
  async function socketCmd(name: string, args: unknown) {
    const opId = randomUUID();
    return await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ack timeout')), 3000);
      const receive = (raw: any) => {
        const m = JSON.parse(String(raw));
        if (m.t === 'ack' && m.opId === opId) {
          clearTimeout(timer); ws.off('message', receive); resolve(m);
        }
      };
      ws.on('message', receive);
      ws.send(JSON.stringify({ t: 'cmd', opId, name, args }));
    });
  }
  try {
    revokeSession(db, sid);
    const afterLogout = await socketCmd('member.updateProfile', { displayName: 'After logout' });
    record('Logout in another tab revokes cookie but existing socket still writes', afterLogout.ok,
      { sessionValid: !!memberFromSession(db, sid), commandAccepted: afterLogout.ok });
    db.prepare('UPDATE members SET disabled = 1 WHERE id = ?').run(player.id);
    const afterDisable = await socketCmd('member.updateProfile', { displayName: 'After disable' });
    record('Disabled account still writes through existing socket', afterDisable.ok, { commandAccepted: afterDisable.ok });
  } finally {
    ws.terminate(); hub.close(); await new Promise<void>(r => server.close(() => r()));
  }

  // Deterministic simulation of browser websocket event ordering.
  const originalTimeout = globalThis.setTimeout;
  const originalWs = globalThis.WebSocket;
  const originalLocation = globalThis.location;
  const timers: Array<() => void> = [];
  class FakeSocket {
    static OPEN = 1;
    static sockets: FakeSocket[] = [];
    readyState = 1;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onmessage: ((ev: { data: string }) => void) | null = null;
    sent: any[] = [];
    constructor(_url: string) { FakeSocket.sockets.push(this); }
    close() { this.readyState = 3; }
    send(raw: string) { this.sent.push(JSON.parse(raw)); }
  }
  try {
    globalThis.location = { protocol: 'https:', host: 'review.invalid' } as any;
    globalThis.WebSocket = FakeSocket as any;
    globalThis.setTimeout = ((fn: () => void) => { timers.push(fn); return 0; }) as any;
    state.mock = false;
    clientWs.connectWs();
    FakeSocket.sockets.at(-1)!.onclose!(); // lost connection schedules retry
    clientWs.disconnectWs(); // logout
    const before = FakeSocket.sockets.length;
    timers.shift()!(); // old retry runs after logout
    record('Queued reconnect runs after logout', FakeSocket.sockets.length > before,
      { socketsBefore: before, socketsAfter: FakeSocket.sockets.length });
    FakeSocket.sockets.at(-1)!.readyState = 3; // network drops before first account's write
    void clientWs.cmd('order.add', { tableId: 1, text: 'draft from previous account' });
    clientWs.disconnectWs(); // first account logs out before acknowledgement
    clientWs.connectWs(); // next account login
    const next = FakeSocket.sockets.at(-1)!;
    next.onopen!();
    record('Pending write survives logout and is sent under next account', next.sent.some(m => m.name === 'order.add'),
      { replayedCommands: next.sent.filter(m => m.t === 'cmd').map(m => m.name) });
  } finally {
    clientWs.disconnectWs();
    globalThis.setTimeout = originalTimeout;
    globalThis.WebSocket = originalWs;
    globalThis.location = originalLocation;
  }
  console.log(JSON.stringify(results, null, 2));
} finally { closeDb(); }
