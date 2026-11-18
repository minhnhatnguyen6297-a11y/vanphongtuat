import * as THREE from 'three';

const VERT = /* glsl */ `precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export function bakeCaustic(renderer: THREE.WebGLRenderer, size = 512): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
  });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: /* glsl */ `precision highp float;
in vec2 vUv; out vec4 outColor;
const float CELLS = 8.0;
vec2 hash2(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
float cellEdge(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash2(mod(i + g, CELLS));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
void main() {
  float e = cellEdge(vUv * CELLS);
  float c = pow(clamp(1.0 - e * 2.2, 0.0, 1.0), 5.0);
  outColor = vec4(vec3(c), 1.0);
}`,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(mesh);
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(null);
  mesh.geometry.dispose();
  mat.dispose();
  rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping;
  return rt;
}
