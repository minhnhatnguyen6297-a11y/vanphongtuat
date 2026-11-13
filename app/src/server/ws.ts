import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Db } from './db.ts';
import { getSessionId, memberFromSession } from './auth.ts';
import { config } from './config.ts';
import { buildSnap } from './snapshots.ts';
import { dispatchCommand } from './dispatch.ts';
import type { ScopeName } from '../shared/types.ts';
import type { AuthMember } from './perms.ts';
import { canAccessChatScope, chatSubKey, parseChatSub } from './commands/chat.ts';
import type { ChatEvent } from './commands/types.ts';

type Client = {
  ws: WebSocket;
  member: AuthMember;
  subs: Set<ScopeName>;
  alive: boolean;
};

const HEARTBEAT_MS = 20_000;

export type WsHub = {
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
  broadcastScopes: (scopes: ScopeName[]) => void;
  broadcastChat: (event: ChatEvent) => void;
  sendToMember: (memberId: string, msg: unknown) => void;
  close: () => void;
};

export function attachWs(_server: HttpServer, db: Db): WsHub {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<Client>();

  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) {
        c.ws.terminate();
        clients.delete(c);
        continue;
      }
      c.alive = false;
      if (c.ws.readyState === WebSocket.OPEN) c.ws.ping();
    }
  }, HEARTBEAT_MS);

  function send(ws: WebSocket, msg: unknown) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  function filterSubs(member: AuthMember, raw: ScopeName[]): ScopeName[] {
    const out: ScopeName[] = [];
    for (const s of raw) {
      if (s.startsWith('chat:')) {
        const inner = parseChatSub(s);
        if (!inner || !canAccessChatScope(db, member, inner)) continue;
        out.push(chatSubKey(inner));
        continue;
      }
      out.push(s);
    }
    return out;
  }

  function broadcastScopes(scopes: ScopeName[]) {
    const toSend = new Set<ScopeName>();
    for (const s of scopes) {
      toSend.add(s);
      if (s.startsWith('table:')) toSend.add('table:current');
    }
    for (const scope of toSend) {
      const snap = buildSnap(db, scope);
      if (!snap) continue;
      const msg = { t: 'snap' as const, ...snap };
      for (const c of clients) {
        if (c.subs.has(scope)) send(c.ws, msg);
      }
    }
  }

  function broadcastChat(event: ChatEvent) {
    const sub = chatSubKey(event.scope);
    for (const c of clients) {
      if (!c.subs.has(sub)) continue;
      // Re-check ACL — stale sub after game.leave must not receive
      if (!canAccessChatScope(db, c.member, event.scope)) {
        c.subs.delete(sub);
        continue;
      }
      send(c.ws, event);
    }
  }

  function sendToMember(memberId: string, msg: unknown) {
    for (const c of clients) {
      if (c.member.id === memberId) send(c.ws, msg);
    }
  }

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, member: AuthMember) => {
    const client: Client = { ws, member, subs: new Set(), alive: true };
    clients.add(client);

    ws.on('pong', () => {
      client.alive = true;
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      let msg: any;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        send(ws, { t: 'error', error: 'bad_json' });
        return;
      }

      if (msg?.t === 'hello') {
        const rawSubs = Array.isArray(msg.subs) ? (msg.subs as ScopeName[]) : [];
        client.subs = new Set(filterSubs(member, rawSubs));
        for (const scope of client.subs) {
          const snap = buildSnap(db, scope);
          if (snap) send(ws, { t: 'snap', ...snap });
        }
        return;
      }

      if (msg?.t === 'cmd') {
        const ack = dispatchCommand(db, client.member, {
          opId: msg.opId,
          name: msg.name,
          args: msg.args,
          baseVersion: msg.baseVersion,
        });
        send(ws, ack);
        if (ack.ok && 'events' in ack && ack.events) {
          for (const ev of ack.events) broadcastChat(ev);
        }
        if (ack.ok && 'scopes' in ack && ack.scopes) {
          broadcastScopes(ack.scopes);
        }
        return;
      }

      if (msg?.t === 'ping') {
        send(ws, { t: 'pong', ts: Date.now() });
        return;
      }
    });

    ws.on('close', () => {
      clients.delete(client);
    });
  });

  function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const origin = req.headers.origin;
    if (origin && origin !== config.origin) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    const sid = getSessionId(req);
    const member = memberFromSession(db, sid);
    if (!member) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, member);
    });
  }

  return {
    handleUpgrade,
    broadcastScopes,
    broadcastChat,
    sendToMember,
    close: () => {
      clearInterval(heartbeat);
      for (const c of clients) c.ws.close();
      wss.close();
    },
  };
}
