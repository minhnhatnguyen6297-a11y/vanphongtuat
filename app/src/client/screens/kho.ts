import { esc, fmtK, stripDiacritics } from '../../shared/esc.js';
import { parseMapsName } from '../../shared/maps.js';
import { SHOP_TYPE_LABELS, type ShopType } from '../../shared/types.js';
import { state, patch, canPerm } from '../store.js';
import { ICONS } from '../icons.js';
import { cmd } from '../ws.js';
import { chooseImage, type ImageBlob } from '../image.js';
import { apiAi } from '../api.js';
import { waitAi } from '../ws.js';
import { toast } from '../ui/toast.js';

const TYPE_COLOR: Record<string, string> = {
  no: '#C62828',
  vat: '#FFCF33',
  uong: '#1B7A43',
  '': '#1B1B1B',
};

let khoFocus: 'shop' | 'menu' = 'menu';
let aiTouched = { name: false, phone: false, menu: false };

export function titleKho(): { chip: string; fun: string } {
  return { chip: `${state.shops.length} QUÁN`, fun: 'KHO QUÁN RUỘT!' };
}

export async function handleKhoImage(img: ImageBlob, kind: 'shop' | 'menu'): Promise<void> {
  const res = await apiAi(kind === 'shop' ? 'shop' : 'menu', img.blob);
  if (res.status === 503 || res.error === 'ai_disabled') {
    toast('AI chưa bật, nhập tay nhé');
    return;
  }
  if (res.status === 429) {
    toast('AI đang bận, thử lại sau chút');
    return;
  }
  if (!res.jobId) return;
  const ai = await waitAi(res.jobId);
  if (!ai.ok || !ai.result) return;
  if (kind === 'shop') {
    const r = ai.result as { name: string | null; phone: string | null };
    patch((s) => {
      if (!aiTouched.name && r.name) s.ui.khoForm.name = r.name;
      if (!aiTouched.phone && r.phone) s.ui.khoForm.phone = r.phone;
    });
  } else {
    const r = ai.result as { items: { name: string; price: number | null }[] };
    if (!aiTouched.menu && r.items) {
      patch((s) => {
        s.ui.khoForm.menu = r.items.slice(0, 60);
      });
    }
  }
}

