/** Separable box blur on tightly packed RGBA bytes. Radius is in pixels. */
export function boxBlurRGBA(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
): Uint8ClampedArray {
  const r = Math.max(1, Math.round(radius));
  const span = r * 2 + 1;
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let a = 0;
      let b = 0;
      let c = 0;
      let d = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        const i = (y * w + xx) * 4;
        a += src[i]!;
        b += src[i + 1]!;
        c += src[i + 2]!;
        d += src[i + 3]!;
      }
      const o = (y * w + x) * 4;
      tmp[o] = a / span;
      tmp[o + 1] = b / span;
      tmp[o + 2] = c / span;
      tmp[o + 3] = d / span;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let a = 0;
      let b = 0;
      let c = 0;
      let d = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        const i = (yy * w + x) * 4;
        a += tmp[i]!;
        b += tmp[i + 1]!;
        c += tmp[i + 2]!;
        d += tmp[i + 3]!;
      }
      const o = (y * w + x) * 4;
      out[o] = a / span;
      out[o + 1] = b / span;
      out[o + 2] = c / span;
      out[o + 3] = d / span;
    }
  }
  return out;
}
