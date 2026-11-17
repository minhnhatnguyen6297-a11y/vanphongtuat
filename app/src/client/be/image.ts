export const IMPORT_MAX_BYTES = 4 * 1024 * 1024;
export const IMPORT_MAX_EDGE = 4096;

const IMPORT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** Null when the file may be decoded. Size is checked before decode. */
export function importFileError(file: { size: number; type: string; name: string }): string | null {
  const name = file.name.toLowerCase();
  const extOk = name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp');
  if ((!file.type || !IMPORT_TYPES.includes(file.type)) && !extOk) return 'Chỉ PNG, JPG, WebP';
  if (file.type && !IMPORT_TYPES.includes(file.type)) return 'Chỉ PNG, JPG, WebP';
  if (file.size > IMPORT_MAX_BYTES) return 'Ảnh lớn hơn 4MB';
  return null;
}

/** Checked after the browser decodes the file. 4096 on each edge is allowed. */
export function importEdgeError(width: number, height: number): string | null {
  if (width < 1 || height < 1) return 'Không đọc được ảnh';
  if (width > IMPORT_MAX_EDGE || height > IMPORT_MAX_EDGE) return 'Mỗi chiều tối đa 4096px';
  return null;
}

export function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
