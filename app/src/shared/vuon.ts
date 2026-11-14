/** Vườn — luật chăm và danh mục loài. Ngưỡng chỉ sửa ở VUON_GROWTH. */

export const VUON_TZ = 'Asia/Saigon';

/** Một chỗ duy nhất cho mốc lớn. careDays là tổng ngày được tính, không lùi. */
export const VUON_GROWTH = {
  truongThanhDays: 7,
  thanThoaiDays: 21,
} as const;

export type VuonKind = 'pet' | 'plant';
export type VuonStage = 'non' | 'truong_thanh' | 'than_thoai';
export type VuonSeason = 'xuan' | 'ha' | 'thu' | 'dong';
export type VuonExpression =
  | 'vui'
  | 'buon_ngu'
  | 'doi_nhe'
  | 'duoc_vuot_ve'
  | 'ngac_nhien'
  | 'man_nguyen';

/**
 * Tính cách chỉ bộc lộ ở cấp Thần thoại. Không phải chỉ số chơi.
 * Luật vẽ: docs/spec/vuon-design.md — cấm mặc định cánh + kim tuyến.
 */
export type VuonTemperament = 'dang_yeu' | 'tuoi_sang' | 'tram' | 'du_doi' | 'the_gioi';

export const VUON_STAGES: VuonStage[] = ['non', 'truong_thanh', 'than_thoai'];

export const VUON_STAGE_LABEL: Record<VuonStage, string> = {
  non: 'Non',
  truong_thanh: 'Trưởng thành',
  than_thoai: 'Thần thoại',
};

export const VUON_SEASON_LABEL: Record<VuonSeason, string> = {
  xuan: 'Xuân',
  ha: 'Hạ',
  thu: 'Thu',
  dong: 'Đông',
};

export const VUON_EXPRESSION_LABEL: Record<VuonExpression, string> = {
  vui: 'Đang vui',
  buon_ngu: 'Buồn ngủ',
  doi_nhe: 'Hơi đói',
  duoc_vuot_ve: 'Được vuốt ve',
  ngac_nhien: 'Ngạc nhiên',
  man_nguyen: 'Mãn nguyện',
};

export type VuonSpecies = {
  id: string;
  kind: VuonKind;
  art: boolean;
  temper: VuonTemperament;
  blurb: string;
  names: Record<VuonStage, string>;
};

type SpeciesSeed = {
  id: string;
  kind: VuonKind;
  art: boolean;
  temper: VuonTemperament;
  blurb: string;
  names: [string, string, string];
};

function species(seed: SpeciesSeed): VuonSpecies {
  return {
    id: seed.id,
    kind: seed.kind,
    art: seed.art,
    temper: seed.temper,
    blurb: seed.blurb,
    names: {
      non: seed.names[0],
      truong_thanh: seed.names[1],
      than_thoai: seed.names[2],
    },
  };
}

