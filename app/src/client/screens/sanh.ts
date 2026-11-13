import { esc, fmtVnd } from '../../shared/esc.js';
import { CARO_SIZE, type CaroState } from '../../shared/game-caro.js';
import {
  CA_NGUA_FINISH,
  legalPieceIndexes,
  type CaNguaState,
} from '../../shared/game-ca-ngua.js';
import { TI_PHU_BOARD, type TiPhuState } from '../../shared/game-ti-phu.js';
import type { GameRoom } from '../../shared/types.js';
import { state, canPerm, memberById, patch } from '../store.js';
import { cmd, setChatSubs } from '../ws.js';
import { toast } from '../ui/toast.js';
import { renderChatPanel, bindChatPanel } from '../ui/chat-panel.js';
import { renderFace } from '../ui/face.js';

const PIECE_COLORS = ['#C62828', '#1F5FD1', '#1B7A43', '#F28C28'];

const KIND_LABEL: Record<string, string> = {
  caro: 'CARO',
  ca_ngua: 'CÁ NGỰA',
  ti_phu: 'TỈ PHÚ VP',
};

export function titleSanh(): { chip: string; fun: string } {
  const room = activeRoom();
  if (room) return { chip: 'PHÒNG', fun: room.title.toUpperCase() };
  return { chip: 'SẢNH', fun: 'CHƠI GÌ NÀO?' };
}

function activeRoom(): GameRoom | null {
  const id = state.ui.gameRoomId;
  if (!id) return null;
  return state.games.find((g) => g.id === id) || null;
}

function mySeat(room: GameRoom): string | null {
  const me = state.me?.id;
  if (!me) return null;
  return room.members.find((m) => m.memberId === me)?.seat ?? null;
}

function renderLobby(): string {
  const canHost = canPerm('game.host');
  const canPlay = canPerm('game.play');
  const canSpec = canPerm('game.spectate');
  const rooms = state.games.filter((g) => g.status !== 'ended');

  return `<main class="hn-main hn-stack">
    <section class="hn-panel hn-row">
      <h2 class="hn-h2">MỞ PHÒNG</h2>
      <button type="button" class="hn-btn hn-btn-red" data-create="caro" ${canHost ? '' : 'disabled'}>CARO 15×15</button>
      <button type="button" class="hn-btn hn-btn-ink" data-create="ca_ngua" ${canHost ? '' : 'disabled'}>CÁ NGỰA</button>
      <button type="button" class="hn-btn hn-btn-white" data-create="ti_phu" ${canHost ? '' : 'disabled'}>TỈ PHÚ VP</button>
    </section>
    <section class="hn-panel hn-stack-tight">
      <h2 class="hn-h2">PHÒNG ĐANG MỞ</h2>
      ${
        rooms.length
          ? rooms
              .map((r) => {
                const players = r.members.filter((m) => m.seat !== 'spectator');
                const mySeat = r.members.find((m) => m.memberId === state.me?.id)?.seat;
                const canRejoinPlay = mySeat === 'host' || mySeat === 'player';
                const playEnabled = canPlay && (r.status === 'open' || canRejoinPlay);
                const playLabel =
                  canRejoinPlay && r.status === 'playing' ? 'VÀO LẠI' : 'CHƠI';
                const faces = players
                  .map((p) => {
                    const m = memberById(p.memberId);
                    const name = m?.displayName || '?';
                    return renderFace({
                      avatarId: m?.avatarId,
                      displayName: name,
                      size: 32,
                      title: name,
                    });
                  })
                  .join('');
                const statusLabel =
                  r.status === 'playing' ? 'Đang chơi' : r.status === 'open' ? 'Mở' : r.status;
                return `<div class="hn-room-card">
                  <span class="hn-kind-tag">${esc(KIND_LABEL[r.kind] || r.kind)}</span>
                  <b style="font-size:16px">${esc(r.title)}</b>
                  <span class="hn-avatar-stack" role="group" aria-label="${players.length} người chơi">${faces || '<span class="hn-member-meta">Chưa ai</span>'}</span>
                  <span class="hn-member-meta">${esc(statusLabel)}</span>
                  <span style="flex:1"></span>
                  <button type="button" class="hn-btn hn-btn-ink" data-enter="${esc(r.id)}" data-as="play" ${playEnabled ? '' : 'disabled'}>${playLabel}</button>
                  <button type="button" class="hn-btn hn-btn-white" data-enter="${esc(r.id)}" data-as="spectate" ${canSpec ? '' : 'disabled'}>XEM</button>
                </div>`;
              })
              .join('')
          : '<p class="hn-hint" style="margin:0">Chưa có phòng. Host tạo Caro đi!</p>'
      }
    </section>
  </main>`;
}

