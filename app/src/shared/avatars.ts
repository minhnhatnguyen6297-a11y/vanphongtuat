/** Bộ mặt hoạt hình đóng gói — Neo-Brutalism, không phụ thuộc CDN. */

export const AVATAR_IDS = ['meo', 'cho', 'cao', 'gau', 'ech', 'heo', 'vit', 'robot'] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

export const AVATAR_LABELS: Record<AvatarId, string> = {
  meo: 'Mèo',
  cho: 'Chó',
  cao: 'Cáo',
  gau: 'Gấu',
  ech: 'Ếch',
  heo: 'Heo',
  vit: 'Vịt',
  robot: 'Robot',
};

export function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === 'string' && (AVATAR_IDS as readonly string[]).includes(v);
}

/** SVG inline 64×64 — viền mực, màu ViaHe. */
export function avatarSvg(id: AvatarId | string | null | undefined): string {
  const key = isAvatarId(id) ? id : null;
  if (!key) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="#FFCF33" stroke="#1B1B1B" stroke-width="3"/>
      <circle cx="24" cy="28" r="3" fill="#1B1B1B"/>
      <circle cx="40" cy="28" r="3" fill="#1B1B1B"/>
      <path d="M24 40c4 4 12 4 16 0" fill="none" stroke="#1B1B1B" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }
  const faces: Record<AvatarId, string> = {
    meo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="22" fill="#F28C28" stroke="#1B1B1B" stroke-width="3"/>
      <path d="M14 22l6 12 8-4zM50 22l-6 12-8-4z" fill="#F28C28" stroke="#1B1B1B" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="24" cy="32" r="3" fill="#1B1B1B"/><circle cx="40" cy="32" r="3" fill="#1B1B1B"/>
      <path d="M28 40h8l-4 5z" fill="#C62828" stroke="#1B1B1B" stroke-width="2"/>
      <path d="M22 44c5 5 15 5 20 0" fill="none" stroke="#1B1B1B" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
    cho: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="34" rx="22" ry="20" fill="#FFCF33" stroke="#1B1B1B" stroke-width="3"/>
      <ellipse cx="12" cy="28" rx="7" ry="10" fill="#F28C28" stroke="#1B1B1B" stroke-width="3"/>
      <ellipse cx="52" cy="28" rx="7" ry="10" fill="#F28C28" stroke="#1B1B1B" stroke-width="3"/>
      <circle cx="24" cy="32" r="3" fill="#1B1B1B"/><circle cx="40" cy="32" r="3" fill="#1B1B1B"/>
      <ellipse cx="32" cy="40" rx="5" ry="3.5" fill="#1B1B1B"/>
      <path d="M24 46c4 3 12 3 16 0" fill="none" stroke="#1B1B1B" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
    cao: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="36" r="20" fill="#F28C28" stroke="#1B1B1B" stroke-width="3"/>
      <path d="M16 18l8 14h-6zM48 18l-8 14h6z" fill="#F28C28" stroke="#1B1B1B" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="24" cy="34" r="3" fill="#1B1B1B"/><circle cx="40" cy="34" r="3" fill="#1B1B1B"/>
      <path d="M26 44c3 4 9 4 12 0" fill="none" stroke="#1B1B1B" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="32" cy="40" r="2.5" fill="#FFF4D6" stroke="#1B1B1B" stroke-width="2"/>
    </svg>`,
    gau: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="16" cy="18" r="9" fill="#1B1B1B"/><circle cx="48" cy="18" r="9" fill="#1B1B1B"/>
      <circle cx="32" cy="34" r="22" fill="#FFF4D6" stroke="#1B1B1B" stroke-width="3"/>
      <circle cx="24" cy="32" r="3.5" fill="#1B1B1B"/><circle cx="40" cy="32" r="3.5" fill="#1B1B1B"/>
      <ellipse cx="32" cy="42" rx="6" ry="4" fill="#1B1B1B"/>
      <path d="M26 48c3 2 9 2 12 0" fill="none" stroke="#1B1B1B" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    ech: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="36" rx="24" ry="18" fill="#1B7A43" stroke="#1B1B1B" stroke-width="3"/>
      <circle cx="20" cy="22" r="8" fill="#1B7A43" stroke="#1B1B1B" stroke-width="3"/>
      <circle cx="44" cy="22" r="8" fill="#1B7A43" stroke="#1B1B1B" stroke-width="3"/>
      <circle cx="20" cy="22" r="3" fill="#1B1B1B"/><circle cx="44" cy="22" r="3" fill="#1B1B1B"/>
      <path d="M24 42c4 6 12 6 16 0" fill="none" stroke="#1B1B1B" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    heo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="22" fill="#F28C28" stroke="#1B1B1B" stroke-width="3"/>
      <circle cx="14" cy="24" r="7" fill="#C62828" stroke="#1B1B1B" stroke-width="3"/>
      <circle cx="50" cy="24" r="7" fill="#C62828" stroke="#1B1B1B" stroke-width="3"/>
      <circle cx="24" cy="30" r="3" fill="#1B1B1B"/><circle cx="40" cy="30" r="3" fill="#1B1B1B"/>
      <ellipse cx="32" cy="42" rx="9" ry="7" fill="#FFF4D6" stroke="#1B1B1B" stroke-width="3"/>
      <circle cx="28" cy="42" r="1.8" fill="#1B1B1B"/><circle cx="36" cy="42" r="1.8" fill="#1B1B1B"/>
    </svg>`,
    vit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="20" fill="#FFCF33" stroke="#1B1B1B" stroke-width="3"/>
      <path d="M42 36c8 0 14-2 16-6-2 8-8 12-16 12z" fill="#F28C28" stroke="#1B1B1B" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="26" cy="30" r="3" fill="#1B1B1B"/>
      <path d="M22 44c5 4 14 4 18 0" fill="none" stroke="#1B1B1B" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
    robot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="12" y="18" width="40" height="36" rx="4" fill="#1F5FD1" stroke="#1B1B1B" stroke-width="3"/>
      <rect x="28" y="8" width="8" height="12" fill="#FFCF33" stroke="#1B1B1B" stroke-width="3"/>
      <rect x="18" y="28" width="10" height="8" fill="#FFCF33" stroke="#1B1B1B" stroke-width="2"/>
      <rect x="36" y="28" width="10" height="8" fill="#FFCF33" stroke="#1B1B1B" stroke-width="2"/>
      <rect x="22" y="42" width="20" height="6" fill="#FFF4D6" stroke="#1B1B1B" stroke-width="2"/>
    </svg>`,
  };
  return faces[key];
}