export function renderKho(): string {
  const form = state.ui.khoForm;
  const editing = state.ui.khoEditId;
  const filter = state.ui.khoFilter;

  const typeChips = (['no', 'vat', 'uong'] as const)
    .map((k) => {
      const on = form.type === k;
      return `<button type="button" role="radio" aria-checked="${on}" data-type="${k}" style="flex:1;font-family:var(--font-body);font-size:14px;font-weight:800;background:${on ? '#1B1B1B' : '#fff'};color:${on ? '#FFF4D6' : '#1B1B1B'};border:2px solid #1B1B1B;padding:6px;min-height:44px;cursor:pointer">${SHOP_TYPE_LABELS[k]}</button>`;
    })
    .join('');

  const menuChips = form.menu
    .map(
      (m, i) =>
        `<span style="display:flex;align-items:center;gap:6px;border:2px solid #1B1B1B;background:#FFF4D6;padding:2px 2px 2px 8px;font-size:13px;font-weight:800">
          <button type="button" data-edit-menu="${i}" style="border:0;background:transparent;cursor:pointer;font-weight:800;padding:4px">${esc(m.name)} <span style="font-family:var(--font-mono);font-size:12px">${esc(fmtK(m.price))}</span></button>
          <button type="button" data-del-menu="${i}" aria-label="Bỏ" style="width:32px;height:32px;background:transparent;border:0;cursor:pointer;font-weight:800">×</button>
        </span>`,
    )
    .join('');

  const filters = [
    { id: 'all', label: 'Tất cả' },
    { id: 'no', label: 'Ăn no' },
    { id: 'vat', label: 'Ăn vặt' },
    { id: 'uong', label: 'Đồ uống' },
  ]
    .map((f) => {
      const on = filter === f.id;
      return `<button type="button" data-filter="${f.id}" aria-pressed="${on}" style="font-family:var(--font-body);font-size:14px;font-weight:800;background:${on ? '#1B1B1B' : '#fff'};color:${on ? '#FFF4D6' : '#1B1B1B'};border:3px solid #1B1B1B;padding:4px 12px;min-height:44px;cursor:pointer">${f.label}</button>`;
    })
    .join('');

  const list = state.shops
    .filter((s) => filter === 'all' || s.type === filter)
    .map((s) => {
      const head = TYPE_COLOR[s.type] || '#1B1B1B';
      const typeLabel = s.type ? SHOP_TYPE_LABELS[s.type as Exclude<ShopType, ''>] : 'Khác';
      const phone = s.phone?.trim() || '';
      return `<li class="hn-shop-row" style="border-left-color:${head}">
        <span class="hn-shop-row-name">${esc(s.name)}</span>
        <span class="hn-shop-row-type">${esc(typeLabel)}</span>
        ${
          phone
            ? `<a class="hn-shop-row-phone" href="tel:${esc(phone.replace(/\s/g, ''))}">${esc(phone)}</a>`
            : `<span class="hn-shop-row-phone is-empty" aria-hidden="true">0000 000 000</span>`
        }
        <span class="hn-shop-row-actions">
          ${
            canPerm('table.addShop')
              ? `<button type="button" class="hn-btn hn-btn-ink" data-add-table="${s.id}" style="min-height:40px;font-size:13px;box-shadow:none;font-family:var(--font-body)" title="Thêm quán này vào bàn hiện tại">+ VÀO BÀN</button>`
              : ''
          }
          <button type="button" data-edit="${s.id}" aria-label="Sửa ${esc(s.name)}" style="background:#fff;border:2px solid #1B1B1B;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center">${ICONS.edit}</button>
          ${
            canPerm('shop.delete')
              ? `<button type="button" class="hn-btn hn-btn-white" data-del-shop="${s.id}" aria-label="Xóa ${esc(s.name)}" style="min-height:40px;font-size:12px;box-shadow:none">XÓA</button>`
              : ''
          }
        </span>
      </li>`;
    })
    .join('');

  return `<main class="hn-main">
    <div class="hn-two-col-tien">
      <section class="hn-panel-yellow" style="display:flex;flex-direction:column;gap:10px">
        <h2 class="hn-h2" style="font-size:20px">${editing ? 'SỬA QUÁN' : '+ THÊM QUÁN'}</h2>
        <div style="display:flex;gap:6px">
          <input class="hn-input" id="kho-paste" data-focus="shop" value="${esc(form.paste)}" placeholder="Link Maps hoặc dán ảnh → AI đọc quán" style="flex:1;border-style:dashed;border-width:3px;min-height:48px">
          <button type="button" class="hn-btn hn-btn-ink" data-act="fill" style="min-height:48px;box-shadow:none">ĐIỀN</button>
        </div>
        <p class="hn-hint" style="margin:0">AI: Ctrl+V ảnh quán vào ô trên, hoặc dùng nút menu bên dưới.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label style="flex:2 1 180px;display:flex;flex-direction:column;gap:2px;font-size:13px;font-weight:800">Tên quán
            <input class="hn-input" id="kho-name" value="${esc(form.name)}" style="font-weight:700">
          </label>
          <label style="flex:1 1 140px;display:flex;flex-direction:column;gap:2px;font-size:13px;font-weight:800">SĐT
            <input class="hn-input" id="kho-phone" type="tel" value="${esc(form.phone)}" style="font-family:var(--font-mono)">
          </label>
        </div>
        <div role="radiogroup" aria-label="Loại" style="display:flex;gap:6px">${typeChips}</div>
        <div style="background:#fff;border:2px solid #1B1B1B;padding:8px;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-family:var(--font-display);font-size:13px;margin-right:auto">MENU</span>
            <button type="button" class="hn-btn hn-btn-white" data-act="paste-menu" style="min-height:40px;font-size:13px">AI · Ctrl+V ảnh</button>
            <button type="button" class="hn-btn hn-btn-white" data-act="pick-menu" style="min-height:40px;font-size:13px">AI · Chọn ảnh</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px" data-focus="menu">${menuChips}
            <button type="button" class="hn-btn-ghost" data-act="add-menu" style="min-height:36px">+ món</button>
          </div>
        </div>
        <button type="button" class="hn-btn hn-btn-red" data-act="save" style="font-size:16px;min-height:52px;box-shadow:4px 4px 0 #1B1B1B">LƯU VÀO KHO</button>
        ${editing ? `<button type="button" class="hn-btn hn-btn-white" data-act="cancel-edit" style="font-size:14px;min-height:44px">HỦY SỬA</button>` : ''}
      </section>
      <section style="display:flex;flex-direction:column;gap:10px">
        <div role="group" aria-label="Lọc loại" style="display:flex;flex-wrap:wrap;gap:6px">${filters}</div>
        <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px">${list}</ul>
      </section>
    </div>
  </main>`;
}