/** art: true = đã có tranh đủ 3 cấp. Còn lại hiện khung TODO. temper đã gán sẵn để lần vẽ sau không kéo về một motif. */
const SEEDS: SpeciesSeed[] = [
  speciesRow('meo', 'pet', true, 'dang_yeu', 'Mèo trắng, tròn, thích được tựa vào.', ['Mèo non', 'Mèo', 'Mèo bông']),
  speciesRow('corgi', 'pet', true, 'tuoi_sang', 'Cún nắng, vui và sáng.', ['Cún non', 'Corgi', 'Corgi nắng']),
  speciesRow('tho', 'pet', true, 'tram', 'Thỏ nguyệt, đứng yên là đủ.', ['Thỏ non', 'Thỏ', 'Thỏ nguyệt']),
  speciesRow('koi', 'pet', true, 'du_doi', 'Koi của dòng nước mạnh.', ['Koi non', 'Cá koi', 'Rồng koi']),
  speciesRow('cao', 'pet', false, 'du_doi', 'Cáo nhỏ, đuôi bông.', ['Cáo non', 'Cáo', 'Cửu vĩ hồ']),
  speciesRow('chim', 'pet', false, 'tuoi_sang', 'Chim sẻ đậu trên hàng rào.', ['Sẻ non', 'Chim sẻ', 'Phượng']),
  speciesRow('rua', 'pet', false, 'tram', 'Rùa đi chậm, không vội.', ['Rùa non', 'Rùa', 'Huyền quy']),
  speciesRow('trau', 'pet', false, 'du_doi', 'Trâu đứng mát dưới bóng tre.', ['Nghé', 'Trâu', 'Thần ngưu']),
  speciesRow('soc', 'pet', false, 'dang_yeu', 'Sóc giấu hạt, rồi quên.', ['Sóc non', 'Sóc', 'Sóc thần']),
  speciesRow('hac', 'pet', false, 'tram', 'Hạc đứng một chân bên hồ.', ['Hạc non', 'Hạc', 'Hạc thần']),
  speciesRow('vit', 'pet', false, 'dang_yeu', 'Vịt bơi theo vòng nước.', ['Vịt non', 'Vịt', 'Vịt thần']),
  speciesRow('nai', 'pet', false, 'tuoi_sang', 'Nai đứng giữa hoa.', ['Nai non', 'Nai', 'Nai thần']),
  speciesRow('sen', 'plant', true, 'tuoi_sang', 'Sen nở trong nắng sớm.', ['Chồi sen', 'Sen', 'Sen rạng']),
  speciesRow('mai', 'plant', true, 'tram', 'Mai cổ, cành già, hoa kín.', ['Chồi mai', 'Mai', 'Mai cổ']),
  speciesRow('tre', 'plant', true, 'du_doi', 'Tre trong gió lớn.', ['Măng', 'Tre', 'Tre bão']),
  speciesRow('sung', 'plant', true, 'the_gioi', 'Sung lớn chậm. Đủ ngày thì thành cây thế giới.', ['Chồi sung', 'Sung', 'Cây thế giới']),
  speciesRow('dao', 'plant', false, 'tuoi_sang', 'Đào hồng, nở một mùa.', ['Chồi đào', 'Đào', 'Đào rạng']),
  speciesRow('bonsai', 'plant', false, 'tram', 'Bonsai nhỏ, thế vững.', ['Bonsai non', 'Bonsai', 'Bonsai cổ']),
  speciesRow('huong-duong', 'plant', false, 'tuoi_sang', 'Hướng dương quay theo nắng.', ['Mầm hướng dương', 'Hướng dương', 'Hướng dương thần']),
  speciesRow('dau-tay', 'plant', false, 'dang_yeu', 'Dâu đỏ, ăn một quả là vui.', ['Mầm dâu', 'Dâu tây', 'Dâu thần']),
  speciesRow('cam-tu-cau', 'plant', false, 'tram', 'Cẩm tú cầu đổi màu theo đất.', ['Chồi tú cầu', 'Cẩm tú cầu', 'Tú cầu tĩnh']),
  speciesRow('tu-dang', 'plant', false, 'tram', 'Tử đằng rủ tím trên hiên.', ['Chồi tử đằng', 'Tử đằng', 'Tử đằng cổ']),
  speciesRow('anh-dao', 'plant', false, 'tuoi_sang', 'Anh đào, cánh rơi chậm.', ['Chồi anh đào', 'Anh đào', 'Anh đào rạng']),
  speciesRow('lan', 'plant', false, 'tram', 'Lan nở ít, thơm lâu.', ['Chồi lan', 'Lan', 'Lan cổ']),
];

function speciesRow(
  id: string,
  kind: VuonKind,
  art: boolean,
  temper: VuonTemperament,
  blurb: string,
  names: [string, string, string],
): SpeciesSeed {
  return { id, kind, art, temper, blurb, names };
}

export const VUON_SPECIES: VuonSpecies[] = SEEDS.map(species);

export const VUON_ART_IDS = ['meo', 'corgi', 'tho', 'koi', 'sen', 'mai', 'tre', 'sung'] as const;

