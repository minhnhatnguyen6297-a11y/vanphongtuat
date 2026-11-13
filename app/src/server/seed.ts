import { randomUUID } from 'node:crypto';
import type { Db } from './db.ts';
import { hashPin, randomPin } from './auth.ts';
import { nowIso } from './db.ts';

type SeedPin = { username: string; displayName: string; pin: string; isOperator?: boolean };

const SEED_MEMBERS: Array<Omit<SeedPin, 'pin'> & { username: string }> = [
  { username: 'minh', displayName: 'Minh (Bạn)', isOperator: true },
  { username: 'lan', displayName: 'Lan HR' },
  { username: 'tuan', displayName: 'Tuấn Dev' },
  { username: 'huong', displayName: 'Hương Kế Toán' },
  { username: 'hoang', displayName: 'Hoàng Design' },
  { username: 'thao', displayName: 'Thảo Marketing' },
];

type SeedShop = {
  id: string;
  name: string;
  phone: string;
  type: '' | 'no' | 'vat' | 'uong';
  menu: Array<{ name: string; price: number | null }>;
};

const SEED_SHOPS: SeedShop[] = [
  {
    id: 'shop1',
    name: 'Cơm Tấm Sườn Cây Cô Ba',
    phone: '0909 382 114',
    type: 'no',
    menu: [
      { name: 'Cơm Sườn Nướng Mật Ong', price: 45000 },
      { name: 'Cơm Sườn Bì Chả Đặc Biệt', price: 55000 },
      { name: 'Cơm Ba Rọi Quay Giòn Bì', price: 50000 },
      { name: 'Cơm Đùi Gà Rô Ti + Ốp La', price: 50000 },
      { name: 'Canh Khổ Qua / Trứng Ốp La', price: 10000 },
    ],
  },
  {
    id: 'shop2',
    name: 'Bún Đậu Mắm Tôm Hàng Khay',
    phone: '0988 712 900',
    type: 'no',
    menu: [
      { name: 'Mẹt Bún Đậu Thịt Luộc', price: 42000 },
      { name: 'Mẹt Bún Đậu Tá Lả Đặc Biệt', price: 58000 },
      { name: 'Chả Cốm Hà Nội thêm', price: 20000 },
      { name: 'Nước Mơ / Nước Sấu Đá', price: 15000 },
    ],
  },
  {
    id: 'shop3',
    name: 'Trà Sữa & Ăn Vặt Nhà Mây',
    phone: '0933 505 888',
    type: 'uong',
    menu: [
      { name: 'Trà Sữa Ô Long Trân Châu Hoàng Kim', price: 38000 },
      { name: 'Trà Đào Cam Sả Size L', price: 35000 },
      { name: 'Matcha Latte Kem Cheese', price: 42000 },
      { name: 'Bánh Tráng Trộn Bò Khô', price: 28000 },
    ],
  },
  { id: 'shop4', name: 'Phở Bò Phú Gia', phone: '0912 446 210', type: '', menu: [] },
  { id: 'shop5', name: 'Mì Cay Seoul', phone: '0938 117 552', type: '', menu: [] },
  {
    id: 'shop6',
    name: 'Bánh Mì Cô Hai',
    phone: '0907 221 336',
    type: 'vat',
    menu: [
      { name: 'Bánh Mì Thịt Nguội', price: 25000 },
      { name: 'Bánh Mì Xíu Mại', price: 30000 },
      { name: 'Bánh Mì Gà Xé', price: 30000 },
    ],
  },
];

function isEmpty(db: Db): boolean {
  const m = db.prepare('SELECT COUNT(*) AS c FROM members').get() as { c: number };
  return m.c === 0;
}

export function seedIfEmpty(db: Db): SeedPin[] | null {
  if (!isEmpty(db)) return null;

  const pins: SeedPin[] = [];
  const ids = new Map<string, string>();

  const run = db.transaction(() => {
    for (const m of SEED_MEMBERS) {
      const pin = randomPin();
      const { hash, salt } = hashPin(pin);
      const id = randomUUID();
      ids.set(m.username, id);
      const tier = m.isOperator ? 'chu_xi' : 'dan_den';
      db.prepare(
        `INSERT INTO members(id, username, display_name, pin_hash, pin_salt, is_operator, tier, disabled, created_at)
         VALUES(?,?,?,?,?,?,?,0,?)`,
      ).run(id, m.username, m.displayName, hash, salt, m.isOperator ? 1 : 0, tier, nowIso());
      pins.push({
        username: m.username,
        displayName: m.displayName,
        pin,
        isOperator: !!m.isOperator,
      });
    }

    const minh = ids.get('minh')!;
    for (const s of SEED_SHOPS) {
      const now = nowIso();
      db.prepare(
        `INSERT INTO shops(id, name, phone, type, maps_url, created_by, created_at, updated_at, version)
         VALUES(?,?,?,?,NULL,?,?,?,1)`,
      ).run(s.id, s.name, s.phone, s.type, minh, now, now);
      let sort = 0;
      for (const it of s.menu) {
        db.prepare(
          `INSERT INTO menu_items(id, shop_id, name, price, sort) VALUES(?,?,?,?,?)`,
        ).run(randomUUID(), s.id, it.name, it.price, sort++);
      }
    }

    // Bàn mẫu từ archive/thietke_v2 (rút gọn, current = bàn trưa 09/11)
    seedSampleTables(db, ids);
  });

  run();
  return pins;
}

