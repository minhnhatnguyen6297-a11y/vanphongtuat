/** SVG paths lấy nguyên từ ViaHe-*.dc.html */

export const ICONS = {
  ban: `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18a9 9 0 0 1-18 0z"></path><path d="M13 3l-3 6M19 4l-6 5"></path></svg>`,
  quay: `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"></path><circle cx="12" cy="12" r="2.5" fill="currentColor"></circle></svg>`,
  tien: `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"></path><path d="M9 8h6M9 12h6M9 16h3"></path></svg>`,
  so: `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z"></path><path d="M5 17a2 2 0 0 1 2-2h12M9 7h6M9 11h4"></path></svg>`,
  kho: `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l2-5h14l2 5"></path><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"></path><path d="M5 12v9h14v-9M10 21v-5h4v5"></path></svg>`,
  sanh: `<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><path d="M14 17.5h7M17.5 14v7"></path></svg>`,
  copy: `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12"></rect><path d="M16 8V4H4v12h4"></path></svg>`,
  history: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5M12 7v5l3 2"></path></svg>`,
  screen: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="5" width="18" height="12"></rect><path d="M8 21h8M12 17v4"></path></svg>`,
  edit: `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#1B1B1B" stroke-width="2.5" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg>`,
  x: `<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="#1B1B1B" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  chevron: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#1B1B1B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"></path></svg>`,
  seat: (color: string) =>
    `<svg width="24" height="24" viewBox="0 0 30 30" aria-hidden="true"><path d="M5 8h20l-2 5H7z" fill="${color}" stroke="#1B1B1B" stroke-width="2" stroke-linejoin="round"></path><path d="M8 13l-3 14M22 13l3 14M10 20h10" fill="none" stroke="#1B1B1B" stroke-width="2" stroke-linecap="round"></path></svg>`,
  soundOn: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B1B1B" stroke-width="2.5" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#FFCF33"/><path d="M16 9c1.5 1.5 1.5 4.5 0 6"/><path d="M18.5 6.5c3 3 3 8 0 11"/></svg>`,
  soundOff: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B1B1B" stroke-width="2.5" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#FFCF33"/><path d="M16 9l5 6M21 9l-5 6"/></svg>`,
} as const;

export const SHOP_COLORS = ['#C62828', '#1F5FD1', '#1B7A43', '#F28C28', '#7B1FA2', '#00838F'] as const;

export const BANK_OPTIONS: { bin: string; name: string }[] = [
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970422', name: 'MB Bank' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970405', name: 'Agribank' },
  { bin: '970448', name: 'OCB' },
];
