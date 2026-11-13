import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb } from '../../src/server/db.ts';
import { dispatchCommand } from '../../src/server/dispatch.ts';
import { setupTestDb, makeMember, makeShop } from './helpers.ts';
import {
  canAccessChatScope,
  chatSubKey,
  loadChatSnap,
  resetChatRateLimit,
  type ChatEvent,
} from '../../src/server/commands/chat.ts';
import { LOBBY_CHAT_SCOPE } from '../../src/shared/chat.ts';
import { buildSnap } from '../../src/server/snapshots.ts';

describe('chat scope ACL + fanout', () => {
  let db: ReturnType<typeof setupTestDb>;
  let chu: ReturnType<typeof makeMember>;
  let dan: ReturnType<typeof makeMember>;
  let nole: ReturnType<typeof makeMember>;
  let wheelA: string;
  let wheelB: string;
  let tableId: number;

  beforeEach(() => {
    resetChatRateLimit();
    db = setupTestDb();
    chu = makeMember(db, { username: 'chu', pin: '111111', tier: 'chu_xi' });
    dan = makeMember(db, { username: 'dan', pin: '222222', tier: 'dan_den' });
    nole = makeMember(db, { username: 'nole', pin: '333333', tier: 'no_le' });
    makeShop(db, 'shop1', 'Quán A', chu.id);
    makeShop(db, 'shop2', 'Quán B', chu.id);

    const created = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'table.create',
      args: { shopIds: ['shop1', 'shop2'] },
    });
    assert.equal(created.ok, true);
    tableId = (created as { result: { tableId: number } }).result.tableId;

    const wa = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.create',
      args: { title: 'Vòng A' },
    });
    const wb = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'wheel.create',
      args: { title: 'Vòng B' },
    });
    assert.equal(wa.ok, true);
    assert.equal(wb.ok, true);
    wheelA = (wa as { result: { id: string } }).result.id;
    wheelB = (wb as { result: { id: string } }).result.id;
  });

  afterEach(() => closeDb());

  it('hai wheelId không leak — snap/sub theo scope', () => {
    const sendA = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'chat.send',
      args: { scope: `wheel:${wheelA}`, body: 'tin A' },
    });
    assert.equal(sendA.ok, true);
    resetChatRateLimit();

    const sendB = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'chat.send',
      args: { scope: `wheel:${wheelB}`, body: 'tin B' },
    });
    assert.equal(sendB.ok, true);

    assert.equal(canAccessChatScope(db, dan.member, `wheel:${wheelA}`), true);
    assert.equal(canAccessChatScope(db, dan.member, `wheel:${wheelB}`), true);

    const snapA = loadChatSnap(db, `wheel:${wheelA}`);
    const snapB = loadChatSnap(db, `wheel:${wheelB}`);
    assert.equal(snapA.messages.length, 1);
    assert.equal(snapB.messages.length, 1);
    assert.equal(snapA.messages[0]!.body, 'tin A');
    assert.equal(snapB.messages[0]!.body, 'tin B');

    const helloA = buildSnap(db, chatSubKey(`wheel:${wheelA}`));
    const helloB = buildSnap(db, chatSubKey(`wheel:${wheelB}`));
    assert.ok(helloA);
    assert.ok(helloB);
    assert.equal((helloA!.data as { messages: { body: string }[] }).messages[0]!.body, 'tin A');
    assert.equal((helloB!.data as { messages: { body: string }[] }).messages[0]!.body, 'tin B');
    assert.notEqual(
      (helloA!.data as { messages: { body: string }[] }).messages[0]!.body,
      (helloB!.data as { messages: { body: string }[] }).messages[0]!.body,
    );
  });

  it('chat.send fanout event, không full-snap mỗi tin', () => {
    const ack = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'chat.send',
      args: { scope: `wheel:${wheelA}`, body: 'ping' },
    });
    assert.equal(ack.ok, true);
    const ok = ack as { ok: true; scopes: string[]; events?: ChatEvent[] };
    assert.ok(ok.events && ok.events.length === 1);
    assert.equal(ok.events![0]!.t, 'chat');
    assert.equal(ok.events![0]!.scope, `wheel:${wheelA}`);
    assert.equal(ok.events![0]!.msg.body, 'ping');
    assert.ok(!ok.scopes.some((s) => s.startsWith('chat:')));
  });

  it('nô lệ send table OK, không mod', () => {
    const scope = `table:${tableId}`;
    const send = dispatchCommand(db, nole.member, {
      opId: crypto.randomUUID(),
      name: 'chat.send',
      args: { scope, body: 'nô lệ chat' },
    });
    assert.equal(send.ok, true);
    resetChatRateLimit();

    const other = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'chat.send',
      args: { scope, body: 'tin dân' },
    });
    assert.equal(other.ok, true);
    const msgId = (other as { result: { id: string } }).result.id;

    const del = dispatchCommand(db, nole.member, {
      opId: crypto.randomUUID(),
      name: 'chat.delete',
      args: { id: msgId },
    });
    assert.equal(del.ok, false);
    assert.equal((del as { error: string }).error, 'forbidden');
  });

  it('chủ xị chat.mod xóa được mọi lúc', () => {
    const scope = `table:${tableId}`;
    const send = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'chat.send',
      args: { scope, body: 'xóa tôi' },
    });
    assert.equal(send.ok, true);
    const msgId = (send as { result: { id: string } }).result.id;

    const del = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'chat.delete',
      args: { id: msgId },
    });
    assert.equal(del.ok, true);
    const snap = loadChatSnap(db, scope);
    assert.ok(snap.messages[0]!.deletedAt);
  });

  it('lobby: mọi thành viên chat chung, tách khỏi wheel/table', () => {
    assert.equal(canAccessChatScope(db, chu.member, LOBBY_CHAT_SCOPE), true);
    assert.equal(canAccessChatScope(db, dan.member, LOBBY_CHAT_SCOPE), true);
    assert.equal(canAccessChatScope(db, nole.member, LOBBY_CHAT_SCOPE), true);

    const send = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'chat.send',
      args: { scope: LOBBY_CHAT_SCOPE, body: 'alo cả VP' },
    });
    assert.equal(send.ok, true);
    resetChatRateLimit();

    const snap = loadChatSnap(db, LOBBY_CHAT_SCOPE);
    assert.equal(snap.messages.length, 1);
    assert.equal(snap.messages[0]!.body, 'alo cả VP');

    const wheelSnap = loadChatSnap(db, `wheel:${wheelA}`);
    assert.equal(wheelSnap.messages.length, 0);

    const hello = buildSnap(db, chatSubKey(LOBBY_CHAT_SCOPE));
    assert.ok(hello);
    assert.equal((hello!.data as { messages: { body: string }[] }).messages[0]!.body, 'alo cả VP');
  });

  it('game leave / outsider không access chat game scope', () => {
    const create = dispatchCommand(db, chu.member, {
      opId: crypto.randomUUID(),
      name: 'game.create',
      args: { kind: 'caro', title: 'Chat ACL' },
    });
    assert.equal(create.ok, true);
    const roomId = (create as { result: { id: string } }).result.id;
    const scope = `game:${roomId}`;

    assert.equal(canAccessChatScope(db, chu.member, scope), true);
    assert.equal(canAccessChatScope(db, dan.member, scope), false, 'outsider trước join');
    assert.equal(canAccessChatScope(db, nole.member, scope), false);

    assert.equal(
      dispatchCommand(db, dan.member, {
        opId: crypto.randomUUID(),
        name: 'game.join',
        args: { roomId, as: 'play' },
      }).ok,
      true,
    );
    assert.equal(canAccessChatScope(db, dan.member, scope), true);

    const leave = dispatchCommand(db, dan.member, {
      opId: crypto.randomUUID(),
      name: 'game.leave',
      args: { roomId },
    });
    assert.equal(leave.ok, true);
    assert.equal(canAccessChatScope(db, dan.member, scope), false, 'sau leave không access');
    assert.equal(canAccessChatScope(db, nole.member, scope), false, 'outsider vẫn không');

    // Stale sub phải bị prune — cùng predicate broadcastChat dùng trước send
    const staleSubs = new Set([chatSubKey(scope)]);
    if (!canAccessChatScope(db, dan.member, scope)) staleSubs.delete(chatSubKey(scope));
    assert.equal(staleSubs.has(chatSubKey(scope)), false);
  });
});
