export type ShopType = 'no' | 'vat' | 'uong' | '';

export const SHOP_TYPE_LABELS: Record<Exclude<ShopType, ''>, string> = {
  no: 'Ăn no',
  vat: 'Ăn vặt',
  uong: 'Đồ uống',
};

export type MemberTier = 'chu_xi' | 'pho_xi' | 'dan_den' | 'no_le';

export type Member = {
  id: string;
  username: string;
  displayName: string;
  isOperator: boolean;
  tier: MemberTier;
  avatarId: string | null;
  bankBin: string | null;
  bankAccount: string | null;
  bankNameDisplay: string | null;
  disabled: boolean;
};

export type MenuItem = {
  id: string;
  shopId: string;
  name: string;
  price: number | null;
  sort: number;
};

export type Shop = {
  id: string;
  name: string;
  phone: string | null;
  type: ShopType;
  mapsUrl: string | null;
  createdBy: string | null;
  version: number;
  menu: MenuItem[];
  stats?: { times: number; lastDate: string | null };
};

export type Vote = {
  tableId: number;
  memberId: string;
  shopId: string;
};

export type Order = {
  id: string;
  tableId: number;
  memberId: string;
  text: string;
  price: number | null;
  version: number;
};

export type TableRow = {
  id: number;
  date: string;
  hostId: string;
  winnerShopId: string | null;
  winnerSpinId: string | null;
  pickupMemberId: string | null;
  pickupSpinId: string | null;
  billTotal: number | null;
  billMode: 'item' | 'equal';
  version: number;
  voteEndsAt?: string | null;
  shopIds: string[];
  votes: Vote[];
  orders: Order[];
};

export type WheelKind = 'shop' | 'person' | 'free';

export type WheelItem = {
  id: string;
  wheelId: string;
  name: string;
  weight: number;
  refShopId: string | null;
  refMemberId: string | null;
  votes: number | null;
  sort: number;
};

export type Wheel = {
  id: string;
  title: string;
  kind: WheelKind;
  tableId: number | null;
  createdBy: string | null;
  version: number;
  items: WheelItem[];
};

export type Spin = {
  id: string;
  wheelId: string;
  byMember: string;
  itemsJson: string;
  resultIndex: number;
  resultName: string;
  startedAt: number;
  durationMs: number;
};

export type GameSeat = 'host' | 'player' | 'spectator';
export type GameKind = 'caro' | 'ca_ngua' | 'ti_phu';
export type GameStatus = 'open' | 'playing' | 'ended';

export type GameMember = {
  memberId: string;
  seat: GameSeat;
  joinedAt: string;
};

export type GameRoom = {
  id: string;
  kind: GameKind;
  title: string;
  status: GameStatus;
  hostId: string;
  state: unknown;
  version: number;
  createdAt: string;
  updatedAt: string;
  members: GameMember[];
};

export type ScopeName =
  | 'table:current'
  | 'shops'
  | 'wheels'
  | 'members'
  | 'perms'
  | 'games'
  | `table:${number}`
  | `chat:${string}`;

export type ChatMsg = {
  id: string;
  scope: string;
  memberId: string;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
};
