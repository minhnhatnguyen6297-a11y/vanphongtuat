const MAX_EDGE = 1600;
const MAX_BYTES = 2 * 1024 * 1024;
const QUALITY = 0.8;

export type ImageBlob = { blob: Blob; url: string; mime: string };

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const f = input.files?.[0] || null;
      input.remove();
      resolve(f);
    });
    input.click();
  });
}

export async function chooseImage(): Promise<ImageBlob | null> {
  const file = await pickFile();
  if (!file) return null;
  return resizeImage(file);
}

/** Đọc ảnh từ clipboard API (nút Dán). Không dùng getDisplayMedia. */
export async function readClipboardImage(): Promise<ImageBlob | null> {
  try {
    if (!navigator.clipboard || !('read' in navigator.clipboard)) return null;
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (!type) continue;
      const blob = await item.getType(type);
      return resizeImage(blob);
    }
  } catch {
    return null;
  }
  return null;
}

export function bindPaste(handler: (img: ImageBlob) => void): () => void {
  const onPaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        const img = await resizeImage(file);
        if (img) handler(img);
        return;
      }
    }
  };
  document.addEventListener('paste', onPaste);
  return () => document.removeEventListener('paste', onPaste);
}

export async function resizeImage(source: Blob): Promise<ImageBlob | null> {
  const bitmap = await createImageBitmap(source);
  let { width, height } = bitmap;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let q = QUALITY;
  let blob = await canvasToJpeg(canvas, q);
  while (blob.size > MAX_BYTES && q > 0.4) {
    q -= 0.1;
    blob = await canvasToJpeg(canvas, q);
  }
  if (blob.size > MAX_BYTES) {
    // scale down further
    canvas.width = Math.round(width * 0.75);
    canvas.height = Math.round(height * 0.75);
    ctx.drawImage(await createImageBitmap(source), 0, 0, canvas.width, canvas.height);
    blob = await canvasToJpeg(canvas, 0.7);
  }
  return { blob, url: URL.createObjectURL(blob), mime: 'image/jpeg' };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality,
    );
  });
}
