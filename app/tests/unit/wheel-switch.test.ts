import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../src/client/store.ts';
import { bindQuay, renderQuay, resetWheelSpinForTests } from '../../src/client/screens/quay.ts';

type Face = { style: { transform: string; transition: string; setProperty: (k: string, v: string) => void } };

const queue: { id: number; fn: FrameRequestCallback }[] = [];
let nextId = 1;
let clock = 0;
let faces: Record<string, Face> = {};
let shown = 'A';

function makeFace(transform = ''): Face {
  return {
    style: {
      transform,
      transition: '',
      setProperty() {},
    },
  };
}

function installDom(): void {
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: { now: () => clock },
  });
  Object.assign(globalThis, {
    window: { matchMedia: () => ({ matches: false }) },
    requestAnimationFrame: (fn: FrameRequestCallback) => {
      const id = nextId++;
      queue.push({ id, fn });
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      const i = queue.findIndex((q) => q.id === id);
      if (i >= 0) queue.splice(i, 1);
    },
    document: {
      getElementById: (id: string) => (id === 'wheel-face' ? faces[shown] : null),
    },
  });
}

function flush(): boolean {
  const job = queue.shift();
  if (!job) return false;
  job.fn(clock);
  return true;
}

function deg(transform: string): number {
  const m = /rotate\(([-\d.]+)deg\)/.exec(transform);
  return m ? Number(m[1]) : Number.NaN;
}

function wheel(id: string) {
  return {
    id,
    title: id,
    kind: 'free' as const,
    version: 1,
    tableId: null,
    createdBy: 'm',
    items: [
      { id: `${id}1`, wheelId: id, name: 'Một', weight: 1, refShopId: null, refMemberId: null, votes: null, sort: 0 },
      { id: `${id}2`, wheelId: id, name: 'Hai', weight: 1, refShopId: null, refMemberId: null, votes: null, sort: 1 },
    ],
  };
}

function spin(id: string, wheelId: string, resultIndex: number) {
  return {
    id,
    wheelId,
    byMember: 'm',
    itemsJson: JSON.stringify([{ weight: 1 }, { weight: 1 }]),
    resultIndex,
    resultName: id,
    startedAt: Date.now(),
    durationMs: 4300,
  };
}

const root = {
  querySelector: () => null,
  querySelectorAll: () => [],
} as unknown as HTMLElement;

installDom();

describe('chuyển vòng khi đang quay', { concurrency: 1 }, () => {
  beforeEach(() => {
    resetWheelSpinForTests();
    queue.length = 0;
    clock = 0;
    nextId = 1;
    faces = { A: makeFace(), B: makeFace('rotate(0deg)') };
    shown = 'A';
    state.route = 'quay';
    state.wheels = [wheel('A'), wheel('B')];
    state.spins = [];
    state.ui.wheelId = 'A';
  });

  it('A đang quay rồi chọn B đứng yên: B không xoay theo A', () => {
    state.spins = [spin('spinA', 'A', 0)];
    bindQuay(root);
    assert.equal(flush(), true);
    clock = 800;
    assert.equal(flush(), true);
    const aAngle = deg(faces.A!.style.transform);
    assert.ok(aAngle > 0);

    state.ui.wheelId = 'B';
    shown = 'B';
    bindQuay(root);
    assert.equal(queue.length, 0);
    clock = 1600;
    assert.equal(flush(), false);
    assert.equal(faces.B!.style.transform, 'rotate(0deg)');

    const html = renderQuay();
    assert.match(html, /id="wheel-face"[^>]*transform:rotate\(0deg\)/);
    assert.equal(html.includes(`rotate(${aAngle}deg)`), false);
  });

  it('A đang quay rồi chọn B đang quay: B theo B, quay lại A giữ đồng hồ', () => {
    state.spins = [spin('spinB', 'B', 1), spin('spinA', 'A', 0)];
    bindQuay(root);
    assert.equal(flush(), true);
    clock = 400;
    assert.equal(flush(), true);
    const aMid = deg(faces.A!.style.transform);
    assert.equal(queue.length, 1);
    bindQuay(root);
    assert.equal(queue.length, 1);
    assert.equal(flush(), true);
    assert.equal(deg(faces.A!.style.transform), aMid);

    clock = 900;
    assert.equal(flush(), true);
    const aLater = deg(faces.A!.style.transform);
    assert.ok(aLater > aMid);

    state.ui.wheelId = 'B';
    shown = 'B';
    bindQuay(root);
    assert.equal(queue.length, 1);
    clock = 900;
    assert.equal(flush(), true);
    const bAtSwitch = deg(faces.B!.style.transform);
    assert.ok(bAtSwitch < aLater / 2);
    assert.notEqual(faces.B!.style.transform, faces.A!.style.transform);

    clock = 2000;
    assert.equal(flush(), true);
    const bLater = deg(faces.B!.style.transform);
    assert.ok(bLater > bAtSwitch);

    state.ui.wheelId = 'A';
    shown = 'A';
    bindQuay(root);
    clock = 2000;
    assert.equal(flush(), true);
    const aBack = deg(faces.A!.style.transform);
    assert.ok(aBack > aLater);
  });

  it('rời màn quay thì khung sau không vẽ lên vòng khác', () => {
    state.spins = [spin('spinA', 'A', 0)];
    bindQuay(root);
    assert.equal(flush(), true);
    clock = 300;
    assert.equal(flush(), true);
    const painted = faces.A!.style.transform;
    state.route = 'home';
    shown = 'B';
    clock = 700;
    assert.equal(flush(), true);
    assert.equal(faces.B!.style.transform, 'rotate(0deg)');
    assert.equal(faces.A!.style.transform, painted);
    assert.equal(queue.length, 0);
  });
});