export function speciesById(id: string): VuonSpecies | undefined {
  return VUON_SPECIES.find((s) => s.id === id);
}

export function speciesOf(kind: VuonKind): VuonSpecies[] {
  return VUON_SPECIES.filter((s) => s.kind === kind);
}

export function stageFromCareDays(days: number): VuonStage {
  const n = Number.isFinite(days) ? days : 0;
  if (n >= VUON_GROWTH.thanThoaiDays) return 'than_thoai';
  if (n >= VUON_GROWTH.truongThanhDays) return 'truong_thanh';
  return 'non';
}

export type CareSnap = { careDays: number; lastCareOn: string | null };

export type CareNext = CareSnap & { counted: boolean; stage: VuonStage };

/**
 * Một loài, một ngày, một lần được tính. Cùng ngày thì counted = false.
 * careDays không bao giờ nhỏ hơn số đang có (sau khi số âm được kéo về 0).
 */
export function applyDailyCare(prev: CareSnap, today: string): CareNext {
  const base = Math.max(0, Math.floor(Number.isFinite(prev.careDays) ? prev.careDays : 0));
  if (prev.lastCareOn === today) {
    return { careDays: base, lastCareOn: today, counted: false, stage: stageFromCareDays(base) };
  }
  const careDays = base + 1;
  return { careDays, lastCareOn: today, counted: true, stage: stageFromCareDays(careDays) };
}

export type ZonedParts = { year: number; month: number; day: number; hour: number };

export function zonedParts(date: Date, timeZone = VUON_TZ): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  let hour = num('hour');
  if (hour === 24) hour = 0;
  return { year: num('year'), month: num('month'), day: num('day'), hour };
}

export function saigonDateString(date: Date): string {
  const p = zonedParts(date);
  const m = String(p.month).padStart(2, '0');
  const d = String(p.day).padStart(2, '0');
  return `${p.year}-${m}-${d}`;
}

/** Khí hậu miền Bắc: xuân 2–4, hạ 5–7, thu 8–10, đông 11–1. */
export function seasonFromMonth(month: number): VuonSeason {
  if (month >= 2 && month <= 4) return 'xuan';
  if (month >= 5 && month <= 7) return 'ha';
  if (month >= 8 && month <= 10) return 'thu';
  return 'dong';
}

export function seasonFromDate(date: Date): VuonSeason {
  return seasonFromMonth(zonedParts(date).month);
}

/** Ngày từ 6:00 đến trước 18:00 giờ Sài Gòn. Ngoài khoảng đó là đêm. */
export function isNight(date: Date): boolean {
  const hour = zonedParts(date).hour;
  return hour < 6 || hour >= 18;
}

const STAGE_FILE: Record<VuonStage, string> = {
  non: 'non',
  truong_thanh: 'truong-thanh',
  than_thoai: 'than-thoai',
};

export function spriteUrl(s: VuonSpecies, stage: VuonStage): string | null {
  if (!s.art) return null;
  const folder = s.kind === 'pet' ? 'pet' : 'plant';
  return `/art/vuon/${folder}/${s.id}-${STAGE_FILE[stage]}.webp`;
}

export function seasonBackground(season: VuonSeason): string {
  return `/art/vuon/bg/${season}.webp`;
}

export function moodUrl(expr: VuonExpression): string {
  return `/art/vuon/mood/${expr}.webp`;
}

export type VuonRow = {
  memberId: string;
  speciesId: string;
  careDays: number;
  lastCareOn: string | null;
};

export function careOf(rows: VuonRow[], memberId: string, speciesId: string): VuonRow {
  return (
    rows.find((r) => r.memberId === memberId && r.speciesId === speciesId) ?? {
      memberId,
      speciesId,
      careDays: 0,
      lastCareOn: null,
    }
  );
}

export type VuonCareResult = {
  ownerId: string;
  speciesId: string;
  kind: VuonKind;
  careDays: number;
  lastCareOn: string;
  counted: boolean;
  stage: VuonStage;
};
