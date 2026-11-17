import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../src/client/store.ts';
import { renderQuay, resetWheelSpinForTests } from '../../src/client/screens/quay.ts';
import type { Member, Wheel } from '../../src/shared/types.ts';
import type { PermKey } from '../../src/shared/perms-catalog.ts';

const EDIT: PermKey[] = [
  'wheel.create',
  'wheel.edit',
  'wheel.spin',
  'wheel.delete',
  'table.setWinner',
  'table.setPickup',
];

function member(id: string, displayName: string): Member {
  return {
    id,
    username: id,
    displayName,
    isOperator: true,
    tier: 'chu_xi',
    avatarId: null,
    bankBin: null,
    bankAccount: null,
    bankNameDisplay: null,
    disabled: false,
  };
}

function wheel(id: string, kind: Wheel['kind']): Wheel {
  return {
    id,
    title: id,
    kind,
    version: 1,
    tableId: kind === 'shop' ? 1 : null,
    createdBy: 'm',
    items: [
      { id: `${id}1`, wheelId: id, name: 'Một', weight: 1, refShopId: kind === 'shop' ? 'shop1' : null, refMemberId: null, votes: null, sort: 0 },
      { id: `${id}2`, wheelId: id, name: 'Hai', weight: 1, refShopId: null, refMemberId: null, votes: null, sort: 1 },
    ],
  };
}

describe('màn vòng quay', () => {
  beforeEach(() => {
    resetWheelSpinForTests();
    state.me = member('m', 'Minh');
    state.members = [state.me];
    state.perms = { matrix: { chu_xi: EDIT, pho_xi: [], dan_den: [], no_le: [] }, grants: [], requests: [] };
    state.shops = [];
    state.route = 'quay';
    state.ui.wheelId = 'free';
    state.wheels = [wheel('shop', 'shop'), wheel('free', 'free')];
    state.spins = [
      {
        id: 's1',
        wheelId: 'free',
        byMember: 'm',
        itemsJson: JSON.stringify([{ weight: 1 }, { weight: 1 }]),
        resultIndex: 0,
        resultName: 'Cơm tấm',
        startedAt: Date.now() - 20_000,
        durationMs: 1000,
      },
    ];
  });

  it('một màn danh sách, lịch sử có người quay, không nút cũ', () => {
    const html = renderQuay();
    assert.match(html, /Danh sách/);
    assert.match(html, /Lịch sử quay/);
    assert.match(html, />Thêm</);
    assert.match(html, /Nhập cửa hàng/);
    assert.match(html, /Nhập món/);
    assert.match(html, />Quay</);
    assert.match(html, /Minh/);
    assert.match(html, /Cơm tấm/);
    assert.match(html, /data-chat-scope="wheel:free"/);
    assert.equal(
      /CHỐT QUÁN|GHI NGƯỜI ĐI LẤY|Xáo trộn|Xóa hết|Theo vote|Chia đều|data-act="equal"|data-act="by-vote"|data-act="set-winner"|data-act="set-pickup"|Giao diện|Cài đặt/.test(
        html,
      ),
      false,
    );
  });

  it('chưa chọn vòng thì mở danh sách tự do', () => {
    state.ui.wheelId = null;
    state.spins = [];
    const html = renderQuay();
    assert.match(html, /value="free"/);
    assert.equal(state.ui.wheelId, 'free');
    assert.doesNotMatch(html, /CHỐT QUÁN/);
  });
});
