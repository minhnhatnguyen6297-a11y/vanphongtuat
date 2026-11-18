type Markers = { horizonV: number; surfaceV: number; fishShadowV: readonly number[] };

export function coverImage(imageW: number, imageH: number, cssW: number, cssH: number) {
  const fit = Math.max(cssW / imageW, cssH / imageH);
  const width = cssW / (imageW * fit);
  const height = cssH / (imageH * fit);
  return { width, height, left: (1 - width) / 2, top: (1 - height) / 2 };
}

export function sceneUvTransform(cover: ReturnType<typeof coverImage>, pixelW: number, pixelH: number) {
  return [cover.width / pixelW, -cover.height / pixelH, cover.left, cover.top + cover.height] as const;
}

export function calibrateCamera(cover: ReturnType<typeof coverImage>, markers: Markers) {
  const fov = 45;
  const front = 10;
  const back = 17;
  const tanHalfFov = Math.tan(fov * Math.PI / 360);
  const screenV = (v: number) => (v - cover.top) / cover.height;
  const horizon = screenV(markers.horizonV);
  const horizonNdc = 1 - 2 * horizon;
  const height = 2 * (screenV(markers.fishShadowV[1]!) - horizon) * tanHalfFov * front;
  const surfaceY = height + 2 * (horizon - screenV(markers.surfaceV)) * tanHalfFov * front;
  return { fov, front, back, height, surfaceY, horizonNdc, lensShiftY: -horizonNdc, tanHalfFov };
}
