import type { Member, Shop, TableRow, Wheel } from '../shared/types.js';
import { DEFAULT_MATRIX, TIERS, type PermKey } from '../shared/perms-catalog.js';
import { state, patch } from './store.js';

let seeded = false;

export function seedMock(): void {
  if (seeded && state.members.length) {
    patch((s) => {
      s.mock = true;
    });
    return;
  }
  seeded = true;

  const members: Member[] = [
    {
      id: 'm1',
      username: 'minh',
      displayName: 'Minh',
      isOperator: true,
      tier: 'chu_xi',
      bankBin: '970407',
      bankAccount: '1903888999',
      bankNameDisplay: 'Techcombank',
      disabled: false,
      avatarId: null,
    },
    {
      id: 'm2',
      username: 'lan',
      displayName: 'Lan HR',
      isOperator: false,
      tier: 'pho_xi',
      bankBin: null,
      bankAccount: null,
      bankNameDisplay: null,
      disabled: false,
      avatarId: null,
    },
    {
      id: 'm3',
      username: 'tuan',
      displayName: 'Tuấn Dev',
      isOperator: false,
      tier: 'dan_den',
      bankBin: null,
      bankAccount: null,
      bankNameDisplay: null,
      disabled: false,
      avatarId: null,
    },
    {
      id: 'm4',
      username: 'huong',
      displayName: 'Hương Kế Toán',
      isOperator: false,
      tier: 'dan_den',
      bankBin: null,
      bankAccount: null,
      bankNameDisplay: null,
      disabled: false,
      avatarId: null,
    },
    {
      id: 'm5',
      username: 'hoang',
      displayName: 'Hoàng Design',
      isOperator: false,
      tier: 'dan_den',
      bankBin: null,
      bankAccount: null,
      bankNameDisplay: null,
      disabled: false,
      avatarId: null,
    },
    {
      id: 'm6',
      username: 'thao',
      displayName: 'Thảo Marketing',
      isOperator: false,
      tier: 'no_le',
      bankBin: null,
      bankAccount: null,
      bankNameDisplay: null,
      disabled: false,
      avatarId: null,
    },
  ];

  const matrix = Object.fromEntries(
    TIERS.map((t) => [t, [...DEFAULT_MATRIX[t]] as PermKey[]]),
  ) as Record<(typeof TIERS)[number], PermKey[]>;

  const shops: Shop[] = [
    {
      id: 's1',
      name: 'Cơm Tấm Cô Ba',
      phone: '0909 382 114',
      type: 'no',
      mapsUrl: null,
      createdBy: 'm1',
      version: 1,
      stats: { times: 8, lastDate: '2026-11-05' },
      menu: [
        { id: 'mi1', shopId: 's1', name: 'Sườn', price: 45000, sort: 0 },
        { id: 'mi2', shopId: 's1', name: 'Sườn bì chả', price: 55000, sort: 1 },
        { id: 'mi3', shopId: 's1', name: 'Ba rọi quay', price: 50000, sort: 2 },
        { id: 'mi4', shopId: 's1', name: 'Đùi gà', price: 50000, sort: 3 },
        { id: 'mi5', shopId: 's1', name: 'Ốp la', price: 10000, sort: 4 },
        { id: 'mi6', shopId: 's1', name: 'Canh khổ qua', price: 15000, sort: 5 },
        { id: 'mi7', shopId: 's1', name: 'Trà tắc', price: 10000, sort: 6 },
      ],
    },
    {
      id: 's2',
      name: 'Bún Đậu Hàng Khay',
      phone: '0988 712 900',
      type: 'no',
      mapsUrl: null,
      createdBy: 'm1',
      version: 1,
      stats: { times: 4, lastDate: '2026-11-08' },
      menu: [],
    },
    {
      id: 's3',
      name: 'Trà Sữa Nhà Mây',
      phone: '0933 505 888',
      type: 'uong',
      mapsUrl: null,
      createdBy: 'm1',
      version: 1,
      stats: { times: 3, lastDate: '2026-11-09' },
      menu: [],
    },
    {
      id: 's4',
      name: 'Bánh Mì Cô Hai',
      phone: '0912 448 207',
      type: 'vat',
      mapsUrl: null,
      createdBy: 'm1',
      version: 1,
      stats: { times: 2, lastDate: '2026-11-06' },
      menu: [],
    },
    {
      id: 's5',
      name: 'Phở Bò Phú Gia',
      phone: '0903 117 562',
      type: '',
      mapsUrl: null,
      createdBy: 'm1',
      version: 1,
      stats: { times: 0, lastDate: null },
      menu: [],
    },
    {
      id: 's6',
      name: 'Mì Cay Seoul',
      phone: '0977 260 315',
      type: '',
      mapsUrl: null,
      createdBy: 'm1',
      version: 1,
      stats: { times: 0, lastDate: null },
      menu: [],
    },
  ];

  const table: TableRow = {
    id: 12,
    date: '2026-11-10',
    hostId: 'm1',
    winnerShopId: null,
    winnerSpinId: null,
    pickupMemberId: null,
    pickupSpinId: null,
    billTotal: 340200,
    billMode: 'item',
    version: 1,
    shopIds: ['s1', 's2', 's3'],
    votes: [
      { tableId: 12, memberId: 'm1', shopId: 's1' },
      { tableId: 12, memberId: 'm2', shopId: 's1' },
      { tableId: 12, memberId: 'm3', shopId: 's1' },
      { tableId: 12, memberId: 'm5', shopId: 's1' },
      { tableId: 12, memberId: 'm4', shopId: 's2' },
      { tableId: 12, memberId: 'm6', shopId: 's3' },
    ],
    orders: [
      { id: 'o1', tableId: 12, memberId: 'm1', text: 'Sườn bì chả + Ốp la', price: 65000, version: 1 },
      { id: 'o2', tableId: 12, memberId: 'm2', text: 'Sườn, ít cơm', price: 45000, version: 1 },
      { id: 'o3', tableId: 12, memberId: 'm3', text: 'Ba rọi quay + Trà tắc', price: 60000, version: 1 },
      { id: 'o4', tableId: 12, memberId: 'm4', text: 'Đùi gà, không hành', price: 50000, version: 1 },
      { id: 'o5', tableId: 12, memberId: 'm5', text: 'Sườn + Canh khổ qua', price: 60000, version: 1 },
      { id: 'o6', tableId: 12, memberId: 'm6', text: 'Cơm chay', price: null, version: 1 },
    ],
  };

  const tables: TableRow[] = [
    table,
    {
      id: 11,
      date: '2026-11-09',
      hostId: 'm6',
      winnerShopId: 's3',
      winnerSpinId: null,
      pickupMemberId: null,
      pickupSpinId: null,
      billTotal: 102000,
      billMode: 'equal',
      version: 1,
      shopIds: ['s3'],
      votes: [],
      orders: [
        { id: 'o11', tableId: 11, memberId: 'm6', text: 'Trà sữa oolong', price: 34000, version: 1 },
        { id: 'o12', tableId: 11, memberId: 'm2', text: 'Hồng trà', price: 34000, version: 1 },
        { id: 'o13', tableId: 11, memberId: 'm5', text: 'Trà đào', price: 34000, version: 1 },
      ],
    },
    {
      id: 10,
      date: '2026-11-09',
      hostId: 'm1',
      winnerShopId: 's1',
      winnerSpinId: null,
      pickupMemberId: null,
      pickupSpinId: null,
      billTotal: 310000,
      billMode: 'item',
      version: 1,
      shopIds: ['s1'],
      votes: [],
      orders: [],
    },
  ];

  const wheels: Wheel[] = [
    {
      id: 'w1',
      title: 'Trưa nay ăn gì?',
      kind: 'shop',
      tableId: 12,
      createdBy: 'm1',
      version: 1,
      items: [
        { id: 'wi1', wheelId: 'w1', name: 'Cô Ba', weight: 40, refShopId: 's1', refMemberId: null, votes: 4, sort: 0 },
        { id: 'wi2', wheelId: 'w1', name: 'Bún Đậu', weight: 10, refShopId: 's2', refMemberId: null, votes: 1, sort: 1 },
        { id: 'wi3', wheelId: 'w1', name: 'Nhà Mây', weight: 10, refShopId: 's3', refMemberId: null, votes: 1, sort: 2 },
      ],
    },
    {
      id: 'w2',
      title: 'Ai đi lấy đồ?',
      kind: 'person',
      tableId: 12,
      createdBy: 'm1',
      version: 1,
      items: members.map((m, i) => ({
        id: `wp${i}`,
        wheelId: 'w2',
        name: m.displayName,
        weight: 10,
        refShopId: null,
        refMemberId: m.id,
        votes: null,
        sort: i,
      })),
    },
  ];

  patch((s) => {
    s.mock = true;
    s.members = members;
    s.shops = shops;
    s.table = table;
    s.tables = tables;
    s.wheels = wheels;
    s.spins = [];
    s.perms = { matrix, grants: [], requests: [] };
    s.ui.wheelId = 'w1';
    s.ui.selectedPersonId = 'm1';
    s.connected = true;
  });
}
