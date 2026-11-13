import { z } from 'zod';

const name120 = z.string().trim().min(1).max(120);
const name120opt = z.string().trim().max(120);
const price = z.number().int().min(0).max(10_000_000).nullable();
const pin6 = z.string().regex(/^\d{6}$/);

export const CommandSchemas = {
  'table.create': z.object({
    shopIds: z.array(z.string().min(1)).max(30),
    voteEndsInSec: z.number().int().min(0).max(86_400).optional(),
  }),
  'table.addShop': z.object({
    shopId: z.string().min(1),
  }),
  'vote.set': z.object({
    shopId: z.string().min(1).nullable(),
  }),
  'table.setWinner': z.object({
    shopId: z.string().min(1),
    spinId: z.string().min(1).optional(),
  }),
  'table.setBill': z.object({
    total: z.number().int().min(0).max(50_000_000).nullable(),
    mode: z.enum(['item', 'equal']),
  }),
  'table.setPickup': z.object({
    memberId: z.string().min(1),
    spinId: z.string().min(1),
  }),
  'table.setResidualHost': z.object({
    memberId: z.string().min(1),
  }),

  'order.add': z.object({
    text: name120,
    price,
  }),
  'order.update': z.object({
    id: z.string().min(1),
    text: name120,
    price,
  }),
  'order.remove': z.object({
    id: z.string().min(1),
  }),

  'shop.upsert': z.object({
    id: z.string().min(1).optional(),
    name: name120,
    phone: z.string().trim().max(40).nullable().optional(),
    type: z.enum(['no', 'vat', 'uong', '']).default(''),
    mapsUrl: z.string().trim().max(2000).nullable().optional(),
  }),
  'shop.setMenu': z.object({
    shopId: z.string().min(1),
    items: z
      .array(
        z.object({
          id: z.string().min(1).optional(),
          name: name120,
          price,
        }),
      )
      .max(60),
  }),

  'wheel.create': z.object({
    title: name120,
  }),
  'wheel.rename': z.object({
    id: z.string().min(1),
    title: name120,
  }),
  'wheel.item.add': z.object({
    wheelId: z.string().min(1),
    name: name120,
    weight: z.number().int().min(1).max(100).optional(),
    refShopId: z.string().min(1).nullable().optional(),
    refMemberId: z.string().min(1).nullable().optional(),
  }),
  'wheel.item.update': z.object({
    id: z.string().min(1),
    name: name120opt.optional(),
    weight: z.number().int().min(1).max(100).optional(),
  }),
  'wheel.item.remove': z.object({
    id: z.string().min(1),
  }),
  'wheel.equalize': z.object({
    wheelId: z.string().min(1),
  }),
  'wheel.byVote': z.object({
    wheelId: z.string().min(1),
  }),
  'wheel.spin': z.object({
    wheelId: z.string().min(1),
  }),
  'wheel.delete': z.object({
    id: z.string().min(1),
  }),

  'shop.delete': z.object({
    id: z.string().min(1),
  }),

  'chat.send': z.object({
    scope: z.string().min(1).max(80),
    body: z.string().trim().min(1).max(500),
  }),
  'chat.delete': z.object({
    id: z.string().min(1),
  }),

  'member.updateProfile': z.object({
    displayName: name120.optional(),
    avatarId: z.string().trim().max(20).nullable().optional(),
    bankBin: z.string().trim().max(20).nullable().optional(),
    bankAccount: z.string().trim().max(40).nullable().optional(),
    bankNameDisplay: z.string().trim().max(80).nullable().optional(),
  }),
  'member.changePin': z.object({
    oldPin: pin6,
    newPin: pin6,
  }),

  'admin.addMember': z.object({
    username: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9_]+$/i),
    displayName: name120,
  }),
  'admin.resetPin': z.object({
    memberId: z.string().min(1),
  }),
  'admin.disable': z.object({
    memberId: z.string().min(1),
    disabled: z.boolean(),
  }),
  'admin.setOperator': z.object({
    memberId: z.string().min(1),
    isOperator: z.boolean(),
  }),

  'perm.setMatrix': z.object({
    entries: z
      .array(
        z.object({
          tier: z.enum(['chu_xi', 'pho_xi', 'dan_den', 'no_le']),
          permKey: z.string().min(1),
          allowed: z.boolean(),
        }),
      )
      .min(1)
      .max(200),
  }),
  'perm.setTier': z.object({
    memberId: z.string().min(1),
    tier: z.enum(['chu_xi', 'pho_xi', 'dan_den', 'no_le']),
  }),
  'perm.request': z.object({
    permKey: z.string().min(1),
  }),
  'perm.approve': z.object({
    requestId: z.string().min(1),
  }),
  'perm.deny': z.object({
    requestId: z.string().min(1),
  }),

  'game.create': z.object({
    kind: z.enum(['caro', 'ca_ngua', 'ti_phu']),
    title: name120,
  }),
  'game.join': z.object({
    roomId: z.string().min(1),
    as: z.enum(['play', 'spectate']),
  }),
  'game.leave': z.object({
    roomId: z.string().min(1),
  }),
  'game.start': z.object({
    roomId: z.string().min(1),
  }),
  'game.move': z.object({
    roomId: z.string().min(1),
    row: z.number().int().optional(),
    col: z.number().int().optional(),
    // 5b/5c: dice / piece / tile extras
    pieceId: z.number().int().optional(),
    to: z.number().int().optional(),
    action: z.string().max(40).optional(),
  }),
} as const;

export type CommandName = keyof typeof CommandSchemas;

export type CommandArgs<N extends CommandName> = z.infer<(typeof CommandSchemas)[N]>;

export const COMMAND_NAMES = Object.keys(CommandSchemas) as CommandName[];

export function parseCommand(
  name: string,
  args: unknown,
): { name: CommandName; args: unknown } | { error: string; details?: unknown } {
  if (!(name in CommandSchemas)) return { error: 'unknown_command' };
  const schema = CommandSchemas[name as CommandName];
  const parsed = schema.safeParse(args ?? {});
  if (!parsed.success) {
    return { error: 'invalid_args', details: parsed.error.flatten() };
  }
  return { name: name as CommandName, args: parsed.data };
}

/** Lệnh sửa cần baseVersion để phát hiện xung đột */
export const VERSIONED_COMMANDS = new Set<CommandName>([
  'order.update',
  'order.remove',
  'shop.upsert',
  'shop.setMenu',
  'wheel.rename',
  'wheel.item.add',
  'wheel.item.update',
  'wheel.item.remove',
  'wheel.equalize',
  'wheel.byVote',
  'member.updateProfile',
]);
