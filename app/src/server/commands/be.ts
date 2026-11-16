import type { Handler } from './types.ts';
import { getBeRuntime } from '../be/runtime.ts';
import { CmdError } from '../errors.ts';

function rt() {
  const runtime = getBeRuntime();
  if (!runtime) throw new CmdError('internal');
  return runtime;
}

export const beSaveDrawing: Handler = (ctx, args) => rt().saveDrawing(ctx.member, args);
export const beRelease: Handler = (ctx, args) => rt().release(ctx.member, args);
export const beFeed: Handler = (ctx) => rt().feed(ctx.member);
export const beClean: Handler = (ctx) => rt().clean(ctx.member);
export const beTweak: Handler = (ctx, args) => rt().tweak(ctx.member, args);
export const beMove: Handler = (ctx, args) => rt().move(ctx.member, args);
export const beRename: Handler = (ctx, args) => rt().rename(ctx.member, args);
export const beHide: Handler = (ctx, args) => rt().hide(ctx.member, args);
export const beReport: Handler = (ctx, args) => rt().report(ctx.member, args);
export const beUnlock: Handler = (ctx, args) => rt().unlock(ctx.member, args);
export const beGetDrawing: Handler = (ctx, args) => rt().getDrawing(ctx.member, args);
