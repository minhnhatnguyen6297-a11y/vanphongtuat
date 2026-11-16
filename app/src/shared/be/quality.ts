import type { QualityName } from './types.ts';

/**
 * Một bước, gọi mỗi ~5 giây. Không nhảy hai bậc.
 * Máy báo ≤ 4 GB RAM thì không tự lên Cao.
 * prefers-reduced-motion giữ Tĩnh.
 */
export function nextQuality(
  cur: QualityName,
  fps: number,
  deviceMemory: number | undefined,
  reducedMotion: boolean,
): QualityName {
  if (reducedMotion || cur === 'tinh') return 'tinh';
  const lowMem = deviceMemory != null && deviceMemory <= 4;
  if (cur === 'cao' && fps < 24) return 'vua';
  if (cur === 'vua' && fps < 24) return 'nhe';
  if (cur === 'nhe' && fps > 28) return 'vua';
  if (cur === 'vua' && fps > 28 && !lowMem) return 'cao';
  return cur;
}
