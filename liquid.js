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
    uniform vec2  u_vel;       // eased pointer velocity

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

    // Rotate the field around a centre; falls off with distance.
    vec2 twirl(vec2 p, vec2 c, float strength, float radius) {
      vec2 d = p - c;
      float a = strength * exp(-dot(d, d) / radius);
      float s = sin(a), k = cos(a);
      return c + mat2(k, -s, s, k) * d;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      float aspect = u_res.x / u_res.y;
      vec2 p = vec2(uv.x * aspect, uv.y);
      float t = u_time * 0.028;

      // Pointer: broad soft well, plus a swirl driven by pointer velocity.
      vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
      vec2 dm = p - m;
      float well = exp(-dot(dm, dm) * 1.8) * u_strength;
      float speed = min(length(u_vel) * 10.0, 1.0);
      vec2 swirl = vec2(-dm.y, dm.x) * speed;

      // Twirls: two slow vortices that wander, and one under the pointer.
      vec2 c1 = vec2(aspect * (0.38 + 0.18 * sin(t * 1.7)), 0.55 + 0.22 * cos(t * 1.1));
      vec2 c2 = vec2(aspect * (0.72 + 0.16 * cos(t * 1.3 + 2.0)), 0.40 + 0.20 * sin(t * 0.9 + 1.0));
      p = twirl(p, c1,  2.4 + 0.6 * sin(t * 2.3), 0.55);
      p = twirl(p, c2, -2.0 + 0.5 * cos(t * 1.9), 0.40);
      p = twirl(p, m, (1.6 + 3.0 * speed) * u_strength, 0.35);
      p += (dm * 0.10 + swirl * 0.35) * well;

      // Slow viscous flow field so the whole sheet drifts on its own.
      p += 0.22 * vec2(sin(p.y * 1.1 + t * 2.0), cos(p.x * 0.9 - t * 1.6));

      // Deep domain warp, low frequency: long smooth sheets.
      vec2 q = vec2(fbm(p * 0.45 + t), fbm(p * 0.45 - t * 0.7 + 3.1));
      vec2 r = vec2(fbm(p * 0.6 + 1.6 * q + vec2(1.7, 9.2) + t * 0.5),
                    fbm(p * 0.6 + 1.6 * q + vec2(8.3, 2.8) - t * 0.4));
      r += (dm * 0.25 + swirl * 0.5) * well;
      float n = fbm(p * 0.5 + 2.4 * r);

      // Long diagonal silk folds, bent by the warp. Drift is slow.
      float phase = (p.x * 1.0 - p.y * 1.5) * 2.6 + n * 7.0 + t * 0.8;
      float folds = 0.5 + 0.5 * sin(phase);
      float sheen = pow(folds, 3.0);
      float mask = smoothstep(0.32, 0.78, n + 0.15 + 0.25 * uv.x);
      float v = sheen * mask + well * 0.06;

      vec3 black  = vec3(0.0);
      vec3 navy   = vec3(0.05, 0.08, 0.17);
      vec3 steel  = vec3(0.24, 0.38, 0.58);
      vec3 powder = vec3(0.647, 0.784, 0.922);
      vec3 col = mix(black, navy, smoothstep(0.0, 0.30, v));
      col = mix(col, steel,  smoothstep(0.26, 0.62, v));
      col = mix(col, powder, smoothstep(0.58, 1.0, v));

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
  const uVel = gl.getUniformLocation(prog, 'u_vel');

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
  const vel = { x: 0, y: 0 };        // eased velocity sent to the shader
  const impulse = { x: 0, y: 0 };    // raw velocity from the last pointer event, decays
  let last = null;
  let visible = true, raf = 0, start = performance.now();

  band.addEventListener('pointermove', (e) => {
    const r = band.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    if (last) { impulse.x += (x - last.x) * 0.6; impulse.y += (y - last.y) * 0.6; }
    last = { x, y };
    target.x = x; target.y = y; target.s = 1;
  }, { passive: true });
  band.addEventListener('pointerleave', () => { target.s = 0; last = null; });

  function frame(now) {
    raf = 0;
    if (!visible) return;
    resize();
    const k = 0.045;
    cur.x += (target.x - cur.x) * k;
    cur.y += (target.y - cur.y) * k;
    cur.s += (target.s - cur.s) * k * 0.8;
    vel.x += (impulse.x - vel.x) * 0.08;
    vel.y += (impulse.y - vel.y) * 0.08;
    impulse.x *= 0.9; impulse.y *= 0.9;
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uMouse, cur.x, cur.y);
    gl.uniform1f(uStrength, cur.s);
    gl.uniform2f(uVel, vel.x, vel.y);
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