function markColor(memberId: string | null, playerIds: string[]): string {
  if (!memberId) return 'transparent';
  const i = playerIds.indexOf(memberId);
  return i === 0 ? '#C62828' : '#1F5FD1';
}

function renderCaroBoard(room: GameRoom): string {
  const st = room.state as CaroState;
  const cells = st?.cells || [];
  const playerIds = st?.playerIds || [];
  const seat = mySeat(room);
  const canMove =
    room.status === 'playing' &&
    (seat === 'host' || seat === 'player') &&
    st?.turnId === state.me?.id;

  const winner = st?.winnerId ? memberById(st.winnerId)?.displayName : null;
  const turnName = st?.turnId ? memberById(st.turnId)?.displayName : null;

  let statusLine = '';
  if (room.status === 'open') statusLine = 'Chờ đủ người rồi host BẮT ĐẦU';
  else if (room.status === 'ended') statusLine = winner ? `Thắng: ${winner}` : 'Hòa';
  else statusLine = turnName ? `Lượt: ${turnName}` : '…';

  const last = st?.lastMove;
  const grid = Array.from({ length: CARO_SIZE }, (_, row) => {
    const cols = Array.from({ length: CARO_SIZE }, (_, col) => {
      const i = row * CARO_SIZE + col;
      const who = cells[i] ?? null;
      const bg = who ? markColor(who, playerIds) : '#FFF4D6';
      const mark = who ? (playerIds.indexOf(who) === 0 ? 'X' : 'O') : '';
      const isLast = !!last && last.row === row && last.col === col;
      const border = isLast ? '3px solid #FFCF33' : '1px solid #1B1B1B';
      const ring = isLast ? 'inset 0 0 0 2px #1B1B1B' : 'none';
      const label = isLast ? `ô ${row},${col} vừa đi` : `ô ${row},${col}`;
      return `<button type="button" data-cell="${row},${col}" ${canMove && !who ? '' : 'disabled'}
        class="hn-caro-cell${isLast ? ' is-last' : ''}"
        aria-label="${label}"
        aria-current="${isLast ? 'true' : 'false'}"
        style="width:100%;aspect-ratio:1;border:${border};box-shadow:${ring};background:${bg};color:#fff;font-weight:900;font-size:11px;padding:0;cursor:${canMove && !who ? 'pointer' : 'default'};position:relative;z-index:${isLast ? '1' : '0'}">${mark}${isLast ? '<span class="hn-caro-last" aria-hidden="true"></span>' : ''}</button>`;
    }).join('');
    return cols;
  }).join('');

  return `<div style="display:flex;flex-direction:column;gap:10px;flex:1;min-width:0">
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      <span style="font-family:var(--font-display);font-size:18px">CARO</span>
      <span style="font-size:14px;font-weight:800">${esc(statusLine)}</span>
      ${last ? `<span class="hn-caro-last-hint">Ô vừa đi</span>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(15,minmax(0,1fr));gap:0;border:3px solid #1B1B1B;background:#1B1B1B;max-width:560px;box-shadow:6px 6px 0 #1B1B1B">
      ${grid}
    </div>
  </div>`;
}

function renderCaNgua(room: GameRoom): string {
  const st = room.state as CaNguaState;
  const seat = mySeat(room);
  const myTurn =
    room.status === 'playing' &&
    (seat === 'host' || seat === 'player') &&
    st?.turnId === state.me?.id;
  const legal = myTurn && st ? legalPieceIndexes(st, state.me!.id) : [];
  const turnName = st?.turnId ? memberById(st.turnId)?.displayName : null;
  const winner = st?.winnerId ? memberById(st.winnerId)?.displayName : null;

  let statusLine = '';
  if (room.status === 'open') statusLine = 'Cần 2–4 người · host BẮT ĐẦU';
  else if (room.status === 'ended') statusLine = winner ? `Thắng: ${winner}` : 'Xong';
  else statusLine = turnName ? `Lượt: ${turnName}` : '…';

  const rows = (st?.playerIds || [])
    .map((pid, pi) => {
      const name = memberById(pid)?.displayName || '?';
      const pieces = st.pieces?.[pid] || [];
      const color = PIECE_COLORS[pi % PIECE_COLORS.length]!;
      const cells = pieces
        .map((pos, i) => {
          const label = pos < 0 ? 'CHUỒNG' : pos >= CA_NGUA_FINISH ? 'ĐÍCH' : `#${pos}`;
          const canPick = legal.includes(i);
          return `<button type="button" data-piece="${i}" ${canPick ? '' : 'disabled'}
            style="min-width:72px;min-height:40px;border:3px solid #1B1B1B;background:${canPick ? color : '#fff'};color:${canPick ? '#fff' : '#1B1B1B'};font-weight:800;font-size:12px;cursor:${canPick ? 'pointer' : 'default'};box-shadow:${canPick ? '3px 3px 0 #1B1B1B' : 'none'}">Q${i + 1} ${label}</button>`;
        })
        .join('');
      return `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;border:3px solid #1B1B1B;padding:8px;background:#FFF4D6;box-shadow:4px 4px 0 #1B1B1B">
        <span style="width:16px;height:16px;background:${color};border:2px solid #1B1B1B"></span>
        <b style="min-width:80px">${esc(name)}</b>
        ${cells}
      </div>`;
    })
    .join('');

  const diceShow = st?.dice != null ? String(st.dice) : '—';

  return `<div style="display:flex;flex-direction:column;gap:12px;flex:1;min-width:0">
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      <span style="font-family:var(--font-display);font-size:18px">CÁ NGỰA</span>
      <span style="font-size:14px;font-weight:800">${esc(statusLine)}</span>
      <span style="font-family:var(--font-mono);border:3px solid #1B1B1B;background:#FFCF33;padding:4px 12px;font-size:20px;box-shadow:3px 3px 0 #1B1B1B">${esc(diceShow)}</span>
      ${
        myTurn && !st?.rolled
          ? `<button type="button" class="hn-btn hn-btn-red" data-roll style="min-height:44px">XÚC XẮC</button>`
          : ''
      }
    </div>
    <p style="margin:0;font-size:13px;color:#3D3D3D">Ra chuồng cần 6 · đá quân địch về · về đích đúng số</p>
    <div style="display:flex;flex-direction:column;gap:10px">${rows}</div>
  </div>`;
}

