import type { CommandName } from '../../shared/commands.ts';
import type { Handler } from './types.ts';
import {
  tableCreate,
  tableAddShop,
  voteSet,
  tableSetWinner,
  tableSetBill,
  tableSetPickup,
  tableSetResidualHost,
} from './table.ts';
import { orderAdd, orderUpdate, orderRemove } from './order.ts';
import { shopUpsert, shopSetMenu, shopDelete } from './shop.ts';
import {
  wheelCreate,
  wheelRename,
  wheelItemAdd,
  wheelItemUpdate,
  wheelItemRemove,
  wheelEqualize,
  wheelByVote,
  wheelSpin,
  wheelDelete,
} from './wheel.ts';
import {
  memberUpdateProfile,
  memberChangePin,
  adminAddMember,
  adminResetPin,
  adminDisable,
  adminSetOperator,
} from './member.ts';
import {
  permSetMatrix,
  permSetTier,
  permRequest,
  permApprove,
  permDeny,
} from './perm.ts';
import { chatSend, chatDelete } from './chat.ts';
import { gameCreate, gameJoin, gameLeave, gameStart, gameMove } from './game.ts';

export const handlers: Record<CommandName, Handler> = {
  'table.create': tableCreate,
  'table.addShop': tableAddShop,
  'vote.set': voteSet,
  'table.setWinner': tableSetWinner,
  'table.setBill': tableSetBill,
  'table.setPickup': tableSetPickup,
  'table.setResidualHost': tableSetResidualHost,
  'order.add': orderAdd,
  'order.update': orderUpdate,
  'order.remove': orderRemove,
  'shop.upsert': shopUpsert,
  'shop.setMenu': shopSetMenu,
  'shop.delete': shopDelete,
  'wheel.create': wheelCreate,
  'wheel.rename': wheelRename,
  'wheel.item.add': wheelItemAdd,
  'wheel.item.update': wheelItemUpdate,
  'wheel.item.remove': wheelItemRemove,
  'wheel.equalize': wheelEqualize,
  'wheel.byVote': wheelByVote,
  'wheel.spin': wheelSpin,
  'wheel.delete': wheelDelete,
  'chat.send': chatSend,
  'chat.delete': chatDelete,
  'member.updateProfile': memberUpdateProfile,
  'member.changePin': memberChangePin,
  'admin.addMember': adminAddMember,
  'admin.resetPin': adminResetPin,
  'admin.disable': adminDisable,
  'admin.setOperator': adminSetOperator,
  'perm.setMatrix': permSetMatrix,
  'perm.setTier': permSetTier,
  'perm.request': permRequest,
  'perm.approve': permApprove,
  'perm.deny': permDeny,
  'game.create': gameCreate,
  'game.join': gameJoin,
  'game.leave': gameLeave,
  'game.start': gameStart,
  'game.move': gameMove,
};

export type { CmdCtx, CmdOk, Handler } from './types.ts';
