/* Liquid gradient hero band — WebGL fragment shader with pointer interaction.
   Falls back to the CSS gradient if WebGL is unavailable. */
(() => {
  'use strict';
  const band = document.querySelector('.band');
  const canvas = document.querySelector('.band__liquid');
  if (!band || !canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { canvas.remove(); return; }

  const VERT = `
    attribute vec2 a;
    void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

  const FRAG = `
    precision highp float;
    uniform vec2  u_res;
    uniform float u_time;
    uniform vec2  u_mouse;     // 0..1, y up
    uniform float u_strength;  // 0..1 pointer influence

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p * 2.0; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      float aspect = u_res.x / u_res.y;
      vec2 p = vec2(uv.x * aspect, uv.y);
      float t = u_time * 0.045;

      // Pointer: a broad, soft well that pushes the folds.
      vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
      vec2 dm = p - m;
      float well = exp(-dot(dm, dm) * 2.2) * u_strength;

      // Gentle domain warp: low frequency so the sheets stay long and smooth.
      vec2 q = vec2(fbm(p * 0.55 + t), fbm(p * 0.55 - t * 0.6 + 3.1));
      vec2 r = vec2(fbm(p * 0.7 + 1.1 * q + vec2(1.7, 9.2) + t * 0.5),
                    fbm(p * 0.7 + 1.1 * q + vec2(8.3, 2.8) - t * 0.35));
      r += dm * well * 0.35;
      float n = fbm(p * 0.6 + 1.6 * r);

      // Long diagonal silk folds. Few of them, softly bent.
      float phase = (p.x * 1.0 - p.y * 1.5) * 3.2 + n * 5.5 + t * 1.2 + well * 2.5;
      float folds = 0.5 + 0.5 * sin(phase);
      float sheen = pow(folds, 3.5);
      // Mask so most of the canvas stays black, with a few broad lit sheets.
      float mask = smoothstep(0.35, 0.75, n + 0.15 + 0.25 * uv.x);
      float v = sheen * mask + well * 0.07;

      vec3 black  = vec3(0.0);
      vec3 navy   = vec3(0.05, 0.08, 0.17);
      vec3 steel  = vec3(0.24, 0.38, 0.58);
      vec3 powder = vec3(0.647, 0.784, 0.922);
      vec3 col = mix(black, navy, smoothstep(0.0, 0.30, v));
      col = mix(col, steel,  smoothstep(0.26, 0.62, v));
      col = mix(col, powder, smoothstep(0.58, 1.0, v));

      // Light falls from the upper right, like the reference.
      col *= 0.7 + 0.5 * smoothstep(0.0, 1.0, uv.x * 0.75 + uv.y * 0.25);
      gl_FragColor = vec4(col, 1.0);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');
  const uStrength = gl.getUniformLocation(prog, 'u_strength');

  // Render at a reduced resolution: the field is soft, so it costs nothing visually.
  const SCALE = 0.5;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(band.clientWidth * dpr * SCALE));
    const h = Math.max(1, Math.round(band.clientHeight * dpr * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }
  }

  // Pointer state, eased toward the target for a liquid feel.
  const target = { x: 0.72, y: 0.6, s: 0 };
  const cur = { x: 0.72, y: 0.6, s: 0 };
  let visible = true, raf = 0, start = performance.now();

  band.addEventListener('pointermove', (e) => {
    const r = band.getBoundingClientRect();
    target.x = (e.clientX - r.left) / r.width;
    target.y = 1 - (e.clientY - r.top) / r.height;
    target.s = 1;
  }, { passive: true });
  band.addEventListener('pointerleave', () => { target.s = 0; });

  function frame(now) {
    raf = 0;
    if (!visible) return;
    resize();
    const k = 0.06;
    cur.x += (target.x - cur.x) * k;
    cur.y += (target.y - cur.y) * k;
    cur.s += (target.s - cur.s) * k * 0.8;
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uMouse, cur.x, cur.y);
    gl.uniform1f(uStrength, cur.s);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!reduceMotion) raf = requestAnimationFrame(frame);
  }
  function play() { if (!raf) raf = requestAnimationFrame(frame); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) play();
    }, { threshold: 0 }).observe(band);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) play(); });
  window.addEventListener('resize', () => { resize(); if (reduceMotion) play(); });

  // With reduced motion, still respond to the pointer, one frame per move.
  if (reduceMotion) band.addEventListener('pointermove', play, { passive: true });

  canvas.classList.add('is-ready');
  play();
})();
