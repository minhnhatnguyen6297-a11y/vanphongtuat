export class CmdError extends Error {
  readonly code: string;
  readonly extra: Record<string, unknown>;

  constructor(code: string, extra: Record<string, unknown> = {}) {
    super(code);
    this.name = 'CmdError';
    this.code = code;
    this.extra = extra;
  }

  toAck(opId: string) {
    return { t: 'ack' as const, opId, ok: false as const, error: this.code, ...this.extra };
  }
}
