import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { calibrateCamera, coverImage, sceneUvTransform } from '../../src/client/be/fish-math.js';

const markers = { horizonV: 0.68, surfaceV: 0.12, fishShadowV: [0.82, 0.93] as const };
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('shifted camera sends a horizontal ray to the covered horizon', () => {
  for (const [width, height] of [[1366,768], [1920,1080], [1000,900]] as const) {
    const cover = coverImage(1672, 941, width, height);
    const pose = calibrateCamera(cover, markers);
    const camera = new PerspectiveCamera(pose.fov, width / height, 0.1, 100);
    camera.projectionMatrix.elements[9] = pose.lensShiftY;
    near(new Vector3(0, 0, -100).project(camera).y, pose.horizonNdc);
    near((1 - new Vector3(0, -pose.height, -pose.front).project(camera).y) / 2,
      (markers.fishShadowV[1] - cover.top) / cover.height);
  }
});

test('cover crop and bottom-left fragment coordinates agree with the image', () => {
  const cover = coverImage(1600, 900, 800, 800);
  const [sx, sy, ox, oy] = sceneUvTransform(cover, 400, 400);
  near(200 * sx + ox, 0.5);
  near(0 * sy + oy, 1);
  near(400 * sy + oy, 0);
  assert.ok(ox > 0);
  const wide = coverImage(1600, 900, 1600, 600);
  const [, vScale, , vOffset] = sceneUvTransform(wide, 1600, 600);
  near(vOffset, 5 / 6);
  near(600 * vScale + vOffset, 1 / 6);
});
