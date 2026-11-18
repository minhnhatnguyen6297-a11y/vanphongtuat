import type { RouteId } from '../store.js';

const ink = '#13110F';
const paper = '#FDF7EB';
const red = '#EF3C35';
const gold = '#FFDA2E';
const blue = '#1D63E1';
const green = '#145C34';
const orange = '#F78D38';

function art(body: string): string {
  return `<svg viewBox="0 0 112 92" aria-hidden="true" focusable="false">
    <g stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</g>
  </svg>`;
}

export const ROOM_ART: Partial<Record<RouteId, string>> = {
  ban: art(`
    <path d="M23 20l-4-6m13 1-1-8m-15 21-7-3" fill="none"/>
    <path d="M23 40l17-15h53L78 40z" fill="#FF6851"/>
    <path d="M24 41h55v38H24z" fill="${red}"/>
    <path d="M79 41l14-15v37L79 79z" fill="#BD2821"/>
    <path d="M17 38h61v13H17z" fill="#FF6851"/>
    <path d="M78 38l17-13v14L78 51z" fill="${red}"/>
    <path d="M43 34h25" stroke-width="4"/>
    <path d="M42 33l8-23h27l-9 23z" fill="${paper}"/>
    <path d="M53 21l4 4 10-10" fill="none" stroke="${red}"/>`),
  quay: art(`
    <g transform="translate(55 50)">
      <path d="M0 0V-31A31 31 0 0 1 26.85-15.5z" fill="${red}"/>
      <path d="M0 0L26.85-15.5A31 31 0 0 1 26.85 15.5z" fill="${blue}"/>
      <path d="M0 0L26.85 15.5A31 31 0 0 1 0 31z" fill="#32A65B"/>
      <path d="M0 0V31A31 31 0 0 1 -26.85 15.5z" fill="${gold}"/>
      <path d="M0 0L-26.85 15.5A31 31 0 0 1 -26.85-15.5z" fill="${red}"/>
      <path d="M0 0L-26.85-15.5A31 31 0 0 1 0-31z" fill="${gold}"/>
      <circle r="31" fill="none"/><circle r="6" fill="${gold}"/>
    </g>
    <path d="M47 8h16l-8 18z" fill="${red}"/>
    <path d="M91 20l4-6m-1 15 8-4m-6 13 8-1" fill="none"/>`),
  tien: art(`
    <path d="M41 17l-4-7m14 4V6m10 10 5-6" fill="none"/>
    <path d="M13 59l31 23 54-22v-7L67 31 13 53z" fill="${green}"/>
    <path d="M13 52l31 23 54-22v-7L67 24 13 46z" fill="#269D55"/>
    <path d="M13 46l31 23 54-22v-8L67 16 13 39z" fill="#38B861"/>
    <path d="M13 39l31 23 54-23-31-23z" fill="#77D383"/>
    <path d="M35 30l33 23v19l15-6V47L50 24z" fill="#D3F29D"/>
    <path d="M27 40l10-4m9 17 10-4m19-11 10-4" fill="none" stroke="${green}"/>
    <ellipse cx="59" cy="41" rx="7" ry="4" fill="#F2F9C7"/>`),
  chat: art(`
    <path d="M30 28h50c15 11 22 21 20 35-3 18-18 21-45 21S18 77 14 62c-4-13 3-25 16-34z" fill="#52CDED"/>
    <path d="M29 27c10-4 42-5 53 0" fill="none" stroke="${paper}" stroke-width="5"/>
    <path d="M25 64q8 4 16 2" fill="none" stroke="${paper}"/>
    <path d="M32 48l-9-6v12zM42 67l-8-5v10zM63 56l-7-5v10z" fill="${orange}"/>
    <ellipse cx="42" cy="48" rx="11" ry="6" fill="${orange}"/>
    <ellipse cx="51" cy="67" rx="10" ry="6" fill="${gold}"/>
    <ellipse cx="71" cy="56" rx="8" ry="5" fill="${red}"/>
    <path d="M47 47h.1m9 19h.1m19-11h.1" stroke-width="3"/>
    <path d="M82 77q-10-8-3-13 3 5 3 12 1-10 8-14-1 9-7 15" fill="#54BE66" stroke-width="2"/>
    <path d="M75 10c0-7 9-9 18-9 12 0 17 3 17 10 0 9-6 11-18 11l-10 7 2-8c-7-2-9-5-9-11z" fill="${paper}"/>
    <path d="M84 12h.1m8 0h.1m8 0h.1" stroke-width="3.5"/>`),
  so: art(`
    <path d="M18 28l29-11 12 4 25-10 9 56-26 10-13-4-27 11z" fill="#F2C484"/>
    <path d="M15 21l30-11 13 6 24-10 9 55-25 11-12-5-29 12z" fill="${paper}"/>
    <path d="M45 10l9 57M25 30l16-6m-14 14 15-6m-13 14 14-6m-12 14 14-6m11-25 16-6m-14 14 16-6m-15 14 15-6" fill="none" stroke-width="2"/>
    <path d="M18 28q-10-2-5 7m8 6q-10-2-5 7m8 6q-10-2-5 7m8 5q-10-2-5 7" fill="none" stroke="${red}"/>
    <circle cx="86" cy="62" r="22" fill="${red}"/><circle cx="86" cy="62" r="16" fill="${paper}"/>
    <path d="M86 51v11l8-5" fill="none"/>`),
  kho: art(`
    <path d="M21 32h70v47H21z" fill="${gold}"/>
    <path d="M67 46h18v23H67z" fill="#66CEF5"/><path d="M69 65l14-15" fill="none" stroke="${paper}" stroke-width="2"/>
    <path d="M46 49h15v30H46z" fill="#F5A03B"/>
    <path d="M30 47v21m-4-20v7q4 5 8 0v-7m6 1q-6 10 0 12v8" fill="none" stroke-width="2.3"/>
    <path d="M25 12h63l11 20-5 8h-76l-5-8z" fill="${red}"/>
    <path d="M36 12h11l-3 20q-5 12-12 0zM57 12h11l3 20q-6 11-13 0zM79 12h9l11 20q-5 10-12 0z" fill="#FFEF9A"/>
    <path d="M13 32h86M16 80h80" fill="none"/>
    <path d="M11 78q-1-9 7-8 0-7 6-3 5 3 5 11zm72 0q0-9 6-7 2-8 8-5 5 3 5 12z" fill="#45BD61"/>`),
  sanh: art(`
    <g transform="rotate(12 70 43)">
      <rect x="42" y="10" width="56" height="63" rx="3" fill="${paper}"/>
      <path d="M62 17v47m16-47v47M48 31h43M48 47h43" stroke="#6C746D" stroke-width="1.6"/>
      <path d="M49 19l10 9m0-10-10 11m30 23 10 10m0-10-10 11" stroke="${red}"/>
      <circle cx="71" cy="40" r="5" stroke="${blue}" fill="none"/>
      <circle cx="87" cy="24" r="5" stroke="${blue}" fill="none"/>
    </g>
    <path d="M12 55l20-12 20 11-1 20-18 12-21-11z" fill="${paper}"/>
    <path d="M12 55l21 11 19-12M33 66v20" fill="none"/>
    <path d="M32 54h.1m-13 9h.1m7 10h.1m15 1h.1m5-10h.1" stroke-width="4"/>`),
  quyen: art(`
    <path d="M22 30l-7-6m12-2-2-9m-9 26-9-1" fill="none"/>
    <path d="M62 36A22 22 0 1 1 80 54L52 69l-2 9-10-3-10 7-8-3-5-10z" fill="${gold}"/>
    <path d="M20 73l51-31" fill="none" stroke="#D48C18" stroke-width="4"/>
    <circle cx="81" cy="33" r="7" fill="${paper}"/>
    <path d="M73 20q8-5 14-1" fill="none" stroke="#FFF5AA"/>`),
};
