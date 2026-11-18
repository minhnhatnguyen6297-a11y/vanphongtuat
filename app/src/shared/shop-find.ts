import { stripDiacritics } from './esc.ts';

export type ShopFindSource = {
  id: string;
  name: string;
  menu?: Array<{ name: string }>;
};

export type ShopFindHit = {
  id: string;
  name: string;
  matchedName: boolean;
  dishes: string[];
};

/** Bỏ dấu tiếng Việt rồi viết thường, để ô tìm so khớp không phân biệt dấu. */
export function foldShopQuery(value: string): string {
  return stripDiacritics(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Tìm trên snapshot quán (kèm menu). Khớp tên quán hoặc tên món.
 * `limit` mặc định 8 — trần danh sách kết quả, chưa phải số đã đo hiệu năng.
 */
export function findShops(shops: ShopFindSource[], query: string, limit = 8): ShopFindHit[] {
  const needle = foldShopQuery(query);
  if (!needle || limit <= 0) return [];
  const hits: ShopFindHit[] = [];
  for (const shop of shops) {
    const matchedName = foldShopQuery(shop.name).includes(needle);
    const dishes = (shop.menu ?? [])
      .filter((item) => foldShopQuery(item.name).includes(needle))
      .map((item) => item.name)
      .slice(0, 3);
    if (!matchedName && dishes.length === 0) continue;
    hits.push({ id: shop.id, name: shop.name, matchedName, dishes });
    if (hits.length >= limit) break;
  }
  return hits;
}
