'use strict';

/* ================= the orb =================
   Replaces the login screen's stacked CSS gradients with a real shaded sphere.

   Why raw WebGL and no library: there is exactly one object, it has no geometry
   (the sphere is solved analytically in the fragment shader) and no textures, so
   three.js at ~155KB or OGL at ~29KB would both be paying for a scene graph this
   never uses. This file is about 4KB and the project keeps its no-build, no-
   dependency character.

   It is deliberately calm. This sits behind the sign-in form, so the middle of
   the sphere stays quiet and the light collects at the rim.

   Everything is best-effort. If there is no WebGL, if the shader fails to
   compile, or if the user asked for reduced motion, the canvas is discarded and
   the existing CSS orb is left exactly as it was. */
(function orb(){
  const wrap = document.getElementById('orbWrap');
  if (!wrap) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cv = document.createElement('canvas');
  cv.id = 'orbCanvas';
  cv.setAttribute('aria-hidden', 'true');

  const gl = cv.getContext('webgl', {
    alpha:true, premultipliedAlpha:false, antialias:false,
    depth:false, stencil:false, powerPreference:'high-performance'
  }) || cv.getContext('experimental-webgl', { alpha:true, premultipliedAlpha:false });
  if (!gl) return;

  const VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){ vUv = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  /* mediump throughout: half precision is materially faster on mobile GPUs and
     nothing here needs the range.

     No value noise anywhere, deliberately. The first version domain-warped an
     fbm across the surface, and at this size that reads as polished marble
     rather than as something lit from within. The light inside is built from
     a couple of slow sines of the surface normal instead: smooth, cheap, and
     calm enough to sit behind the sign-in form.

     The other rule here is that brightness belongs at the RIM. The form sits
     over the middle of the orb, so the middle stays quiet and the energy
     gathers where glass actually gathers it. */
  const FRAG = [
    'precision mediump float;',
    'varying vec2 vUv;',
    'uniform float uT;',
    'uniform vec3 cA, cB, cC;',

    'void main(){',
    '  vec2 uv = vUv;',
    '  float r2 = dot(uv, uv);',
    '  float d = sqrt(r2);',
    '  float R = 0.80;',
    '  vec3 col = vec3(0.0);',
    '  float alpha = 0.0;',

    '  if (d < R + 0.004){',
    '    float z = sqrt(max(R * R - r2, 0.0));',
    '    vec3 n = normalize(vec3(uv, z));',
    '    vec3 V = vec3(0.0, 0.0, 1.0);',
    '    vec3 L = normalize(vec3(-0.42, 0.55, 0.72));',

    /* slow light moving through the glass, low frequency on purpose */
    '    float s1 = sin(n.x * 2.3 + uT * 0.19) * cos(n.y * 1.9 - uT * 0.15);',
    '    float s2 = sin((n.x + n.y) * 1.5 - uT * 0.11);',
    '    float swirl = 0.5 + 0.25 * s1 + 0.25 * s2;',

    '    float diff = max(dot(n, L), 0.0);',
    '    float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);',
    '    float spec = pow(max(dot(reflect(-L, n), V), 0.0), 48.0);',

    /* body: rose low, violet high, the swirl only nudging the boundary */
    '    float t = clamp(0.5 + 0.55 * n.y + 0.22 * (swirl - 0.5), 0.0, 1.0);',
    '    vec3 body = mix(cA, cB, t);',
    '    col = body * (0.42 + 0.52 * diff);',

    /* light gathering at the edge, the way it does through a glass bead */
    '    col += mix(cB, cA, 0.5) * fres * 1.25;',
    '    col += cC * fres * fres * 0.30;',

    /* one tight highlight, plus a soft bounce from low and right */
    '    col += vec3(1.0) * spec * 0.55;',
    '    col += cA * pow(max(dot(n, normalize(vec3(0.5, -0.6, 0.6))), 0.0), 6.0) * 0.16;',

    '    alpha = smoothstep(R, R - 0.012, d);',
    '  }',

    /* A close halo rather than a wide one. The first version spread alpha far
       past the silhouette, which fogged the panel behind it. */
    '  float halo = exp(-max(d - R, 0.0) * 13.0);',
    '  vec3 hc = mix(cA, cB, 0.5 + 0.5 * sin(uT * 0.18));',
    '  col += hc * halo * 0.30;',
    '  alpha = max(alpha, halo * 0.30);',

    '  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));',
    '}'
  ].join('\n');

  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      /* surfaced on purpose: a silent blank orb is much harder to diagnose */
      console.warn('orb shader failed:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = vs && compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)){
    console.warn('orb program failed:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uT = gl.getUniformLocation(prog, 'uT');
  const uA = gl.getUniformLocation(prog, 'cA');
  const uB = gl.getUniformLocation(prog, 'cB');
  const uC = gl.getUniformLocation(prog, 'cC');

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  /* ---- palette, read from the theme ---- */
  function rgb(str, fallback){
    str = (str || '').trim();
    let m = /^#([0-9a-f]{3})$/i.exec(str);
    if (m) return [0,1,2].map(i => parseInt(m[1][i] + m[1][i], 16) / 255);
    m = /^#([0-9a-f]{6})$/i.exec(str);
    if (m) return [0,2,4].map(i => parseInt(m[1].substr(i, 2), 16) / 255);
    m = /rgba?\(([^)]+)\)/i.exec(str);
    if (m){ const p = m[1].split(','); return [0,1,2].map(i => parseFloat(p[i]) / 255); }
    return fallback;
  }
  function readPalette(){
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n);
    gl.useProgram(prog);
    gl.uniform3fv(uA, rgb(g('--rose'),  [0.83, 0.35, 0.54]));
    gl.uniform3fv(uB, rgb(g('--iris'),  [0.63, 0.42, 0.85]));
    gl.uniform3fv(uC, rgb(g('--brass'), [0.79, 0.57, 0.18]));
  }
  window.refreshOrbColours = readPalette;

  /* ---- sizing ---- */
  /* 1.6 rather than 2: this shader is fragment-bound, and the orb is large on
     screen, so the top DPR step costs far more than it shows */
  let dpr = 1;
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const w = wrap.clientWidth * 1.26, h = wrap.clientHeight * 1.26;
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (cv.width !== pw || cv.height !== ph){
      cv.width = pw; cv.height = ph;
      gl.viewport(0, 0, pw, ph);
    }
  }

  /* ---- loop, only while the login screen is actually on ---- */
  let raf = 0, t0 = performance.now();
  function frame(now){
    raf = 0;
    resize();
    gl.useProgram(prog);
    gl.uniform1f(uT, (now - t0) / 1000);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    raf = requestAnimationFrame(frame);
  }
  const login = document.getElementById('login');
  const showing = () => !document.hidden && login && !login.classList.contains('off');
  function sync(){
    if (showing()){ if (!raf) raf = requestAnimationFrame(frame); }
    else if (raf){ cancelAnimationFrame(raf); raf = 0; }
  }

  wrap.insertBefore(cv, wrap.firstChild);
  wrap.classList.add('gl');
  readPalette();
  resize();
  sync();

  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', resize, { passive:true });
  /* the login screen is shown and hidden by a class, so watch for it rather than
     leaving the shader running behind the book */
  if (window.MutationObserver && login){
    new MutationObserver(sync).observe(login, { attributes:true, attributeFilter:['class'] });
  }
})();
