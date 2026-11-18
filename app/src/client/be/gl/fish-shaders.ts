export const FISH_VERT = /* glsl */ `precision highp float;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform sampler2D uShape;   // R,G = pháp tuyến xy (0..1); B = độ phồng h (0..1)
uniform float uBendY;
uniform float uThick;       // nửa độ dày / chiều cao cá. Khởi điểm 0.20 [ƯỚC]
in vec3 position;           // x, y ∈ [-0.5, 0.5], z = 0
in vec2 uv;                 // 0..1 trong khung cá
in float aSide;             // +1 mặt trước, -1 mặt sau
in vec3 iPos; in vec3 iRot; in vec2 iSize; in vec3 iWave; in vec4 iAtlas;
in float iAlpha;
out float vAlpha;
out vec3 vAxis, vCap;
out vec2 vUv; out vec3 vWorld; out vec3 vN; out vec3 vT; out float vSide;

mat3 rotYPR(vec3 r) {                       // R = Ry(yaw) * Rz(pitch) * Rx(roll); mat3 theo cột
  float cy = cos(r.x), sy = sin(r.x), cp = cos(r.y), sp = sin(r.y), cr = cos(r.z), sr = sin(r.z);
  mat3 ry = mat3(cy, 0.0, -sy,  0.0, 1.0, 0.0,  sy, 0.0, cy);
  mat3 rz = mat3(cp, sp, 0.0,  -sp, cp, 0.0,  0.0, 0.0, 1.0);
  mat3 rx = mat3(1.0, 0.0, 0.0,  0.0, cr, sr,  0.0, -sr, cr);
  return ry * rz * rx;
}

void main() {
  vec2 auv = iAtlas.xy + uv * iAtlas.zw;
  float s = 0.5 - position.x;                          // 0 = mũi (x = +0.5), 1 = đuôi
  float env = 0.12 + 0.88 * s * s;                     // đầu gần như đứng yên
  float k = iWave.z * 6.2831853;
  float ang = k * s - iWave.x;                         // pha tăng → sóng chạy từ đầu về đuôi
  float bend = iWave.y * env * sin(ang);               // lệch ngang, theo L
  float slope = -iWave.y * (1.76 * s * sin(ang) + env * k * cos(ang));   // d(bend)/dx, vì ds/dx = -1
  float h = textureLod(uShape, auv, 0.0).b;
  vec3 p = vec3(position.x * iSize.x,
                position.y * iSize.y,
                bend * iSize.x + aSide * h * uThick * iSize.y);
  p.y += uBendY * iSize.x * env * sin(ang);
  vAlpha = iAlpha;
  mat3 R = rotYPR(iRot);
  // Both surfaces share a rounded section normal at the joined rim.
  // The projected tail should not introduce a hard lighting seam head-on.
  vec2 section = vec2(position.y * 2.0, aSide * h);
  vAxis = R * vec3(1.0, 0.0, 0.0);
  vCap = R * vec3(sqrt(max(0.0, 1.0 - dot(section, section))), section.x, section.y);
  vec3 w = iPos + R * p;
  vWorld = w;
  vT = R * normalize(vec3(1.0, 0.0, slope));
  vN = R * (normalize(vec3(-slope, 0.0, 1.0)) * aSide);
  vUv = auv;
  vSide = aSide;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

export const FISH_FRAG = /* glsl */ `precision highp float;
uniform sampler2D uColor;            // atlas màu, ĐÃ NHÂN ALPHA
uniform sampler2D uShape;
uniform sampler2D uCaustic;          // ô caustic bake (6.1), REPEAT, có mipmap
uniform sampler2D uScene;            // scene-map: R = độ sâu che, G = cát
uniform vec4 uSceneXform;            // sceneUv = gl_FragCoord.xy * xy + zw
uniform vec3 uCamPos, uLightDir;     // uLightDir đã chuẩn hóa, hướng VỀ phía nguồn sáng
uniform vec3 uKey, uAmbient, uRim, uFog, uAbsorb, uSandBounce;
uniform float uSurfaceY, uSandY, uGlassZ, uDepthRange, uFogPerUnit;
uniform float uCausticScale, uCausticGain, uSpec;
uniform vec4 uCausticScroll;         // xy lớp 1, zw lớp 2
in float vAlpha;
in vec3 vAxis, vCap;
in vec2 vUv; in vec3 vWorld; in vec3 vN; in vec3 vT; in float vSide;
out vec4 outColor;

void main() {
  vec4 tex = texture(uColor, vUv);
  if (tex.a < 0.02) discard;

  // Che bởi đá trong ảnh nền (mép mềm ~2% độ sâu).
  float myDepth = clamp((uGlassZ - vWorld.z) / uDepthRange, 0.0, 1.0);
  float sceneDepth = texture(uScene, gl_FragCoord.xy * uSceneXform.xy + uSceneXform.zw).r;
  float occ = sceneDepth >= 1.0 ? 1.0 : smoothstep(-0.02, 0.02, sceneDepth - myDepth);
  if (occ <= 0.0) discard;
  tex *= occ * vAlpha;

  // Pháp tuyến: mặt cong của thân (vN, vT) + độ phồng (normal map).
  vec2 nxy = texture(uShape, vUv).rg * 2.0 - 1.0;
  vec3 nT = vec3(nxy, sqrt(max(1.0 - dot(nxy, nxy), 0.0)));
  vec3 Ng = normalize(vN), Tg = normalize(vT);
  vec3 Bg = cross(Ng, Tg) * vSide;                   // mặt sau: z đảo, x/y giữ nguyên
  vec3 N = normalize(Tg * nT.x + Bg * nT.y + Ng * nT.z);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 axis = normalize(vAxis);
  float aim = dot(axis,V);
  vec3 capN = normalize(vCap + (sign(aim)-1.0)*dot(axis,vCap)*axis);
  N = normalize(mix(N,capN,smoothstep(0.58,0.98,abs(aim))));

  float wrap = clamp(dot(N, uLightDir) * 0.6 + 0.4, 0.0, 1.0);   // sáng bọc, không đen hẳn
  float c = 0.0;
#ifndef LITE
  vec2 cp = vWorld.xz * uCausticScale;
  c = min(texture(uCaustic, cp + uCausticScroll.xy).r,
          texture(uCaustic, cp * 1.37 + uCausticScroll.zw).r);
  c *= smoothstep(-0.1, 0.7, N.y);                   // chỉ mặt hướng lên nhận caustic
#endif
  float nearSand = 1.0 - smoothstep(0.0, 1.5, vWorld.y - uSandY);
  vec3 light = uAmbient + uKey * (wrap + c * uCausticGain)
             + uSandBounce * nearSand * max(-N.y, 0.0);          // cát hắt sáng lên bụng cá
  vec3 col = tex.rgb * light;
#ifndef LITE
  col += tex.a * uSpec * uKey * pow(max(dot(N, normalize(uLightDir + V)), 0.0), 40.0) * 0.25;
#endif
  col += tex.a * uRim * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.35;   // viền sáng
  col *= exp(-uAbsorb * max(uSurfaceY - vWorld.y, 0.0));            // càng sâu càng mất đỏ
  float fog = 1.0 - exp(-uFogPerUnit * max(uGlassZ - vWorld.z, 0.0));
  col = mix(col, uFog * tex.a, fog);                                 // sương theo quãng nước sau kính
  outColor = vec4(col, tex.a);                                       // premultiplied
}`;
