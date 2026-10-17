import * as THREE from "three";
import { skyState } from "@/lib/sky";

// The main city's water and ground, shared with other maps (the Brasil town):
// the water's shader (per-pixel ripples, sun or moon glints, sky at grazing
// angles; see SFMapLayers' Water) and the ground's procedural relief.

export function makeWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color("#0c2230") },
        uShallow: { value: new THREE.Color("#163f52") },
        uSky: { value: new THREE.Color("#0a1428") },
        uSunDir: { value: new THREE.Vector3(0.28, 0.86, 0.42) },
        uSunCol: { value: new THREE.Color("#cfe0ff") },
        uNight: { value: 1 },
      },
    ]),
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWPos;
      #include <common>
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        // tiny large-scale swell only — stays well below the shoreline
        wp.y += sin(wp.x*0.004 + uTime*0.5)*0.3 + sin(wp.z*0.005 - uTime*0.4)*0.3;
        vWPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSunCol;
      uniform vec3 uSunDir; uniform float uNight; uniform float uTime;
      varying vec3 vWPos;
      #include <common>
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        vec3 toCam = cameraPosition - vWPos;
        float dist = length(toCam);
        vec3 V = toCam / max(dist, 1e-4);
        // per-pixel ripple normal, faded out in the distance to keep far water calm
        float fade = clamp(1.0 - dist / 3500.0, 0.0, 1.0);
        vec2 p = vWPos.xz; float t = uTime;
        // gentle, low-slope ripples (kept small so the sheen reads as subtle
        // shimmer instead of bright criss-cross streaks)
        vec2 d = vec2(sin(p.x*0.045 + t*1.0), sin(p.y*0.05 - t*0.85)) * 0.14;
        d += vec2(sin((p.x+p.y)*0.08 + t*1.5), sin((p.x-p.y)*0.07 - t*1.2)) * 0.08;
        d += vec2(sin(p.x*0.15 - t*1.8), sin(p.y*0.13 + t*1.4)) * 0.04;
        d *= fade;
        vec3 N = normalize(vec3(-d.x, 1.0, -d.y));
        // key light: real sun by day, an overhead moon by night (sunDir is below
        // the horizon at night, so blend to an up-ish dir to keep the sheen alive)
        vec3 L = normalize(mix(normalize(uSunDir), vec3(0.30, 0.92, 0.20), uNight));
        float ndl = max(dot(N, L), 0.0);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 col = mix(uDeep, uShallow, clamp(0.30 + 0.35*ndl, 0.0, 1.0));
        col += uSky * 0.06 * (N.y*0.5 + 0.5);          // soft hemispheric fill
        col = mix(col, uSky * 1.1, fres * 0.35);       // faint sky reflection at grazing
        // tight, faint specular — small glints riding the ripples, not streaks
        float spec = pow(max(dot(N, normalize(L + V)), 0.0), 220.0);
        col += uSunCol * spec * 0.22 * fade;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

/** Advances the water's ripples and keeps its light in step with the sky (skyState). */
export function tickWater(m: THREE.ShaderMaterial, dt: number) {
  m.uniforms.uTime.value = (m.uniforms.uTime.value as number) + dt;
  const s = skyState;
  (m.uniforms.uSunDir.value as THREE.Vector3).set(s.sunDir[0], s.sunDir[1], s.sunDir[2]);
  (m.uniforms.uSunCol.value as THREE.Color).setRGB(s.sunColor[0], s.sunColor[1], s.sunColor[2]);
  (m.uniforms.uSky.value as THREE.Color).setRGB(s.skyHorizon[0], s.skyHorizon[1], s.skyHorizon[2]);
  m.uniforms.uNight.value = s.nightFactor;
}


export function patchGround(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vGPos;")
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  vGPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      /* glsl */ `#include <common>
      varying vec3 vGPos;
      float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gNoise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(gHash(i), gHash(i+vec2(1.0,0.0)), u.x),
                   mix(gHash(i+vec2(0.0,1.0)), gHash(i+vec2(1.0,1.0)), u.x), u.y);
      }
      float gFbm(vec2 p){ float v=0.0,a=0.5; for(int k=0;k<4;k++){ v+=a*gNoise(p); p*=2.0; a*=0.5; } return v; }`,
    )
    .replace(
      "#include <normal_fragment_begin>",
      /* glsl */ `#include <normal_fragment_begin>
      {
        vec2 q = vGPos.xz;
        float e = 6.0;
        float gx = gNoise((q + vec2(e,0.0))*0.012) - gNoise((q - vec2(e,0.0))*0.012);
        float gz = gNoise((q + vec2(0.0,e))*0.012) - gNoise((q - vec2(0.0,e))*0.012);
        normal = normalize(normal + mat3(viewMatrix) * vec3(-gx, 0.0, -gz) * 3.5);
      }`,
    )
    .replace(
      "#include <map_fragment>",
      /* glsl */ `#include <map_fragment>
      diffuseColor.rgb *= 0.80 + 0.42 * gFbm(vGPos.xz * 0.0045);        // large-scale mottle
      diffuseColor.rgb *= 0.94 + 0.12 * gNoise(vGPos.xz * 0.06);        // fine grain`,
    );
}
