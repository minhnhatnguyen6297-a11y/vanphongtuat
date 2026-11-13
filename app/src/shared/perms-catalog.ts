/** Catalog quyền toàn cục + ma trận mặc định (spec §4). */

export const TIERS = ['chu_xi', 'pho_xi', 'dan_den', 'no_le'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  chu_xi: 'Chủ xị',
  pho_xi: 'Phó xị',
  dan_den: 'Dân đen lang thang',
  no_le: 'Nô lệ',
};

export const PERM_KEYS = [
  'vote',
  'order',
  'order.edit_others',
  'table.create',
  'table.addShop',
  'table.setWinner',
  'table.setBill',
  'table.setPickup',
  'shop.add',
  'shop.edit',
  'shop.delete',
  'wheel.create',
  'wheel.edit',
  'wheel.delete',
  'wheel.spin',
  'chat.send',
  'chat.mod',
  'game.host',
  'game.play',
  'game.spectate',
  'perm.manage',
  'perm.approve',
  'member.admin',
] as const;

export type PermKey = (typeof PERM_KEYS)[number];

export const PERM_LABELS: Record<PermKey, string> = {
  vote: 'Vote quán',
  order: 'Gọi món mình',
  'order.edit_others': 'Sửa order người khác',
  'table.create': 'Kê bàn',
  'table.addShop': 'Thêm quán vào bàn',
  'table.setWinner': 'Chốt quán',
  'table.setBill': 'Nhập bill / gánh lẻ',
  'table.setPickup': 'Ghi người đi lấy',
  'shop.add': 'Thêm quán kho',
  'shop.edit': 'Sửa quán / menu',
  'shop.delete': 'Xóa quán',
  'wheel.create': 'Tạo vòng quay',
  'wheel.edit': 'Sửa vòng quay',
  'wheel.delete': 'Xóa vòng quay',
  'wheel.spin': 'Quay vòng',
  'chat.send': 'Gửi chat',
  'chat.mod': 'Xóa chat (mod)',
  'game.host': 'Host phòng game',
  'game.play': 'Chơi game',
  'game.spectate': 'Xem game',
  'perm.manage': 'Quản lý ma trận / tầng',
  'perm.approve': 'Duyệt xin phép',
  'member.admin': 'Quản lý tài khoản',
};

/** Không leo thang qua grant / approve / sửa matrix. */
export const NO_GRANT_PERMS = ['perm.manage', 'perm.approve', 'member.admin'] as const;
export type NoGrantPerm = (typeof NO_GRANT_PERMS)[number];

export const GRANT_TTL_MS = 24 * 60 * 60 * 1000;

const ALL = new Set<PermKey>(PERM_KEYS);

const DAN_DEN: PermKey[] = [
  'vote',
  'order',
  'table.create',
  'table.addShop',
  'shop.add',
  'shop.edit',
  'wheel.create',
  'wheel.edit',
  'wheel.spin',
  'chat.send',
  'game.play',
  'game.spectate',
];

const NO_LE: PermKey[] = ['vote', 'order', 'chat.send', 'game.spectate'];

function allExcept(...deny: PermKey[]): Set<PermKey> {
  const s = new Set(ALL);
  for (const k of deny) s.delete(k);
  return s;
}

/** Ma trận mặc định — pho trừ perm.manage; chỉ chu_xi có manage. */
export const DEFAULT_MATRIX: Record<Tier, ReadonlySet<PermKey>> = {
  chu_xi: ALL,
  pho_xi: allExcept('perm.manage'),
  dan_den: new Set(DAN_DEN),
  no_le: new Set(NO_LE),
};

export function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (TIERS as readonly string[]).includes(v);
}

export function isPermKey(v: unknown): v is PermKey {
  return typeof v === 'string' && (PERM_KEYS as readonly string[]).includes(v);
}

export function isNoGrantPerm(v: string): v is NoGrantPerm {
  return (NO_GRANT_PERMS as readonly string[]).includes(v);
}

export function defaultMatrixRows(): Array<{ tier: Tier; permKey: PermKey; allowed: 0 | 1 }> {
  const rows: Array<{ tier: Tier; permKey: PermKey; allowed: 0 | 1 }> = [];
  for (const tier of TIERS) {
    const set = DEFAULT_MATRIX[tier];
    for (const key of PERM_KEYS) {
      rows.push({ tier, permKey: key, allowed: set.has(key) ? 1 : 0 });
    }
  }
  return rows;
}

export function matrixToRecord(
  rows: Array<{ tier: string; perm_key: string; allowed: number }>,
): Record<Tier, PermKey[]> {
  const out: Record<Tier, PermKey[]> = {
    chu_xi: [],
    pho_xi: [],
    dan_den: [],
    no_le: [],
  };
  for (const r of rows) {
    if (!isTier(r.tier) || !isPermKey(r.perm_key)) continue;
    if (r.allowed) out[r.tier].push(r.perm_key);
  }
  return out;
}