function syncFormFromDom(root: HTMLElement): void {
  const name = (root.querySelector('#kho-name') as HTMLInputElement)?.value ?? '';
  const phone = (root.querySelector('#kho-phone') as HTMLInputElement)?.value ?? '';
  const paste = (root.querySelector('#kho-paste') as HTMLInputElement)?.value ?? '';
  state.ui.khoForm.name = name;
  state.ui.khoForm.phone = phone;
  state.ui.khoForm.paste = paste;
}

export function bindKho(root: HTMLElement): void {
  root.querySelector('#kho-paste')?.addEventListener('focus', () => {
    khoFocus = 'shop';
  });
  root.querySelector('[data-focus="menu"]')?.addEventListener('focusin', () => {
    khoFocus = 'menu';
  });

  root.querySelector('#kho-name')?.addEventListener('input', () => {
    aiTouched.name = true;
  });
  root.querySelector('#kho-phone')?.addEventListener('input', () => {
    aiTouched.phone = true;
  });

  root.querySelectorAll('[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = (btn as HTMLElement).dataset.type as '' | 'no' | 'vat' | 'uong';
      patch((s) => {
        s.ui.khoForm.type = s.ui.khoForm.type === t ? '' : t;
      });
    });
  });

  root.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      patch((s) => {
        s.ui.khoFilter = (btn as HTMLElement).dataset.filter as typeof s.ui.khoFilter;
      });
    });
  });

  root.querySelector('[data-act="fill"]')?.addEventListener('click', () => {
    syncFormFromDom(root);
    const paste = state.ui.khoForm.paste.trim();
    const name = parseMapsName(paste);
    if (name) {
      patch((s) => {
        s.ui.khoForm.name = name;
        s.ui.khoForm.mapsUrl = paste;
      });
      aiTouched.name = true;
    } else {
      toast('Dán link Maps hoặc ảnh');
    }
  });

  root.querySelector('[data-act="pick-menu"]')?.addEventListener('click', async () => {
    khoFocus = 'menu';
    const img = await chooseImage();
    if (img) await handleKhoImage(img, 'menu');
  });

  root.querySelector('[data-act="paste-menu"]')?.addEventListener('click', () => {
    khoFocus = 'menu';
    toast('Dán ảnh bằng Ctrl+V');
  });

  root.querySelector('[data-act="add-menu"]')?.addEventListener('click', () => {
    const name = prompt('Tên món');
    if (!name) return;
    const priceRaw = prompt('Giá (đồng, để trống nếu không rõ)');
    const price = priceRaw ? Number(priceRaw) : null;
    aiTouched.menu = true;
    patch((s) => {
      s.ui.khoForm.menu.push({ name, price: Number.isFinite(price as number) ? price : null });
    });
  });

  root.querySelectorAll('[data-del-menu]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number((btn as HTMLElement).dataset.delMenu);
      aiTouched.menu = true;
      patch((s) => {
        s.ui.khoForm.menu.splice(i, 1);
      });
    });
  });

  root.querySelectorAll('[data-edit-menu]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number((btn as HTMLElement).dataset.editMenu);
      const item = state.ui.khoForm.menu[i];
      if (!item) return;
      const name = prompt('Tên món', item.name);
      if (name == null) return;
      const priceRaw = prompt('Giá', item.price == null ? '' : String(item.price));
      if (priceRaw == null) return;
      aiTouched.menu = true;
      patch((s) => {
        s.ui.khoForm.menu[i] = {
          name,
          price: priceRaw === '' ? null : Number(priceRaw),
        };
      });
    });
  });

  root.querySelector('[data-act="cancel-edit"]')?.addEventListener('click', () => {
    aiTouched = { name: false, phone: false, menu: false };
    patch((s) => {
      s.ui.khoEditId = null;
      s.ui.khoForm = { name: '', phone: '', type: '', mapsUrl: '', menu: [], paste: '' };
    });
  });

  root.querySelectorAll('[data-del-shop]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.delShop!;
      if (!canPerm('shop.delete')) return;
      if (!confirm('Xóa quán này khỏi kho?')) return;
      const ack = await cmd('shop.delete', { id });
      if (!ack.ok) {
        toast('Xóa lỗi');
        return;
      }
      toast('Đã xóa quán');
      if (state.ui.khoEditId === id) {
        patch((s) => {
          s.ui.khoEditId = null;
          s.ui.khoForm = { name: '', phone: '', type: '', mapsUrl: '', menu: [], paste: '' };
        });
      }
    });
  });

  root.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
    syncFormFromDom(root);
    const f = state.ui.khoForm;
    if (!f.name.trim()) {
      toast('Thiếu tên quán');
      return;
    }
    const norm = stripDiacritics(f.name).toLowerCase();
    const dup = state.shops.find(
      (s) =>
        s.id !== state.ui.khoEditId &&
        stripDiacritics(s.name).toLowerCase() === norm,
    );
    if (dup) {
      toast('Trùng tên quán rồi');
      return;
    }
    const ack = await cmd('shop.upsert', {
      id: state.ui.khoEditId || undefined,
      name: f.name.trim(),
      phone: f.phone.trim() || null,
      type: f.type,
      mapsUrl: f.mapsUrl || null,
    });
    const id =
      (ack.result as { id?: string } | undefined)?.id ||
      state.ui.khoEditId ||
      state.shops.find((s) => s.name === f.name.trim())?.id;
    if (id) {
      await cmd('shop.setMenu', {
        shopId: id,
        items: f.menu.map((m) => ({ name: m.name, price: m.price })),
      });
    }
    toast('Đã lưu');
    aiTouched = { name: false, phone: false, menu: false };
    patch((s) => {
      s.ui.khoEditId = null;
      s.ui.khoForm = { name: '', phone: '', type: '', mapsUrl: '', menu: [], paste: '' };
    });
  });

  root.querySelectorAll('[data-add-table]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!state.table) {
        toast('Chưa có bàn');
        return;
      }
      await cmd('table.addShop', { shopId: (btn as HTMLElement).dataset.addTable });
      toast('Đã thêm vào bàn');
    });
  });

  root.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.edit!;
      const s = state.shops.find((x) => x.id === id);
      if (!s) return;
      aiTouched = { name: true, phone: true, menu: true };
      patch((st) => {
        st.ui.khoEditId = id;
        st.ui.khoForm = {
          name: s.name,
          phone: s.phone || '',
          type: s.type,
          mapsUrl: s.mapsUrl || '',
          menu: s.menu.map((m) => ({ name: m.name, price: m.price })),
          paste: s.mapsUrl || '',
        };
      });
    });
  });
}

export function getKhoPasteTarget(): 'shop' | 'menu' {
  return khoFocus;
}