function renderTiPhu(room: GameRoom): string {
  const st = room.state as TiPhuState;
  const seat = mySeat(room);
  const myTurn =
    room.status === 'playing' &&
    (seat === 'host' || seat === 'player') &&
    st?.turnId === state.me?.id;
  const turnName = st?.turnId ? memberById(st.turnId)?.displayName : null;
  const winner = st?.winnerId ? memberById(st.winnerId)?.displayName : null;

  let statusLine = '';
  if (room.status === 'open') statusLine = 'Cần 2–6 người · host BẮT ĐẦU';
  else if (room.status === 'ended') statusLine = winner ? `Thắng: ${winner}` : 'Xong';
  else statusLine = turnName ? `Lượt: ${turnName}` : '…';

  const board = TI_PHU_BOARD.map((t) => {
    const ownerId = st?.owned?.[String(t.id)];
    const owner = ownerId ? memberById(ownerId)?.displayName : null;
    const here = (st?.playerIds || [])
      .filter((pid) => !st.bankrupt?.includes(pid) && st.positions?.[pid] === t.id)
      .map((pid) => memberById(pid)?.displayName || '?')
      .join(', ');
    return `<div style="border:2px solid #1B1B1B;padding:6px;background:${t.kind === 'go' ? '#FFCF33' : t.kind === 'prop' ? '#fff' : '#FFF4D6'};min-height:64px">
      <div style="font-family:var(--font-display);font-size:11px">${esc(t.name)}</div>
      <div style="font-size:11px;font-family:var(--font-mono)">${t.price != null ? fmtVnd(t.price) : t.kind}</div>
      ${owner ? `<div style="font-size:11px;font-weight:800">${esc(owner)}</div>` : ''}
      ${here ? `<div style="font-size:11px;color:#C62828">● ${esc(here)}</div>` : ''}
    </div>`;
  }).join('');

  const players = (st?.playerIds || [])
    .map((pid) => {
      const name = memberById(pid)?.displayName || '?';
      const cash = st.cash?.[pid] ?? 0;
      const broke = st.bankrupt?.includes(pid);
      return `<span style="border:2px solid #1B1B1B;padding:4px 8px;background:${broke ? 'var(--cream)' : '#fff'};font-size:13px;color:${broke ? 'var(--muted)' : 'var(--ink)'};box-shadow:2px 2px 0 #1B1B1B">${esc(name)} · ${broke ? 'OUT' : fmtVnd(cash)}</span>`;
    })
    .join('');

  const diceShow = st?.dice ? `${st.dice[0]}+${st.dice[1]}` : '—';
  const pending = st?.pendingBuy != null ? TI_PHU_BOARD[st.pendingBuy] : null;

  return `<div style="display:flex;flex-direction:column;gap:12px;flex:1;min-width:0">
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      <span style="font-family:var(--font-display);font-size:18px">TỈ PHÚ VP</span>
      <span style="font-size:14px;font-weight:800">${esc(statusLine)}</span>
      <span style="font-family:var(--font-mono);border:3px solid #1B1B1B;background:#FFCF33;padding:4px 12px;box-shadow:3px 3px 0 #1B1B1B">${esc(diceShow)}</span>
      ${myTurn && !st?.rolled && st?.pendingBuy == null ? `<button type="button" class="hn-btn hn-btn-red" data-roll style="min-height:44px">XÚC XẮC</button>` : ''}
      ${
        myTurn && pending
          ? `<button type="button" class="hn-btn hn-btn-red" data-buy style="min-height:44px">MUA ${esc(pending.name)}</button>
             <button type="button" class="hn-btn hn-btn-white" data-skip style="min-height:44px">BỎ</button>`
          : ''
      }
    </div>
    <p style="margin:0;font-size:13px;color:#3D3D3D">Không nhà/KS · mua đất · thuê · phá sản out</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${players}</div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;border:3px solid #1B1B1B;padding:8px;background:#1B1B1B;box-shadow:6px 6px 0 #1B1B1B">${board}</div>
  </div>`;
}

