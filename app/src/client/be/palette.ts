export const DEFAULT_FISH_COLOR = '#268E99';

export const FISH_PALETTE = [
  ['#13110F','Mực'], ['#F5F7FA','Trắng'], ['#DED1AE','Kem'], ['#C4A484','Cát'],
  ['#EF5D48','Đỏ cam'], ['#F3B48C','Đào'], ['#F5C756','Vàng mật'], ['#E885AA','Hồng'],
  ['#825FA6','Tím'], ['#7A8FA3','Xanh khói'], ['#3977BF','Lam'], ['#8BC2C7','Xanh ngọc nhạt'],
  [DEFAULT_FISH_COLOR,'Xanh ngọc'], ['#397D61','Lá đậm'], ['#84AA64','Lá non'], ['#4A5560','Xám đá'],
] as const;

export function isFishColor(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color);
}
