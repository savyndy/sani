'use strict';

/* ================= cursor sparkles =================
   A glitter trail that follows the pointer. Wrapped in an IIFE because the other
   four scripts share one global scope and this needs none of it.

   Performance notes, since this runs on every pointer move:
   - One canvas, one rAF loop, one drawImage per particle. The sparkle is
     pre-rendered once per colour into a small offscreen canvas, so no per-frame
     path building, gradients or shadow blur.
   - Particles live in a fixed-size pool that is allocated once. Nothing is
     allocated while the trail is running.
   - Spawning is driven by distance travelled, not by event count: pointermove
     can fire well over a hundred times a second, and most of those are 1-2px
     apart.
   - The loop stops dead when the last particle dies, so an idle page costs
     nothing at all.
   - Skipped entirely for reduced-motion and for coarse (touch) pointers. */
(function cursorSparkles(){
  const motionQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const fineQ = window.matchMedia ? window.matchMedia('(pointer: fine)') : null;
  /* the trail needs a real pointer; page dust does not, so they check separately */
  const motionOK = () => !(motionQ && motionQ.matches);
  const enabled = () => motionOK() && !!(fineQ && fineQ.matches);

  const MAX = 240;           /* pool size, shared by the trail and the page dust */
  const SPAWN_EVERY = 7;     /* px of pointer travel between spawns */
  const SPRITE = 32;         /* pre-rendered sparkle size in css px */

  const cv = document.createElement('canvas');
  cv.id = 'sparkTrail';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');

  let dpr = 1, W = 0, H = 0;
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- sprites ---- */
  /* A four-point sparkle drawn once per colour. Two crossed tapered spikes plus
     a soft core, which reads as a glint at small sizes far better than a dot. */
  let sprites = [];
  function makeSprite(colour){
    const s = document.createElement('canvas');
    s.width = s.height = SPRITE;
    const c = s.getContext('2d');
    const m = SPRITE / 2, arm = m * 0.92, waist = m * 0.14;

    const glow = c.createRadialGradient(m, m, 0, m, m, m);
    glow.addColorStop(0, colour);
    glow.addColorStop(0.28, colour);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalAlpha = 0.5;
    c.fillStyle = glow;
    c.beginPath(); c.arc(m, m, m, 0, 6.2832); c.fill();

    c.globalAlpha = 1;
    c.fillStyle = colour;
    for (let i = 0; i < 2; i++){
      c.save(); c.translate(m, m); c.rotate(i * Math.PI / 2);
      c.beginPath();
      c.moveTo(0, -arm); c.quadraticCurveTo(waist, -waist, arm, 0);
      c.quadraticCurveTo(waist, waist, 0, arm); c.quadraticCurveTo(-waist, waist, -arm, 0);
      c.quadraticCurveTo(-waist, -waist, 0, -arm);
      c.fill(); c.restore();
    }
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.beginPath(); c.arc(m, m, m * 0.16, 0, 6.2832); c.fill();
    return s;
  }

  /* Read the palette off :root so the trail follows the theme automatically. */
  function buildSprites(){
    const cs = getComputedStyle(document.documentElement);
    const pick = n => (cs.getPropertyValue(n) || '').trim();
    const cols = [pick('--rose'), pick('--iris'), pick('--brass'), pick('--blue')]
      .filter(Boolean);
    sprites = (cols.length ? cols : ['#d4588a', '#a06ad8', '#c9922e']).map(makeSprite);
  }

  /* ---- pool ---- */
  const P = new Array(MAX);
  for (let i = 0; i < MAX; i++) P[i] = { on:false, x:0, y:0, vx:0, vy:0, life:0, max:1, rot:0, vr:0, size:1, sp:0, g:0, drag:0 };
  let live = 0, head = 0;

  /*
    Two flavours out of one pool. Trail motes are bigger, faster and short lived;
    dust motes are small, slow, barely affected by gravity and hang around long
    enough to read as drifting. Gravity and drag live on the particle rather than
    in the loop so both can share the same integrator.
  */
  function spawn(x, y, vx, vy, dust){
    const p = P[head]; head = (head + 1) % MAX;
    if (!p.on) live++;
    p.on = true;
    if (dust){
      p.x = x; p.y = y;
      p.vx = vx; p.vy = vy;
      p.max = 900 + Math.random() * 950;
      p.size = 2.4 + Math.random() * 4.6;
      p.g = 24; p.drag = 1.05;
    } else {
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      /* inherit a little pointer momentum, then scatter */
      p.vx = vx * 0.08 + (Math.random() - 0.5) * 48;
      p.vy = vy * 0.08 + (Math.random() - 0.5) * 48 - 14;
      p.max = 620 + Math.random() * 520;
      p.size = 5 + Math.random() * 8;
      p.g = 150; p.drag = 1.9;
    }
    p.life = p.max;
    p.rot = Math.random() * 6.2832;
    p.vr = (Math.random() - 0.5) * 5;
    p.sp = (Math.random() * sprites.length) | 0;
  }

  /*
    Emit a field of dust across a rectangle. dir 1 blows it away up and to the
    right (ink leaving the page), dir -1 settles it in from the other side (ink
    arriving). book.js calls this alongside the mask dissolve: the mask shreds the
    glyphs, this is what makes actual motes visible coming off them.
  */
  window.pageDust = function(rect, dir, count){
    if (!motionOK() || !rect || !rect.width || !rect.height) return;
    const n = Math.min(count || 80, 130);
    for (let i = 0; i < n; i++){
      const x = rect.left + Math.random() * rect.width;
      const y = rect.top + Math.random() * rect.height;
      const vx = dir * (18 + Math.random() * 56) + (Math.random() - 0.5) * 16;
      const vy = dir * (-14 - Math.random() * 34) + (Math.random() - 0.5) * 18;
      spawn(x, y, vx, vy, true);
    }
    kick();
  };

  /* ---- loop ---- */
  let raf = 0, last = 0;
  function frame(now){
    raf = 0;
    const dt = Math.min(now - last, 48) / 1000;
    last = now;
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < MAX; i++){
      const p = P[i]; if (!p.on) continue;
      p.life -= dt * 1000;
      if (p.life <= 0){ p.on = false; live--; continue; }
      p.vy += p.g * dt;                 /* a little gravity, so it settles like glitter */
      p.vx *= (1 - p.drag * dt);        /* air drag */
      p.vy *= (1 - p.drag * 0.6 * dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;

      const t = p.life / p.max;
      const a = t > 0.75 ? (1 - t) / 0.25 : t / 0.75;   /* quick in, slow out */
      const sz = p.size * (0.45 + 0.55 * t);
      const img = sprites[p.sp]; if (!img) continue;

      ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.globalAlpha = 1;
    if (live > 0) raf = requestAnimationFrame(frame);
  }
  function kick(){
    if (raf || live === 0) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  /* ---- input ---- */
  let px = 0, py = 0, have = false, acc = 0;
  function onMove(e){
    if (!enabled()) return;
    const x = e.clientX, y = e.clientY;
    if (!have){ px = x; py = y; have = true; return; }
    const dx = x - px, dy = y - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    px = x; py = y;
    if (d < 0.5) return;
    acc += d;
    /* faster movement spawns more, but cap the burst so a fast flick across the
       screen cannot dump the whole pool in one event */
    let n = 0;
    while (acc >= SPAWN_EVERY && n < 4){ acc -= SPAWN_EVERY; spawn(x, y, dx / 0.016, dy / 0.016); n++; }
    if (n) kick();
  }

  function stop(){
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (let i = 0; i < MAX; i++) P[i].on = false;
    live = 0; acc = 0; have = false;
    ctx.clearRect(0, 0, W, H);
  }

  resize();
  buildSprites();
  window.addEventListener('resize', () => { resize(); }, { passive:true });
  window.addEventListener('pointermove', onMove, { passive:true });
  window.addEventListener('pointerdown', e => {
    if (!enabled()) return;
    /* a small burst on click, which makes buttons feel like they spark */
    for (let i = 0; i < 9; i++) spawn(e.clientX, e.clientY, 0, 0);
    kick();
  }, { passive:true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('blur', stop);
  if (motionQ){
    const h = () => { if (motionQ.matches) stop(); };
    if (motionQ.addEventListener) motionQ.addEventListener('change', h);
    else if (motionQ.addListener) motionQ.addListener(h);
  }

  /* app.js calls this after a palette change so the glitter matches the theme */
  window.refreshSparkleColours = buildSprites;
})();