function renderRoom(room: GameRoom): string {
  const seat = mySeat(room);
  const isHost = seat === 'host';
  const members = room.members
    .map((m) => {
      const name = memberById(m.memberId)?.displayName || '?';
      return `<span style="border:2px solid #1B1B1B;padding:2px 8px;background:${m.seat === 'spectator' ? '#fff' : '#FFCF33'};font-size:13px">${esc(name)} · ${esc(m.seat)}</span>`;
    })
    .join('');

  const board =
    room.kind === 'caro'
      ? renderCaroBoard(room)
      : room.kind === 'ca_ngua'
        ? renderCaNgua(room)
        : room.kind === 'ti_phu'
          ? renderTiPhu(room)
          : `<p style="font-size:14px">Kind ${esc(room.kind)} chưa mở.</p>`;

  return `<main class="hn-main hn-sanh-room">
    <section class="hn-panel hn-stack-tight">
      <div class="hn-row">
        <button type="button" class="hn-btn hn-btn-white" data-back>← SẢNH</button>
        <span class="hn-kind-tag" style="background:var(--blue);color:#fff">${esc(KIND_LABEL[room.kind] || room.kind)}</span>
        <b>${esc(room.title)}</b>
        ${isHost && room.status === 'open' ? `<button type="button" class="hn-btn hn-btn-red" data-start>BẮT ĐẦU</button>` : ''}
        <button type="button" class="hn-btn hn-btn-ink" data-leave>RỜI</button>
      </div>
      <div class="hn-row" style="gap:6px">${members}</div>
      ${board}
    </section>
    ${renderChatPanel(`game:${room.id}`, { title: 'CHAT PHÒNG' })}
  </main>`;
}

export function renderSanh(): string {
  const room = activeRoom();
  return room ? renderRoom(room) : renderLobby();
}

