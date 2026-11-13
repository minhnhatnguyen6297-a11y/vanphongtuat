import { z } from 'zod';
import { config } from '../config.ts';

export type AiKind = 'bill' | 'menu' | 'shop';

export interface AiProvider {
  read(
    kind: AiKind,
    image: Buffer,
    mime: string,
    signal: AbortSignal,
  ): Promise<unknown>;
}

export const BillResult = z.object({ total: z.number().int().nullable() });
export const MenuResult = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      price: z.number().int().nullable(),
    }),
  ),
});
export const ShopResult = z.object({
  name: z.string().nullable(),
  phone: z.string().nullable(),
});

export function validateAiResult(kind: AiKind, raw: unknown): unknown {
  if (kind === 'bill') return BillResult.parse(raw);
  if (kind === 'menu') return MenuResult.parse(raw);
  return ShopResult.parse(raw);
}

function promptFor(kind: AiKind): string {
  if (kind === 'bill') {
    return 'Đọc hoá đơn tiếng Việt. Trả JSON duy nhất {"total":number|null} là số tiền khách phải trả (đồng). Không markdown.';
  }
  if (kind === 'menu') {
    return 'Đọc thực đơn tiếng Việt. Trả JSON duy nhất {"items":[{"name":string,"price":number|null}]} giá tính bằng đồng. Không markdown.';
  }
  return 'Đọc ảnh quán. Trả JSON duy nhất {"name":string|null,"phone":string|null}. Không markdown.';
}

export class ClaudeProvider implements AiProvider {
  constructor(
    private key: string,
    private model: string,
  ) {}

  async read(kind: AiKind, image: Buffer, mime: string, signal: AbortSignal): Promise<unknown> {
    const mediaType =
      mime === 'image/png'
        ? 'image/png'
        : mime === 'image/webp'
          ? 'image/webp'
          : 'image/jpeg';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: image.toString('base64'),
                },
              },
              { type: 'text', text: promptFor(kind) },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`claude_http_${res.status}:${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = body.content?.find((c) => c.type === 'text')?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('claude_bad_json');
    return validateAiResult(kind, JSON.parse(jsonMatch[0]));
  }
}

export class StubProvider implements AiProvider {
  async read(kind: AiKind, _image: Buffer, _mime: string, _signal: AbortSignal): Promise<unknown> {
    if (kind === 'bill') return { total: null };
    if (kind === 'menu') return { items: [] };
    return { name: null, phone: null };
  }
}

export function createProvider(): AiProvider | null {
  if (!config.aiKey) return null;
  if (config.aiProvider === 'stub') return new StubProvider();
  return new ClaudeProvider(config.aiKey, config.aiModel);
}