function uid(ids: Map<string, string>, username: string) {
  return ids.get(username)!;
}

function seedSampleTables(db: Db, ids: Map<string, string>) {
  type T = {
    date: string;
    host: string;
    shops: string[];
    winner?: string;
    pickup?: string;
    billTotal?: number | null;
    billMode?: 'item' | 'equal';
    votes: Array<[string, string]>; // member, shop
    orders: Array<[string, string, number | null]>;
  };

  const samples: T[] = [
    {
      date: '2026-10-20',
      host: 'minh',
      shops: ['shop4', 'shop1'],
      winner: 'shop4',
      billTotal: 170000,
      votes: [
        ['tuan', 'shop4'],
        ['minh', 'shop4'],
        ['hoang', 'shop4'],
      ],
      orders: [
        ['tuan', '1 Phở tái nạm', 55000],
        ['minh', '1 Phở tái nạm', 55000],
        ['hoang', '1 Phở tái lăn', 60000],
      ],
    },
    {
      date: '2026-11-06',
      host: 'minh',
      shops: ['shop6', 'shop1'],
      winner: 'shop6',
      billTotal: 120000,
      votes: [
        ['tuan', 'shop6'],
        ['hoang', 'shop6'],
        ['minh', 'shop1'],
        ['lan', 'shop1'],
      ],
      orders: [
        ['minh', '1 Bánh mì xíu mại', 30000],
        ['lan', '1 Bánh mì gà xé', 30000],
        ['tuan', '1 Bánh mì thịt nguội', 25000],
        ['hoang', '1 Bánh mì thịt nguội', 25000],
      ],
    },
    {
      date: '2026-11-07',
      host: 'lan',
      shops: ['shop3'],
      winner: 'shop3',
      billTotal: 143000,
      votes: [
        ['minh', 'shop3'],
        ['lan', 'shop3'],
        ['tuan', 'shop3'],
        ['hoang', 'shop3'],
      ],
      orders: [
        ['tuan', '1 Trà sữa Ô Long + 1 Bánh tráng trộn', 66000],
        ['hoang', '1 Trà đào cam sả', 35000],
        ['lan', '1 Matcha Latte kem cheese', 42000],
      ],
    },
    {
      date: '2026-11-08',
      host: 'minh',
      shops: ['shop1', 'shop2'],
      winner: 'shop2',
      pickup: 'hoang',
      billTotal: 261000,
      votes: [
        ['tuan', 'shop1'],
        ['minh', 'shop2'],
        ['lan', 'shop2'],
        ['huong', 'shop2'],
        ['hoang', 'shop2'],
      ],
      orders: [
        ['minh', '1 Mẹt bún đậu tá lả + 1 Nước mơ', 73000],
        ['lan', '1 Mẹt bún đậu thịt luộc (nước mắm)', 42000],
        ['huong', '1 Mẹt bún đậu tá lả', 58000],
        ['hoang', '1 Mẹt bún đậu tá lả + Chả cốm thêm', 78000],
      ],
    },
    {
      date: '2026-11-09',
      host: 'minh',
      shops: ['shop3', 'shop2'],
      votes: [
        ['tuan', 'shop2'],
        ['minh', 'shop3'],
        ['lan', 'shop3'],
        ['thao', 'shop3'],
        ['huong', 'shop3'],
      ],
      orders: [
        ['lan', '1 Trà đào cam sả size L (ít đá)', 35000],
        ['thao', '1 Matcha Latte kem cheese (50% đường)', 42000],
        ['minh', '1 Trà sữa Ô Long trân châu hoàng kim', 38000],
      ],
    },
    {
      date: '2026-11-09',
      host: 'minh',
      shops: ['shop1', 'shop2', 'shop3'],
      votes: [
        ['minh', 'shop1'],
        ['lan', 'shop1'],
        ['tuan', 'shop1'],
        ['huong', 'shop2'],
        ['hoang', 'shop2'],
        ['thao', 'shop3'],
      ],
      orders: [
        ['minh', '1 Cơm sườn bì chả đặc biệt (thêm ốp la)', null],
        ['lan', '1 Cơm sườn nướng mật ong (ít cơm)', 45000],
        ['tuan', '1 Cơm ba rọi quay + 1 Trà tắc', null],
        ['huong', '1 Cơm đùi gà rô ti (không hành)', null],
        ['hoang', '1 Cơm sườn nướng + 1 Canh khổ qua', null],
      ],
    },
  ];

  for (const s of samples) {
    const info = db
      .prepare(
        `INSERT INTO tables(date, host_id, winner_shop_id, pickup_member_id, bill_total, bill_mode, created_at, version)
         VALUES(?,?,?,?,?, 'item', ?, 1)`,
      )
      .run(
        s.date,
        uid(ids, s.host),
        s.winner ?? null,
        s.pickup ? uid(ids, s.pickup) : null,
        s.billTotal ?? null,
        `${s.date}T10:00:00.000Z`,
      );
    const tableId = Number(info.lastInsertRowid);
    for (const shopId of s.shops) {
      db.prepare(`INSERT INTO table_shops(table_id, shop_id, added_by) VALUES(?,?,?)`).run(
        tableId,
        shopId,
        uid(ids, s.host),
      );
    }
    for (const [u, shopId] of s.votes) {
      db.prepare(
        `INSERT INTO votes(table_id, member_id, shop_id, updated_at) VALUES(?,?,?,?)`,
      ).run(tableId, uid(ids, u), shopId, nowIso());
    }
    for (const [u, text, price] of s.orders) {
      const now = nowIso();
      db.prepare(
        `INSERT INTO orders(id, table_id, member_id, text, price, created_at, updated_at, version)
         VALUES(?,?,?,?,?,?,?,1)`,
      ).run(randomUUID(), tableId, uid(ids, u), text, price, now, now);
    }

    // Vòng quay gắn bàn
    const shopWheel = randomUUID();
    db.prepare(
      `INSERT INTO wheels(id, title, kind, table_id, created_by, version) VALUES(?,?, 'shop', ?, ?, 1)`,
    ).run(shopWheel, 'Trưa nay ăn gì?', tableId, uid(ids, s.host));
    let sort = 0;
    for (const shopId of s.shops) {
      const shop = SEED_SHOPS.find((x) => x.id === shopId)!;
      const vc = s.votes.filter((v) => v[1] === shopId).length;
      const weight = Math.min(100, Math.max(5, vc * 10));
      db.prepare(
        `INSERT INTO wheel_items(id, wheel_id, name, weight, ref_shop_id, votes, sort)
         VALUES(?,?,?,?,?,?,?)`,
      ).run(randomUUID(), shopWheel, shop.name, weight, shopId, vc, sort++);
    }

    const personWheel = randomUUID();
    db.prepare(
      `INSERT INTO wheels(id, title, kind, table_id, created_by, version) VALUES(?,?, 'person', ?, ?, 1)`,
    ).run(personWheel, 'Ai đi lấy đồ?', tableId, uid(ids, s.host));
    const people = [...new Set(s.orders.map((o) => o[0]))];
    sort = 0;
    for (const u of people) {
      const m = SEED_MEMBERS.find((x) => x.username === u)!;
      db.prepare(
        `INSERT INTO wheel_items(id, wheel_id, name, weight, ref_member_id, sort)
         VALUES(?,?,?,?,?,?)`,
      ).run(randomUUID(), personWheel, m.displayName, 20, uid(ids, u), sort++);
    }
  }
}

export function printSeedPins(pins: SeedPin[]) {
  console.log('\n=== SEED PIN (chỉ hiện một lần) ===');
  for (const p of pins) {
    console.log(
      `  ${p.username.padEnd(8)}  ${p.displayName.padEnd(20)}  PIN=${p.pin}${p.isOperator ? '  [operator]' : ''}`,
    );
  }
  console.log('===================================\n');
}

// CLI
import { openDb, closeDb } from './db.ts';
import { config } from './config.ts';

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/seed.ts')) {
  const db = openDb(config.dbPath);
  const pins = seedIfEmpty(db);
  if (!pins) console.log('DB không trống — bỏ qua seed.');
  else printSeedPins(pins);
  closeDb();
}