export function bindSanh(root: HTMLElement): void {
  const room = activeRoom();
  if (room) setChatSubs([`game:${room.id}`]);
  else setChatSubs([]);

  const createKind = async (kind: 'caro' | 'ca_ngua' | 'ti_phu') => {
    if (!canPerm('game.host')) return;
    const label = kind === 'caro' ? 'Caro' : kind === 'ca_ngua' ? 'Ngựa' : 'Tỉ phú';
    const ack = await cmd('game.create', {
      kind,
      title: `${label} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
    });
    if (!ack.ok) {
      toast('Không tạo được');
      return;
    }
    const id = (ack.result as { id: string }).id;
    // Snap games có thể tới sau ack — chờ rồi stub nếu cần để UI vào phòng ngay.
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline && !state.games.some((g) => g.id === id)) {
      await new Promise((r) => setTimeout(r, 50));
    }
    patch((s) => {
      s.ui.gameRoomId = id;
      if (!s.games.some((g) => g.id === id) && s.me) {
        const now = new Date().toISOString();
        s.games = [
          {
            id,
            kind,
            title: `${label} …`,
            status: 'open',
            hostId: s.me.id,
            state: {},
            version: 1,
            createdAt: now,
            updatedAt: now,
            members: [{ memberId: s.me.id, seat: 'host', joinedAt: now }],
          },
          ...s.games,
        ];
      }
    });
  };
  root.querySelector('[data-create="caro"]')?.addEventListener('click', () => void createKind('caro'));
  root.querySelector('[data-create="ca_ngua"]')?.addEventListener('click', () => void createKind('ca_ngua'));
  root.querySelector('[data-create="ti_phu"]')?.addEventListener('click', () => void createKind('ti_phu'));

  root.querySelectorAll('[data-enter]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const el = btn as HTMLElement;
      const roomId = el.dataset.enter!;
      const as = (el.dataset.as || 'spectate') as 'play' | 'spectate';
      const ack = await cmd('game.join', { roomId, as });
      if (!ack.ok) {
        toast(
          ack.error === 'forbidden'
            ? 'Không vào được'
            : ack.error === 'room_full'
              ? 'Phòng đầy'
              : ack.error === 'already_started'
                ? 'Ván đã bắt đầu — dùng VÀO LẠI nếu bạn đang chơi'
                : 'Lỗi vào phòng',
        );
        return;
      }
      patch((s) => {
        s.ui.gameRoomId = roomId;
      });
    });
  });

  root.querySelector('[data-back]')?.addEventListener('click', async () => {
    const r = activeRoom();
    if (r) {
      const ack = await cmd('game.leave', { roomId: r.id });
      if (!ack.ok) toast('Không rời được');
    }
    patch((s) => {
      s.ui.gameRoomId = null;
    });
  });

  root.querySelector('[data-leave]')?.addEventListener('click', async () => {
    const r = activeRoom();
    if (!r) return;
    const ack = await cmd('game.leave', { roomId: r.id });
    if (!ack.ok) toast('Không rời được');
    patch((s) => {
      s.ui.gameRoomId = null;
    });
  });

  root.querySelector('[data-start]')?.addEventListener('click', async () => {
    const r = activeRoom();
    if (!r) return;
    const ack = await cmd('game.start', { roomId: r.id });
    if (!ack.ok) {
      toast(ack.error === 'need_players' ? 'Cần 2 người' : 'Không bắt đầu được');
    }
  });

  root.querySelectorAll('[data-cell]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = activeRoom();
      if (!r) return;
      const [row, col] = (btn as HTMLElement).dataset.cell!.split(',').map(Number);
      const ack = await cmd('game.move', { roomId: r.id, row, col });
      if (!ack.ok) {
        toast(ack.error === 'illegal_move' ? 'Nước không hợp lệ' : ack.error === 'not_your_turn' ? 'Chưa tới lượt' : 'Không đánh được');
      }
    });
  });

  root.querySelector('[data-roll]')?.addEventListener('click', async () => {
    const r = activeRoom();
    if (!r) return;
    const ack = await cmd('game.move', { roomId: r.id, action: 'roll' });
    if (!ack.ok) toast('Không xúc được');
  });

  root.querySelectorAll('[data-piece]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = activeRoom();
      if (!r) return;
      const pieceId = Number((btn as HTMLElement).dataset.piece);
      const ack = await cmd('game.move', { roomId: r.id, action: 'move', pieceId });
      if (!ack.ok) toast('Không đi được');
    });
  });

  root.querySelector('[data-buy]')?.addEventListener('click', async () => {
    const r = activeRoom();
    if (!r) return;
    const ack = await cmd('game.move', { roomId: r.id, action: 'buy' });
    if (!ack.ok) toast('Không mua được');
  });

  root.querySelector('[data-skip]')?.addEventListener('click', async () => {
    const r = activeRoom();
    if (!r) return;
    const ack = await cmd('game.move', { roomId: r.id, action: 'skip' });
    if (!ack.ok) toast('Lỗi');
  });

  bindChatPanel(root);
}
