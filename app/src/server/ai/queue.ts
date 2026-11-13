import { randomUUID } from 'node:crypto';
import type { Db } from '../db.ts';
import { nowIso } from '../db.ts';
import { createProvider, type AiKind, type AiProvider } from './provider.ts';

const MAX_WAITING = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

type Job = {
  id: string;
  kind: AiKind;
  memberId: string;
  image: Buffer;
  mime: string;
  resolve: (v: { jobId: string }) => void;
  reject: (e: Error) => void;
};

export type AiQueue = {
  enqueue: (
    db: Db,
    kind: AiKind,
    memberId: string,
    image: Buffer,
    mime: string,
  ) => Promise<{ jobId: string }>;
  enabled: () => boolean;
  setNotify: (fn: (memberId: string, msg: unknown) => void) => void;
};

export function createAiQueue(provider?: AiProvider | null): AiQueue {
  const prov = provider === undefined ? createProvider() : provider;
  const waiting: Job[] = [];
  let running: Job | null = null;
  let bytesInRam = 0;
  let notify: (memberId: string, msg: unknown) => void = () => {};

  function finishJob(db: Db, job: Job, ok: boolean, result?: unknown, error?: string) {
    bytesInRam -= job.image.length;
    // clear image buffer
    job.image.fill(0);
    (job as { image: Buffer | null }).image = null as unknown as Buffer;

    db.prepare(
      `UPDATE ai_jobs SET status = ?, finished_at = ?, result_json = ?, error = ? WHERE id = ?`,
    ).run(
      ok ? 'done' : 'error',
      nowIso(),
      result != null ? JSON.stringify(result) : null,
      error ?? null,
      job.id,
    );

    notify(job.memberId, {
      t: 'ai',
      jobId: job.id,
      ok,
      ...(ok ? { result } : { error: error || 'ai_error' }),
    });
  }

  async function pump(db: Db) {
    if (running || !waiting.length) return;
    if (!prov) return;
    running = waiting.shift()!;
    const job = running;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      db.prepare(`UPDATE ai_jobs SET status = ? WHERE id = ?`).run('running', job.id);
      const result = await prov.read(job.kind, job.image, job.mime, ac.signal);
      finishJob(db, job, true, result);
      job.resolve({ jobId: job.id });
    } catch (e) {
      const err = e instanceof Error ? e.message : 'ai_error';
      const isTimeout = ac.signal.aborted;
      finishJob(db, job, false, undefined, isTimeout ? 'timeout' : err);
      // job already resolved with jobId at enqueue; just notify via WS
    } finally {
      clearTimeout(timer);
      running = null;
      void pump(db);
    }
  }

  return {
    enabled: () => !!prov,
    setNotify: (fn) => {
      notify = fn;
    },
    enqueue(db, kind, memberId, image, mime) {
      if (!prov) return Promise.reject(Object.assign(new Error('ai_disabled'), { code: 'ai_disabled' }));
      if (waiting.length >= MAX_WAITING) {
        return Promise.reject(Object.assign(new Error('busy'), { code: 'busy' }));
      }
      if (bytesInRam + image.length > MAX_BYTES) {
        return Promise.reject(Object.assign(new Error('busy'), { code: 'busy' }));
      }

      const id = randomUUID();
      db.prepare(
        `INSERT INTO ai_jobs(id, kind, member_id, status, created_at) VALUES(?,?,?,?,?)`,
      ).run(id, kind, memberId, 'queued', nowIso());

      bytesInRam += image.length;

      return new Promise<{ jobId: string }>((resolve, reject) => {
        const job: Job = { id, kind, memberId, image, mime, resolve, reject };
        waiting.push(job);
        resolve({ jobId: id });
        void pump(db);
      });
    },
  };
}
