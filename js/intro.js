'use strict';

/* ================= intro sequence =================
   A pixel scene in a park at sunset, then the handover to the app. Loads
   BEFORE app.js so app.js can see INTRO_ACTIVE and hold back its own startup
   focus until the scene is over.

   The two people are NOT drawn here. They are Liberated Pixel Cup artwork,
   composited from the usual modular layers (body, head, hair, beard,
   moustache, shirt, trousers, shoes, skirt, bodice) and recoloured to this
   palette, baked into img/people.png. The cake is an OpenGameArt sprite,
   keyed off its backing and shifted to chocolate. See the README for credits.
   The park itself is generated below.

   Everything is composed into a 320x180 buffer and blown up to the viewport
   with nearest-neighbour scaling at an INTEGER factor, which is what keeps
   every pixel a hard, square, equal-sized block.

   The beats:
     0.0s   the scene fades up
     0.6s   he walks in from the left and crosses to the middle
     4.5s   a question mark pops over his head
     6.5s   she walks in from the right carrying the cake
    10.1s   he reaches out and they hold it together
    11.3s   a heart blooms above the cake
    12.2s   the heart grows until it has swallowed the screen
    13.7s   the pink fades off, the login rises in behind it
    14.5s   the overlay is removed and `intro:done` fires

   Scale is chosen off the WIDTH, so the scene never crops horizontally and
   the walk-ins always read. Any leftover height is filled with the top sky
   colour above and the bottom grass colour below, which just reads as more
   sky and more grass. */
