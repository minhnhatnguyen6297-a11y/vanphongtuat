import { openModal } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { esc } from '../shared/esc.js';

/** Clipboard + fallback modal textarea. Không dùng execCommand. */
export async function copyText(text: string, okMsg = 'Đã copy'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
    return;
  } catch {
    /* fallback */
  }
  openModal({
    title: 'Ctrl+C',
    bodyHtml: `<textarea class="hn-input" rows="8" style="font-family:var(--font-mono);min-height:160px">${esc(text)}</textarea>
      <p style="margin:8px 0 0;font-weight:800">Bôi đen sẵn — nhấn Ctrl+C</p>`,
    onMount: (root) => {
      const ta = root.querySelector('textarea');
      if (ta) {
        ta.focus();
        ta.select();
      }
    },
  });
}
