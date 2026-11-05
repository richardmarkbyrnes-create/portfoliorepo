// The home page's morphing texture: a soft gradient of a few colours, pushed
// around by layered (domain-warped) noise so it slowly folds over itself, with
// film grain on top. Drawn in WebGL into a small canvas and scaled up, so it's
// cheap; it pauses when off screen or the tab is hidden, and holds a single
// still frame for anyone who prefers reduced motion. No WebGL: the CSS
// gradient behind the canvas shows instead.
//
// It runs once per .home-texture on the page: the block under the hero and
// the full-width one in the footer (which carries data-no-details, since the
// seasonal footer draws its own petals, leaves and snow over it).
(function () {
  document.querySelectorAll('.home-texture').forEach(initTexture);

  function initTexture(wrap) {
  const canvas = wrap.querySelector('.home-texture-canvas');
  if (!canvas) return;
  const noDetails = wrap.hasAttribute('data-no-details');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false });
  if (!gl) return;

  const VERT = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;
  const FRAG = `
    precision highp float;
    uniform vec2 res;
    uniform float t;
    uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 c4; uniform vec3 c5;
    uniform float grain;
    uniform vec2 mouse;
    uniform float pull;
    uniform float ditherCell;
    // Season sweep: the incoming palette (n0-n3) washes across the old one
    // (c0-c3) as prog runs 0 -> 1, in direction dir (1 left to right, -1
    // right to left).
    uniform vec3 n0; uniform vec3 n1c; uniform vec3 n2c; uniform vec3 n3; uniform vec3 n4c; uniform vec3 n5c;
    uniform float prog;
    uniform float dir;
    // Entrance, 0 -> 1 over the first moments on screen: the land rises into
    // place and the layers come in one after another, bottom to top.
    uniform float intro;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    // 4x4 ordered (Bayer) threshold, 0-1, for the dither.
    float bayer4(vec2 c) {
      vec2 a = mod(floor(c), 4.0);
      float x = a.x, y = a.y;
      float b = mod(x, 2.0) * 2.0 + mod(y, 2.0) * 3.0;
      b = mod(b, 4.0);
      float b2 = mod(floor(x / 2.0), 2.0) * 2.0 + mod(floor(y / 2.0), 2.0) * 3.0;
      b2 = mod(b2, 4.0);
      return (b * 4.0 + b2 + 0.5) / 16.0;
    }
    // Six stops: deep ground, the bright rim, then four bands of sky from
    // the horizon up (a2 just above the land, a5 at the top). Seasons that
    // only have one sky colour fill the middle bands in between, so their
    // gradient comes out as smooth as before; summer uses all four for a
    // sunset.
    vec3 shade(float h, float body, vec3 a0, vec3 a1, vec3 a2, vec3 a3, vec3 a4, vec3 a5) {
      vec3 col = a0;
      col = mix(col, a1, smoothstep(-0.14, -0.02, h) * (0.55 + 0.45 * body));
      col = mix(col, a1, smoothstep(-0.05, 0.0, h));
      col = mix(col, a2, smoothstep(0.0, 0.07, h));
      float hs = h + (body - 0.45) * 0.12;
      col = mix(col, a3, smoothstep(0.08, 0.18, hs));
      col = mix(col, a4, smoothstep(0.17, 0.29, hs));
      col = mix(col, a5, smoothstep(0.28, 0.46, hs));
      // Deeper ground towards the bottom and in the hollows.
      col *= 1.0 - 0.18 * smoothstep(0.0, -0.45, h) * (1.0 - body);
      return col;
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.02 + 3.1; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / res;
      float aspect = res.x / res.y;
      // The cursor: a soft swell that lifts the ground and pushes the sky
      // aside around the pointer, eased in and out (pull).
      vec2 dm = (uv - mouse) * vec2(aspect, 1.0);
      float near = exp(-dot(dm, dm) * 4.5) * pull;
      uv.x -= dm.x * near * 0.12;
      vec2 p = vec2(uv.x * aspect, uv.y);
      float s = t * 0.06;

      // One big, smooth landform rather than many small ones, after the
      // reference: a ground line that swings through broad dips, rises and
      // diagonal slopes. Built from very low-frequency noise plus a tilt
      // whose direction wanders, so over time it goes from a gentle valley
      // to a steep diagonal and back.
      float n1 = fbm(vec2(p.x * 0.55 + s, s * 0.6)) - 0.44;
      float n2 = fbm(vec2(p.x * 1.1 - s * 1.3, 7.0 + s * 0.4)) - 0.44;
      float ang = sin(t * 0.045) * 1.1 + sin(t * 0.11 + 2.0) * 0.35;
      float tilt = (uv.x - 0.5) * sin(ang) * 0.9;
      // A slow, wandering bend: broad dips and humps across the width, whose
      // depth swells and shrinks, so it sometimes scoops into a deep U.
      float bend = sin(uv.x * (2.2 + sin(t * 0.05) * 1.2) + t * 0.08 + 1.5) * (0.2 + 0.16 * sin(t * 0.07 + 0.7));
      // The season sweep's front, along the direction of travel, with a
      // ragged, slightly diagonal edge. A swell rides along with it, so the
      // landscape heaves as the new season passes through.
      float xs = dir > 0.0 ? uv.x : 1.0 - uv.x;
      float front = mix(-0.15, 1.3, prog);
      float edge = xs + (fbm(vec2(uv.y * 2.5, t * 0.4)) - 0.45) * 0.3 + (uv.y - 0.5) * 0.18;
      float wipe = prog >= 1.0 ? 1.0 : smoothstep(front + 0.1, front - 0.1, edge);
      float wave = exp(-pow((edge - front) * 4.5, 2.0)) * sin(prog * 3.14159);
      float rise = 1.0 - pow(1.0 - clamp(intro / 0.7, 0.0, 1.0), 3.0);
      float ground = 0.48 + n1 * 0.9 + n2 * 0.12 + tilt + bend + near * 0.42 + wave * 0.16 - (1.0 - rise) * 0.35;

      // Now and then a soft vertical ripple runs through the sky, like light
      // through glass, then fades.
      float pulse = smoothstep(0.55, 1.0, sin(t * 0.13 + 1.0));
      float ripple = sin(p.x * 38.0 + t * 0.6 + fbm(p * 3.0) * 6.0) * 0.012 * pulse;

      // The ripple only shows up in the sky, so the ground's edge stays clean.
      float h0 = uv.y - ground;
      float h = h0 + ripple * smoothstep(0.04, 0.16, h0);
      // Gentle unevenness inside each band, so the masses aren't flat fills.
      float body = fbm(p * 1.4 + vec2(s * 0.7, -s * 0.5));

      // Dark ground, a narrow bright rim at the edge, then sky going pale:
      // the old season behind the front, the new one where it has passed.
      vec3 col = shade(h, body, c0, c1, c2, c3, c4, c5);
      if (wipe > 0.0) col = mix(col, shade(h, body, n0, n1c, n2c, n3, n4c, n5c), wipe);


      // Film grain, re-seeded every frame so it fizzes like the reference.
      // Eased off as the colour gets lighter, so the pale sky stays clean
      // white instead of reading grey under a layer of speckle.
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      float g = hash(gl_FragCoord.xy + fract(t) * 91.7) - 0.5;
      col += g * grain * mix(1.0, 0.25, smoothstep(0.55, 0.95, lum));

      // Ordered dither: the colour is stepped into a few levels per channel,
      // with a Bayer pattern deciding which way each cell rounds, so the
      // gradients break into a fine retro cross-hatch. Cells are a few device
      // pixels across so the pattern reads at a glance.
      float levels = 7.0;
      vec2 cell = gl_FragCoord.xy / ditherCell;
      col = floor(col * levels + bayer4(cell)) / levels;
      // Staggered by height: the ground shows first, then the rim, then each
      // band of sky in turn up to the top.
      float delay = clamp(0.06 + (h0 + 0.2) * 0.75, 0.0, 0.62);
      float alpha = smoothstep(delay, delay + 0.38, intro);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(prog, name);
  const uRes = u('res');
  const uT = u('t');
  const uGrain = u('grain');
  const uMouse = u('mouse');
  const uPull = u('pull');
  const uIntro = u('intro');
  const uDither = u('ditherCell');
  const uC = [u('c0'), u('c1'), u('c2'), u('c3'), u('c4'), u('c5')];
  const uN = [u('n0'), u('n1c'), u('n2c'), u('n3'), u('n4c'), u('n5c')];
  const uProg = u('prog');
  const uDir = u('dir');

  // Four seasons, each four colours from the bottom of the landscape to the
  // top of the sky. Summer is the default.
  const SEASONS = {
    // Pastel, light versions: each landscape in soft tints rather than full
    // colour. Summer's sky is a sunset: yellow, light orange and pink bands.
    //
    // Dark theme gets its own palettes rather than dimmed copies (which went
    // muddy grey, with a pale sky glowing like a lamp): the same landscape at
    // dusk. The ground keeps its colour, and the sky deepens from a dusky
    // tint up into something close to the page, so it sinks into the dark.
    // Spring: fresh greens under a soft blue sky. Summer: greens under a warm
    // sky, a peachy orange blush fading to pale apricot.
    spring: { label: 'Spring', colors: ['#97bd8f', '#c8e2b0', '#d2e2f4', '#f8fafc'], dark: ['#48734c', '#8cbb72', '#46678f', '#1f2734'] },
    // Summer's sky is a sunset in bands: yellow at the horizon, light
    // orange, then light blue, fading to a pale sky at the top.
    summer: {
      label: 'Summer',
      colors: ['#bddcb7', '#dcf1cb', '#fbe6a8', '#f9d2b0', '#c9dff3', '#f4f8fc'],
      dark: ['#4f7d55', '#94c482', '#8f7a45', '#8a5e48', '#7a4f5e', '#2a2127'],
    },
    autumn: { label: 'Autumn', colors: ['#d6a07e', '#efc09a', '#f6d999', '#fcf4e4'], dark: ['#7d4629', '#c98042', '#94713a', '#2b221a'] },
    winter: { label: 'Winter', colors: ['#97a9bd', '#c6d3df', '#e6edf4', '#fcfdfe'], dark: ['#4d6077', '#93abc2', '#3a4f68', '#1d2531'] },
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  // Always six stops: four-colour seasons get their two middle sky bands
  // filled in between the horizon and top colours.
  function paletteFor(name) {
    const season = SEASONS[name] || SEASONS.summer;
    const pal = (isDark() ? season.dark : season.colors).map(hex);
    if (pal.length === 6) return pal;
    const [g, rim, low, top] = pal;
    const at = (k) => low.map((v, i) => v + (top[i] - v) * k);
    return [g, rim, low, at(0.3), at(0.62), top];
  }

  // The season follows the site theme (the switcher in the nav): spring and
  // autumn are their own themes, the plain light theme is summer and the
  // dark theme is winter.
  const seasonFromTheme = () => ({ spring: 'spring', autumn: 'autumn', dark: 'winter' })[document.documentElement.getAttribute('data-theme')] || 'summer';
  let season = seasonFromTheme();
  let current = paletteFor(season);

  function setUniforms(pal) {
    pal.forEach((c, i) => {
      gl.uniform3fv(uC[i], c);
      gl.uniform3fv(uN[i], c);
    });
    gl.uniform1f(uProg, 1);
    gl.uniform1f(uGrain, isDark() ? 0.09 : 0.12);
  }
  setUniforms(current);
  gl.uniform1f(uDir, 1);

  // Crossfade the colours to a new palette over ~0.9s. Runs its own frames,
  // so it plays even while the field itself is paused (reduced motion).
  let fadeRaf = 0;
  function fadeTo(target) {
    cancelAnimationFrame(fadeRaf);
    const from = current.map((c) => c.slice());
    const t0 = performance.now();
    const DUR = reduce ? 0 : 900;
    const step = (now) => {
      const k = DUR ? Math.min(1, (now - t0) / DUR) : 1;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      current = from.map((c, i) => c.map((v, j) => v + (target[i][j] - v) * e));
      setUniforms(current);
      if (!running) draw(start ? OFFSET + (now - start) / 1000 : OFFSET);
      if (k < 1) fadeRaf = requestAnimationFrame(step);
    };
    fadeRaf = requestAnimationFrame(step);
  }

  // A season change sweeps the new palette across the landscape in the
  // direction of the change (later in the year: left to right; earlier:
  // right to left), with a swell riding the front. ~1.6s.
  let sweepRaf = 0;
  function sweepTo(target, direction) {
    cancelAnimationFrame(fadeRaf);
    cancelAnimationFrame(sweepRaf);
    if (reduce) { fadeTo(target); return; }
    current.forEach((c, i) => gl.uniform3fv(uC[i], c));
    target.forEach((c, i) => gl.uniform3fv(uN[i], c));
    gl.uniform1f(uDir, direction);
    const t0 = performance.now();
    const DUR = 1600;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / DUR);
      // Ease out: off the mark quickly, settling as it reaches the far side.
      const e = 1 - Math.pow(1 - k, 2.4);
      gl.uniform1f(uProg, e);
      if (!running) draw(start ? OFFSET + ((now - start) / 1000) * SPEED : OFFSET);
      if (k < 1) {
        sweepRaf = requestAnimationFrame(step);
      } else {
        current = target.map((c) => c.slice());
        setUniforms(current);
      }
    };
    gl.uniform1f(uProg, 0);
    sweepRaf = requestAnimationFrame(step);
  }

  // A theme change is a season change: sweep the new palette across in the
  // direction of travel through the year, and swap the falling details.
  const ORDER = ['spring', 'summer', 'autumn', 'winter'];
  new MutationObserver(() => {
    const next = seasonFromTheme();
    if (next === season) { fadeTo(paletteFor(season)); return; }
    const dirn = ORDER.indexOf(next) >= ORDER.indexOf(season) ? 1 : -1;
    season = next;
    sweepTo(paletteFor(next), dirn);
    particles.show(next);
  })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Drawn at the screen's resolution (capped), so the grain in the shader is
  // crisp and the separate overlay layer isn't needed.
  const SCALE = Math.min(1.5, window.devicePixelRatio || 1);
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * SCALE));
    const h = Math.max(1, Math.round(r.height * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      // Dither cells about 2 CSS pixels across, whatever the drawing scale.
      gl.uniform1f(uDither, Math.max(1, Math.round(2 * SCALE)));
    }
  }

  function draw(seconds) {
    resize();
    gl.uniform1f(uT, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let running = false;
  let start = 0;
  let raf = 0;
  // Start partway in, so the first frame is already a folded landscape.
  const OFFSET = 40;
  const SPEED = 1.8;
  // Pointer over the block, in its own 0-1 space (y up, like the shader).
  // The position trails the real cursor and the pull fades in and out, so
  // the field leans after you rather than snapping.
  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, pull: 0, target: 0 };
  function easePointer(dt) {
    const k = Math.min(1, dt * 5);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    pointer.pull += (pointer.target - pointer.pull) * Math.min(1, dt * 3);
    gl.uniform2f(uMouse, pointer.x, pointer.y);
    gl.uniform1f(uPull, pointer.pull);
  }
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
    wrap.addEventListener('pointermove', (event) => {
      const r = canvas.getBoundingClientRect();
      pointer.tx = (event.clientX - r.left) / r.width;
      pointer.ty = 1 - (event.clientY - r.top) / r.height;
      pointer.target = 1;
    });
    wrap.addEventListener('pointerleave', () => { pointer.target = 0; });
  }
  gl.uniform2f(uMouse, 0.5, 0.5);
  gl.uniform1f(uPull, 0);

  let lastNow = 0;
  // The entrance runs once, from the first time this texture plays (so the
  // footer's plays when you reach it), ~1.9s, a beat after the page settles.
  const INTRO_MS = 1900;
  let introStart = 0;
  let introDone = reduce;
  function updateIntro(now) {
    if (introDone) return;
    const k = introStart ? Math.max(0, Math.min(1, (now - introStart) / INTRO_MS)) : 0;
    gl.uniform1f(uIntro, k);
    if (k >= 1) introDone = true;
  }

  function loop(now) {
    if (!running) return;
    updateIntro(now);
    easePointer(lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016);
    // SPEED > 1 runs the landscape's own clock faster than real time.
    draw(OFFSET + ((now - start) / 1000) * SPEED);
    const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
    lastNow = now;
    particles.step(dt, now / 1000);
    raf = requestAnimationFrame(loop);
  }
  function play() {
    if (running || reduce) return;
    running = true;
    if (!start) start = performance.now();
    if (!introStart) introStart = performance.now() + 250;
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false;
    lastNow = 0;
    cancelAnimationFrame(raf);
  }

  // Faint seasonal details on a second canvas over the field: snow drifting
  // down in winter, leaves tumbling in autumn and petals floating in spring.
  // Summer has none. Kept very quiet, masked to the same pill, and
  // left out entirely for reduced motion.
  const particles = (() => {
    if (noDetails) return { step() {}, show() {} };
    const layer = document.createElement('canvas');
    layer.className = 'home-texture-details';
    layer.setAttribute('aria-hidden', 'true');
    canvas.after(layer);
    const ctx = layer.getContext('2d');
    let W = 0;
    let H = 0;
    let dpr = 1;
    let kind = null;
    let items = [];
    let alpha = 0;
    let targetAlpha = 1;
    let pending = null;

    function size() {
      const r = layer.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);
      if (w !== layer.width || h !== layer.height) {
        layer.width = w;
        layer.height = h;
      }
      W = r.width;
      H = r.height;
    }

    const rand = (a, b) => a + Math.random() * (b - a);
    function spawn(k, anywhere) {
      const base = { x: rand(0, W), y: anywhere ? rand(0, H) : rand(-20, -4), phase: rand(0, Math.PI * 2) };
      if (k === 'winter') return { ...base, r: rand(0.6, 1.4), vy: rand(8, 16), sway: rand(3, 8) };
      if (k === 'autumn') {
        const tones = ['#c2672a', '#a8501f', '#e0a33c', '#8a4a24'];
        return { ...base, r: rand(2.4, 4), vy: rand(11, 20), sway: rand(8, 16), rot: rand(0, 6.3), vr: rand(-1.6, 1.6), color: tones[Math.floor(rand(0, tones.length))] };
      }
      if (k === 'spring') {
        const tones = ['#f2b3c6', '#f7cfdb', '#ffffff'];
        return { ...base, r: rand(1.6, 2.8), vy: rand(7, 13), sway: rand(8, 15), rot: rand(0, 6.3), vr: rand(-1, 1), color: tones[Math.floor(rand(0, tones.length))] };
      }
      return null;
    }
    const COUNT = { winter: 26, autumn: 8, spring: 10 };

    function setKind(k) {
      kind = k;
      items = [];
      size();
      for (let i = 0; i < (COUNT[k] || 0); i += 1) items.push(spawn(k, true));
    }

    function step(dt, t) {
      if (reduce) return;
      if (!W) size();
      // Season changes fade the old details out, then the new ones in.
      if (pending && alpha <= 0.01) { setKind(pending); pending = null; targetAlpha = 1; }
      alpha += (targetAlpha - alpha) * Math.min(1, dt * 4);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // They read stronger against the dark page, so they step back there.
      ctx.globalAlpha = alpha * (isDark() ? 0.7 : 1);
      {
        items.forEach((p, i) => {
          p.y += p.vy * dt;
          const x = p.x + Math.sin(t * 0.8 + p.phase) * p.sway;
          if (p.y > H + 10) items[i] = spawn(kind, false);
          if (kind === 'winter') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
          } else {
            p.rot += p.vr * dt;
            ctx.save();
            ctx.translate(x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha * (isDark() ? 0.7 : 1) * (kind === 'autumn' ? 0.42 : 0.5);
            ctx.beginPath();
            ctx.ellipse(0, 0, p.r, p.r * (kind === 'autumn' ? 0.55 : 0.62), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = alpha * (isDark() ? 0.7 : 1);
          }
        });
      }
    }

    function show(k) {
      if (reduce) return;
      if (kind === null) { setKind(k); return; }
      pending = k;
      targetAlpha = 0;
    }

    window.addEventListener('resize', () => { if (kind) { size(); } });
    return { step, show };
  })();
  particles.show(season);

  gl.uniform1f(uIntro, reduce ? 1 : 0);
  draw(OFFSET);
  wrap.classList.add('is-ready');


  window.addEventListener('resize', () => { if (!running) draw(OFFSET); });

  let onScreen = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen && !document.hidden) play(); else pause();
    }).observe(wrap);
  } else {
    play();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(); else if (onScreen) play();
  });
  }
})();