(function intro(){
  const host = document.getElementById('intro');
  const cv   = document.getElementById('introCanvas');
  const login = document.getElementById('login');

  const reduce = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Elements that rise in once the pink clears. The order and the stagger
     itself are declared in css/intro.css via --i. */
  const REVEAL = ['.orb-wrap', '.orb-title', '.orb-sub', '#inName', '#inPass',
                  '#btnEnter', '.login-tools'];
  REVEAL.forEach(s => {
    const n = login && login.querySelector(s);
    if (n) n.classList.add('reveal');
  });

  const TOTAL = 14500;
  let done = false, timer = 0, raf = 0;

  function finish(){
    if (done) return;
    done = true;
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    if (host) host.classList.add('gone');
    document.body.classList.add('revealed');
    window.INTRO_ACTIVE = false;
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    window.removeEventListener('resize', fit);
    window.dispatchEvent(new CustomEvent('intro:done'));
  }

  /* the owner of this page will see the intro a great many times, so let any
     click or key cut it short; the receiver will never need to */
  function skip(e){
    if (e.type === 'keydown' && e.key === 'Tab') return;
    finish();
  }

  window.addEventListener('intro:done', () => {
    if (login) login.inert = false;
  }, { once:true });

  if (!host || !cv || reduce){
    window.INTRO_ACTIVE = false;
    finish();
    return;
  }

  window.INTRO_ACTIVE = true;
  if (login) login.inert = true;

  /* ---------------- geometry ---------------- */

  /* The buffer size is the one knob that decides how chunky this looks. The
     characters are a fixed 48 pixels tall whatever it is set to, so a larger
     buffer means a smaller upscale factor on screen and finer looking art,
     at the cost of the figures sitting smaller in the frame. */
  const W = 320, H = 180;

  /* The park is laid out against a 320x180 design and multiplied up, so the
     composition holds at any buffer size. */
  const K = W / 320;
  const k = v => Math.round(v * K);

  const HORIZON = k(106);  /* where the sky stops and the grass starts */
  const GROUND  = k(152);  /* the line their soles stand on            */

  /* The spritesheet is 64x64 cells and is NOT scaled: pixel art only stays
     sharp at 1:1. Inside every cell the figure is drawn centred on column 32
     with its soles on row 62, so anchoring by the CELL rather than by the
     visible pixels is what stops the character sliding sideways when the pose
     changes from walking to holding. */
  const CELL = 64, SOLE = 62, CELL_Y = GROUND - SOLE;
  const ROW_BOY = 0, ROW_GIRL = 1, ROW_HOLD = 2;
  const WALK_FRAMES = 9;
  const CYCLE_PX = 40;     /* ground covered by one full 9-frame cycle */

  /* Measured off the baked sheet: in the holding pose his hand ends at cell
     column 48 and hers begins at column 16, both on row 43. Those are sprite
     facts, so the meeting point is derived from them rather than written as a
     literal, and the cake stays in their hands at any buffer size. */
  const CAKE_W = 21, CAKE_H = 23;
  const CAKE_HOLD_X = Math.round(W / 2 - CAKE_W / 2);
  const BOY_X  = CAKE_HOLD_X - 1 - 48;
  const GIRL_X = CAKE_HOLD_X + CAKE_W - 16;
  const BOY_FROM = -CELL - 6, GIRL_FROM = W + 4;
  const CAKE_Y = CELL_Y + 29;     /* their hands grip it 14 rows down */
  /* While she walks it rides at her side, not across her face. */
  const CAKE_CARRY_DX = 2;

  /* ---------------- timeline, in ms ---------------- */

  const T = {
    fadeIn:    600,
    boyFrom:   600,  boyTo:   4050,
    qIn:      4450,  qOut:    6250,
    girlFrom: 6450,  girlTo:  9900,
    take:    10100,
    heartPop: 11300, heartPopEnd: 11750,
    grow:    12200, growEnd:    13600,
    fade:    13700
  };

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const span  = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  function outBack(p){
    const c = 1.9;
    return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
  }
  /* Constant speed for almost the whole crossing, easing only over the last
     stride so they settle rather than stop dead. */
  function walkEase(p){
    return p < 0.9 ? p * (0.95 / 0.9)
                   : 0.95 + 0.05 * (1 - Math.pow(1 - (p - 0.9) / 0.1, 2));
  }

  /* ---------------- colour helpers ---------------- */

  function hex(s){
    return [parseInt(s.slice(1, 3), 16),
            parseInt(s.slice(3, 5), 16),
            parseInt(s.slice(5, 7), 16)];
  }
  function lerp(a, b, t){
    return [Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t)];
  }

  const SKY_TOP   = '#4b2270';
  const GRASS_BOT = '#2c4232';

  /* ---------------- the static background ---------------- */

  /* Painted once into its own canvas and blitted each frame. Everything here
     is a proportion of the 320x180 design, passed through k(), so the same
     code paints the park at whatever buffer size W and H are set to.

     It is all deterministic: the skyline uses a seeded generator, so it is
     the same city on every load. */
  const bgCv = document.createElement('canvas');
  bgCv.width = W; bgCv.height = H;

  function paintBackground(){
    const g = bgCv.getContext('2d');
    const img = g.createImageData(W, H);
    const D = img.data;

    function put(x, y, c){
      x = x | 0; y = y | 0;
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255;
    }
    function bar(x, y, w, h, c){
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c);
    }
    function disc(cx, cy, r, c){
      for (let y = -r; y <= r; y++){
        const s = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
        for (let x = -s; x <= s; x++) put(cx + x, cy + y, c);
      }
    }

    let seed = 20260419;
    function rnd(){
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    /* sky: violet overhead, down through magenta and coral to gold at the rim */
    const SKY = [[0, SKY_TOP], [27, '#7d2f78'], [50, '#b8457f'], [70, '#e4678c'],
                 [85, '#f58f72'], [97, '#fbb673'], [106, '#ffdc9c']]
                .map(st => [k(st[0]), hex(st[1])]);
    for (let y = 0; y < HORIZON; y++){
      let i = 0;
      while (i < SKY.length - 2 && y >= SKY[i + 1][0]) i++;
      const d = Math.max(1, SKY[i + 1][0] - SKY[i][0]);
      const c = lerp(SKY[i][1], SKY[i + 1][1], clamp((y - SKY[i][0]) / d, 0, 1));
      for (let x = 0; x < W; x++) put(x, y, c);
    }

    /* a few early stars, only high enough up that the sky is still dark */
    for (let i = 0; i < Math.round(13 * K); i++){
      put(Math.floor(rnd() * W), Math.floor(rnd() * k(20)), [255, 240, 230]);
    }

    /* clouds, lit underneath by the sun */
    function cloud(x, y, w, c){
      x = k(x); y = k(y); w = k(w);
      bar(x, y, w, k(3), c);
      if (w > k(13)) bar(x + k(3), y - k(3), w - k(11), k(3), c);
      if (w > k(23)) bar(x + k(8), y - k(5), w - k(21), k(2), c);
    }
    cloud(20,  33, 43, hex('#c86193'));
    cloud(93,  22, 30, hex('#b2558c'));
    cloud(187, 38, 50, hex('#e07f9b'));
    cloud(260, 25, 33, hex('#c86193'));

    /* skyline: a far layer catching the light, a nearer darker one in front */
    function skyline(top0, topVar, wMin, wVar, col, winCol, winChance){
      let x = -k(6);
      while (x < W + k(6)){
        const w = k(wMin) + Math.floor(rnd() * k(wVar));
        const top = k(top0) + Math.floor(rnd() * k(topVar));
        bar(x, top, w, HORIZON - top, col);
        for (let wy = top + k(5); wy < HORIZON - k(3); wy += k(6)){
          for (let wx = x + k(3); wx < x + w - k(2); wx += k(5)){
            if (rnd() < winChance) bar(wx, wy, Math.max(1, k(1)), Math.max(1, k(1)), winCol);
          }
        }
        x += w + Math.max(1, k(1));
      }
    }
    skyline(53, 33, 13, 20, hex('#6b3579'), hex('#ffd68e'), 0.30);

    /* The sun goes on between the two layers, so it sits in front of the far
       city and sets behind the near one. Drawn before the far layer it was
       simply buried; drawn after both it would float on top of the skyline. */
    disc(k(233), k(93), k(27), hex('#f9a07a'));
    disc(k(233), k(93), k(20), hex('#ffc98c'));
    disc(k(233), k(93), k(15), hex('#ffe9ae'));
    disc(k(233), k(93), k(8),  hex('#fff8e0'));

    skyline(73, 25, 18, 25, hex('#3a1b4e'), hex('#ffbf6e'), 0.22);

    /* A treeline closing off the park behind them. Three harmonics with
       unrelated periods, so the crown never settles into a repeating scallop. */
    for (let x = 0; x < W; x++){
      const u = x / K;
      const top = k(97 + 5 * Math.sin(u * 0.19) +
                        3.3 * Math.sin(u * 0.066 + 2) +
                        2.7 * Math.sin(u * 0.44 + 1));
      for (let y = top; y < k(120); y++) put(x, y, hex('#23381f'));
      bar(x, top, 1, Math.max(1, k(1)), hex('#3c5a2c'));
    }

    /* grass, darkening toward the viewer */
    const g0 = hex('#5c7a52'), g1 = hex(GRASS_BOT);
    for (let y = HORIZON; y < H; y++){
      const c = lerp(g0, g1, (y - HORIZON) / Math.max(1, H - HORIZON));
      for (let x = 0; x < W; x++) put(x, y, c);
    }
    /* a scatter of lighter blades, warm where the sun still reaches */
    for (let i = 0; i < Math.round(420 * K * K); i++){
      const x = Math.floor(rnd() * W);
      const y = HORIZON + Math.floor(rnd() * (H - HORIZON));
      put(x, y, lerp(hex('#6e8c5c'), hex('#3a5240'),
                     (y - HORIZON) / Math.max(1, H - HORIZON)));
    }

    /* the path they meet on */
    bar(0, k(140), W, k(27), hex('#9d8872'));
    bar(0, k(140), W, Math.max(1, k(1)), hex('#b7a083'));
    bar(0, k(166), W, Math.max(1, k(1)), hex('#7d6a58'));
    for (let x = 0; x < W; x++){
      if (rnd() < 0.4)  bar(x, k(139), 1, Math.max(1, k(1)), hex('#8e7b68'));
      if (rnd() < 0.4)  bar(x, k(167), 1, Math.max(1, k(1)), hex('#6d5c4c'));
      if (rnd() < 0.08) bar(x, k(141) + Math.floor(rnd() * k(25)), 1,
                           Math.max(1, k(1)), hex('#8a7664'));
    }

    g.putImageData(img, 0, 0);

    /* Foreground props go on with the 2d context, over the pixels already
       placed. They are still axis-aligned integer fills, so nothing softens. */
    function tree(x, baseY, h, r){
      x = k(x); baseY = k(baseY); h = k(h); r = k(r);
      g.fillStyle = '#2f2015';
      g.fillRect(x - k(1), baseY - h, Math.max(1, k(3)), h);
      [[0, -h - r + k(2), r], [-r + k(2), -h + k(2), r - k(2)],
       [r - k(2), -h + k(1), r - k(2)]].forEach(c => {
        g.fillStyle = '#27432a';
        for (let y = -c[2]; y <= c[2]; y++){
          const s = Math.floor(Math.sqrt(Math.max(0, c[2] * c[2] - y * y)));
          g.fillRect(x + c[0] - s, baseY + c[1] + y, s * 2 + 1, 1);
        }
      });
      /* warm rim on the side facing the sun */
      g.fillStyle = '#7a9148';
      for (let y = -r; y <= r; y++){
        const s = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
        if (s > 1) g.fillRect(x + s - k(1), baseY - h - r + k(2) + y, Math.max(1, k(2)), 1);
      }
    }
    tree(27, 130, 25, 13);
    tree(297, 135, 22, 12);

    /* A lamp, already lit. The glow is two low-alpha discs rather than a
       rectangle: a translucent box reads as a rendering artefact, a round
       falloff reads as light. */
    g.fillStyle = '#2a1f2e';
    g.fillRect(k(67), k(103), Math.max(1, k(3)), k(44));
    g.fillRect(k(64), k(98), k(9), k(5));
    g.fillStyle = '#ffd27a';
    g.fillRect(k(66), k(100), k(5), k(3));
    [[15, 'rgba(255,210,122,.10)'], [8, 'rgba(255,224,160,.16)']].forEach(step => {
      g.fillStyle = step[1];
      const r = k(step[0]);
      for (let y = -r; y <= r; y++){
        const s = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
        if (s > 0) g.fillRect(k(68) - s, k(101) + y, s * 2 + 1, 1);
      }
    });
  }
  paintBackground();
  /* ---------------- the frame buffer ---------------- */

  const buf = document.createElement('canvas');
  buf.width = W; buf.height = H;
  const b = buf.getContext('2d');
  b.imageSmoothingEnabled = false;

  const out = cv.getContext('2d');
  let scale = 1, offX = 0, offY = 0;

  function fit(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
    cv.width  = Math.round(vw * dpr);
    cv.height = Math.round(vh * dpr);
    cv.style.width  = vw + 'px';
    cv.style.height = vh + 'px';
    /* Width decides the factor, so the scene never crops sideways and the
       walk-ins read. A tall viewport just gets more sky and more grass. */
    scale = Math.max(1, Math.ceil(cv.width / W), Math.ceil(cv.height / (H * 2)));
    offX = Math.round((cv.width  - W * scale) / 2);
    offY = Math.round((cv.height - H * scale) / 2);
    out.imageSmoothingEnabled = false;
  }
  fit();
  window.addEventListener('resize', fit);

  /* ---------------- the artwork ---------------- */

  const people = new Image(); people.src = 'img/people.png';
  const cake   = new Image(); cake.src   = 'img/cake.png';

  /* The one thing not taken from an art pack: a question mark is a glyph
     rather than a sprite. Built once into its own canvas, outline first so it
     reads against a bright sky. */
  const QMARK = ['..WWWWW..', '.WW...WW.', '.WW...WW.', '......WW.', '.....WW..',
                 '....WW...', '...WW....', '...WW....', '...WW....', '.........',
                 '...WW....', '...WW....'];
  const qm = (function(){
    const w = QMARK[0].length, h = QMARK.length;
    const c = document.createElement('canvas');
    c.width = w + 2; c.height = h + 2;
    const g = c.getContext('2d');
    g.fillStyle = '#3a1230';
    for (let y = 0; y < h; y++){
      for (let x = 0; x < w; x++){
        if (QMARK[y][x] !== 'W') continue;
        g.fillRect(x, y + 1, 3, 1);
        g.fillRect(x + 1, y, 1, 3);
      }
    }
    g.fillStyle = '#fff3d6';
    for (let y = 0; y < h; y++){
      for (let x = 0; x < w; x++){
        if (QMARK[y][x] === 'W') g.fillRect(x + 1, y + 1, 1, 1);
      }
    }
    return c;
  })();

  /* ---------------- drawing ---------------- */

  function shadow(cx, y, rx, ry){
    b.fillStyle = 'rgba(38,20,50,.34)';
    for (let j = -ry; j <= ry; j++){
      const s = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry))));
      if (s > 0) b.fillRect(cx - s, y + j, s * 2 + 1, 1);
    }
  }

  function discFill(cx, cy, r, col){
    b.fillStyle = col;
    for (let y = -r; y <= r; y++){
      const s = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
      if (s >= 0) b.fillRect(Math.round(cx - s), Math.round(cy + y), s * 2 + 1, 1);
    }
  }

  /* The heart is solved rather than drawn, so it stays a clean shape at every
     size from a few pixels across to larger than the screen. For each row the
     implicit curve (x^2+y^2-1)^3 - x^2 y^3 <= 0 is sampled across the row and
     the inside stretches are filled as runs. */
  function heart(cx, cy, s, col){
    if (s <= 0) return;
    const y0 = Math.max(0, Math.floor(cy - 1.35 * s));
    const y1 = Math.min(H - 1, Math.ceil(cy + 1.35 * s));
    const x0 = Math.max(0, Math.floor(cx - 1.35 * s));
    const x1 = Math.min(W - 1, Math.ceil(cx + 1.35 * s));
    b.fillStyle = col;
    for (let py = y0; py <= y1; py++){
      const yy = (cy - py) / s - 0.13;
      const y2 = yy * yy, y3 = y2 * yy;
      let run = -1;
      for (let px = x0; px <= x1; px++){
        const xx = (px - cx) / s;
        const x2 = xx * xx;
        const a = x2 + y2 - 1;
        const inside = a * a * a - x2 * y3 <= 0;
        if (inside && run < 0) run = px;
        if (run >= 0 && (!inside || px === x1)){
          b.fillRect(run, py, (inside ? px : px - 1) - run + 1, 1);
          run = -1;
        }
      }
    }
  }

  /* one 64x64 cell of the spritesheet, placed by its cell origin */
  function figure(col, row, x){
    if (!people.complete || !people.naturalWidth) return;
    b.drawImage(people, col * CELL, row * CELL, CELL, CELL,
                Math.round(x), CELL_Y, CELL, CELL);
  }

  /* ---------------- the frame ---------------- */

  function draw(t){
    b.clearRect(0, 0, W, H);
    b.drawImage(bgCv, 0, 0);

    const bp = span(t, T.boyFrom, T.boyTo);
    const boyX = BOY_FROM + (BOY_X - BOY_FROM) * walkEase(bp);
    const boyMoving = t >= T.boyFrom && t < T.boyTo;

    const girlOn = t >= T.girlFrom;
    const gp = span(t, T.girlFrom, T.girlTo);
    const girlX = GIRL_FROM + (GIRL_X - GIRL_FROM) * walkEase(gp);
    const girlMoving = t >= T.girlFrom && t < T.girlTo;

    /* The animation frame is driven by DISTANCE, not by time. One 9-frame
       cycle per CYCLE_PX of ground means the feet keep pace with the walk
       however long the crossing is given, which is what stops them skating. */
    const frameOf = travelled =>
      Math.floor(Math.abs(travelled) / CYCLE_PX * WALK_FRAMES) % WALK_FRAMES;
    const boyFrame  = frameOf(boyX - BOY_FROM);
    const girlFrame = frameOf(girlX - GIRL_FROM);

    const holding = t >= T.take;

    /* she carries it in front of her, then they bring it between them */
    const handover = span(t, T.girlTo, T.take);
    const carryX = girlX + CAKE_CARRY_DX;
    const cakeX = Math.round(carryX + (CAKE_HOLD_X - carryX) * handover);

    /* ground shadows, thrown away from the low sun on the right */
    shadow(Math.round(boyX) + 28, GROUND + 1, k(16), Math.max(2, k(4)));
    if (girlOn) shadow(Math.round(girlX) + 34, GROUND + 1, k(16), Math.max(2, k(4)));

    /* him */
    if (holding) figure(0, ROW_HOLD, boyX);
    else         figure(boyMoving ? boyFrame : 0, ROW_BOY, boyX);

    /* her */
    if (girlOn){
      if (holding) figure(1, ROW_HOLD, girlX);
      else         figure(girlMoving ? girlFrame : 0, ROW_GIRL, girlX);
    }

    /* the cake goes on after both of them, so it reads as held in front */
    if (girlOn && cake.complete && cake.naturalWidth){
      b.drawImage(cake, cakeX, CAKE_Y);
    }

    /* the question mark, popping over his head with a little overshoot */
    if (t >= T.qIn && t < T.qOut + 220){
      const inP = span(t, T.qIn, T.qIn + 320);
      const outP = span(t, T.qOut, T.qOut + 220);
      const y = CELL_Y - 4 + Math.round(12 * (1 - outBack(inP))) - Math.round(outP * 10);
      if (outP < 1) b.drawImage(qm, Math.round(boyX) + 27, y);
    }

    /* the heart: a pop above the cake, a beat, then it swallows the screen */
    if (t >= T.heartPop){
      const gp2 = span(t, T.grow, T.growEnd);
      let s;
      const HS = k(13);
      if (t < T.heartPopEnd)   s = HS * outBack(span(t, T.heartPop, T.heartPopEnd));
      /* one beat while it hangs there, before it takes the screen */
      else if (t < T.grow)     s = HS * (1 + 0.13 * Math.sin(span(t, T.heartPopEnd, T.grow) * Math.PI));
      else                     s = HS + (k(360) - HS) * Math.pow(gp2, 2.2);
      /* It blooms clear above both their heads, then settles LOW in the frame
         as it grows, so the pink that finally fills the screen is weighted
         toward the bottom rather than sitting dead centre. */
      const hcx = Math.round(W / 2), hcy = k(86) + (k(118) - k(86)) * gp2;
      heart(hcx, hcy, s, '#c23b74');
      heart(hcx, hcy, s - Math.max(1.3, 1.3 * K), '#ef5f97');
      if (s < k(70)){
        discFill(hcx - 0.34 * s, hcy - 0.30 * s,
                 Math.max(1, Math.round(0.12 * s)), '#f9a8c6');
      }
    }

    /* the scene fading up out of the dark at the very start */
    if (t < T.fadeIn){
      b.fillStyle = 'rgba(18,8,26,' + (1 - t / T.fadeIn).toFixed(3) + ')';
      b.fillRect(0, 0, W, H);
    }

    /* blit, nearest neighbour, at an integer factor */
    out.imageSmoothingEnabled = false;
    if (offY > 0){
      out.fillStyle = SKY_TOP;
      out.fillRect(0, 0, cv.width, offY + 1);
      out.fillStyle = GRASS_BOT;
      out.fillRect(0, offY + H * scale - 1, cv.width, cv.height - offY - H * scale + 1);
    }
    if (offX > 0){
      out.fillStyle = SKY_TOP;
      out.fillRect(0, 0, offX + 1, cv.height);
      out.fillRect(offX + W * scale - 1, 0, cv.width - offX - W * scale + 1, cv.height);
    }
    out.drawImage(buf, offX, offY, W * scale, H * scale);
  }

  /* ---------------- run ---------------- */

  /* Wait for the artwork, but never hang on it: if a file is slow or missing
     the scene starts anyway and simply plays without that piece. */
  let started = false, pending = 2;
  function ready(){ if (--pending <= 0) begin(); }
  people.onload = ready; people.onerror = ready;
  cake.onload = ready;   cake.onerror = ready;
  setTimeout(begin, 2500);

  let start = 0, faded = false;

  function frame(now){
    if (done) return;
    const t = now - start;
    draw(t);
    if (!faded && t >= T.fade){
      faded = true;
      /* the pink lifts off while the login rises in behind it */
      host.classList.add('fading');
      document.body.classList.add('revealed');
    }
    raf = requestAnimationFrame(frame);
  }

  function begin(){
    if (started || done) return;
    started = true;
    start = performance.now();
    raf = requestAnimationFrame(frame);
    timer = setTimeout(finish, TOTAL);
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
  }
})();
