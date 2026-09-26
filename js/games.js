'use strict';

/* ---- Memory match ---- */
const MEM_EMO = ['\uD83D\uDC97', '\uD83C\uDF19', '\u2B50', '\uD83C\uDF39', '\uD83E\uDD8B', '\uD83C\uDF53', '\uD83C\uDFA7', '\uD83D\uDE80'];
const MEM = { cards:[], first:-1, lock:false, moves:0, found:0, timer:null, msg:'' };
let memUI = null;
function memNew(){
  clearTimeout(MEM.timer);
  MEM.cards = shuffle(MEM_EMO.concat(MEM_EMO).map(e => ({ e, up:false, done:false })));
  Object.assign(MEM, { first:-1, lock:false, moves:0, found:0, msg:'' });
}
function memPaintCard(i){
  if (!memUI) return; const c = MEM.cards[i], b = memUI.cards[i];
  b.classList.toggle('up', c.up || c.done); b.classList.toggle('done', c.done);
  b.setAttribute('aria-label', (c.up || c.done) ? c.e : 'Hidden card');
}
function memStats(){ if (!memUI) return; memUI.moves.textContent = MEM.moves; memUI.best.textContent = db.memBest == null ? '\u2013' : db.memBest; memUI.msg.textContent = MEM.msg; }
function memFlip(i){
  const c = MEM.cards[i]; if (MEM.lock || c.up || c.done) return;
  c.up = true; memPaintCard(i);
  if (MEM.first < 0){ MEM.first = i; return; }
  const a = MEM.cards[MEM.first], ai = MEM.first; MEM.moves++; MEM.first = -1;
  if (a.e === c.e){
    a.done = c.done = true; MEM.found++; memPaintCard(ai); memPaintCard(i);
    if (MEM.found === MEM_EMO.length){
      const best = db.memBest == null || MEM.moves < db.memBest;
      if (best){ db.memBest = MEM.moves; saveData(); }
      MEM.msg = 'All pairs found in ' + MEM.moves + ' moves.' + (best ? ' A new best!' : '');
    } else MEM.msg = 'A match!';
  } else {
    MEM.lock = true; MEM.msg = '';
    MEM.timer = setTimeout(() => { a.up = false; c.up = false; memPaintCard(ai); memPaintCard(i); MEM.lock = false; }, 850);
  }
  memStats();
}
function pageMemory(){
  return { tone:'her', html:
    '<div class="page"><div class="page-head"><span class="chip">Game for two</span></div><h3 class="pg-title">Memory match</h3>' +
    '<p class="pg-desc">Find all eight pairs in as few moves as you can.</p>' +
    '<div class="mm-stats"><span>Moves <b class="mm-moves">0</b></span><span>Best <b class="mm-best">&ndash;</b></span></div>' +
    '<div class="mm-grid"></div><p class="mm-msg" role="status"></p>' +
    '<div class="page-foot" style="margin-top:auto"><button class="btn solid" type="button" data-mm="reset">Shuffle again</button></div></div>',
    mount(f){
      if (!MEM.cards.length) memNew();
      const grid = $('.mm-grid', f); memUI = { cards:[], moves:$('.mm-moves', f), best:$('.mm-best', f), msg:$('.mm-msg', f) };
      MEM.cards.forEach((c, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'mm-card' + (c.up || c.done ? ' up' : '') + (c.done ? ' done' : '');
        b.innerHTML = '<span class="mm-in"><span class="mm-back">&#9829;</span><span class="mm-front">' + c.e + '</span></span>';
        b.setAttribute('aria-label', (c.up || c.done) ? c.e : 'Hidden card');
        b.addEventListener('click', () => memFlip(i)); grid.appendChild(b); memUI.cards.push(b);
      });
      $('[data-mm="reset"]', f).addEventListener('click', () => { memNew(); mountAgain(f, pageMemory()); });
      memStats();
    } };
}
function mountAgain(f, page){
  const shade = $('.shade', f), edges = $$('.edge', f);
  f.innerHTML = page.html; edges.forEach(e => f.appendChild(e)); if (shade) f.appendChild(shade); if (page.mount) page.mount(f);
}

/* ---- Would you rather ---- */
const WYR_Q = [
  ['Breakfast in bed every Sunday', 'A surprise picnic every month'],
  ['Travel the world together for a year', 'Build our dream home together'],
  ['Stay up all night talking', 'Sleep in until noon together'],
  ['Get a love letter every week', 'Get a long voice note every day'],
  ['Watch the sunset by the ocean', 'Watch the sunrise from a mountain'],
  ['Dance in the kitchen', 'Sing in the car'],
  ['Cook a fancy dinner together', 'Order takeout and play games'],
  ['A cabin in the snowy woods', 'A little house on the beach'],
  ['A big surprise party', 'A quiet celebration for two'],
  ['A road trip with no map', 'A perfectly planned itinerary'],
  ['Relive our first date', 'Skip ahead and see our future'],
  ['Matching pajamas', 'Matching sneakers'],
  ['Cuddle on the couch with a series', 'Wrap up in blankets under the stars'],
  ['Learn a new dance together', 'Learn a new language together'],
  ['Get a puppy together', 'Get a kitten together'],
  ['Only ever text each other', 'Only ever call each other'],
  ['A photo booth strip every month', 'A postcard from every trip'],
  ['Walk in the rain sharing one umbrella', 'Have a snowball fight'],
  ['A full day at an amusement park', 'A museum and coffee crawl'],
  ['A shared playlist for our life', 'A shared journal for our life'],
  ['Stargazing on a rooftop', 'Chasing fireflies in a field'],
  ['Pizza every Friday', 'Pasta every Friday']
];
const WYR = { order:[], idx:0, step:0, her:null, his:null };
function wyrReset(){ WYR.order = shuffle(WYR_Q.map((_, i) => i)); WYR.idx = 0; WYR.step = 0; WYR.her = null; WYR.his = null; }
function pageWYR(){
  return { tone:'his', html:
    '<div class="page"><div class="page-head"><span class="chip">Game for two</span></div><h3 class="pg-title">Would you rather</h3>' +
    '<p class="pg-desc">Each of you picks in secret. Then see if you matched.</p><div class="wy-body"></div></div>',
    mount(f){
      if (!WYR.order.length) wyrReset();
      const el = $('.wy-body', f);
      function paint(){
        const q = WYQ(); const a = q[0], b = q[1];
        if (WYR.step < 2){
          const who = WYR.step === 0 ? 'her' : 'his';
          el.innerHTML =
            '<p class="wy-turn">' + esc(N(who)) + ', your pick</p><div class="wy-opts">' +
            '<button class="wy-opt" type="button" data-pick="0"><span class="wy-l">A</span><span>' + esc(a) + '</span></button>' +
            '<p class="wy-or">or</p>' +
            '<button class="wy-opt" type="button" data-pick="1"><span class="wy-l">B</span><span>' + esc(b) + '</span></button></div>' +
            (WYR.step === 1 ? '<p class="wy-lock">' + esc(N('her')) + ' has picked. No peeking!</p>' : '');
        } else {
          const same = WYR.her === WYR.his, pick = v => v === 0 ? a : b;
          el.innerHTML =
            '<div class="wy-res"><div class="wy-row her"><small>' + esc(N('her')) + ' picked ' + (WYR.her === 0 ? 'A' : 'B') + '</small>' + esc(pick(WYR.her)) + '</div>' +
            '<div class="wy-row his"><small>' + esc(N('his')) + ' picked ' + (WYR.his === 0 ? 'A' : 'B') + '</small>' + esc(pick(WYR.his)) + '</div></div>' +
            '<p class="wy-verdict">' + (same ? 'Same pick. You two are in sync.' : 'Different picks. Tell each other why.') + '</p>' +
            '<div class="page-foot"><button class="btn solid" type="button" data-wy="next">Next question</button></div>';
        }
      }
      el.addEventListener('click', e => {
        const p = e.target.closest('[data-pick]'), n = e.target.closest('[data-wy="next"]');
        if (p){ const v = +p.dataset.pick; if (WYR.step === 0){ WYR.her = v; WYR.step = 1; } else if (WYR.step === 1){ WYR.his = v; WYR.step = 2; } paint(); }
        if (n){ WYR.idx = (WYR.idx + 1) % WYR.order.length; if (WYR.idx === 0) shuffle(WYR.order); WYR.step = 0; WYR.her = WYR.his = null; paint(); }
      });
      paint();
    } };
}
function WYQ(){ return WYR_Q[WYR.order[WYR.idx]]; }

/* ---- Love quiz ---- */
const QZ = { about:'her', state:'idle', order:[], idx:0, score:0, opts:[], picked:null };
const qzList = side => db.quiz.filter(q => q.side === side);
function pageQuizBox(){
  const block = side => {
    const list = qzList(side);
    return '<h4>' + esc(poss(side)) + ' questions</h4>' + (list.length
      ? list.map(q => '<div class="qb-item"><span>' + esc(q.q) + '</span><button class="x" type="button" data-act="del-q" data-id="' + q.id + '" aria-label="Delete question">&times;</button></div>').join('')
      : '<p class="none">None yet.</p>');
  };
  return { tone:'her', html:
    '<div class="page"><div class="page-head"><span class="chip">Game for two</span></div><h3 class="pg-title">How well do you know me?</h3>' +
    '<p class="pg-desc">Write questions about yourself with three answers. Your person guesses on the next page.</p>' +
    '<div class="scroll qb">' + block('her') + block('his') + '</div>' +
    '<div class="page-foot"><button class="btn solid" type="button" data-act="new-q" data-side="' + (mySide() || 'her') + '">Add a question</button></div></div>' };
}
function pageQuizPlay(){
  return { tone:'his', html:
    '<div class="page"><div class="page-head"><span class="chip">Your turn to guess</span></div><h3 class="pg-title">The guessing game</h3><div class="qz-root"></div></div>',
    mount(f){
      const root = $('.qz-root', f);
      function startQ(){
        const q = qzList(QZ.about)[QZ.order[QZ.idx]];
        QZ.opts = shuffle(q.opts.map((t, i) => ({ t, ok: i === q.correct }))); QZ.picked = null;
      }
      function paint(){
        const list = qzList(QZ.about), name = N(QZ.about);
        let body = '';
        if (QZ.state === 'playing' && !list[QZ.order[QZ.idx]]) QZ.state = 'idle';
        if (QZ.state === 'idle'){
          body = list.length
            ? '<p class="qz-msg">' + list.length + (list.length === 1 ? ' question' : ' questions') + ' about ' + esc(name) + '.</p><div><button class="btn solid" type="button" data-qz="start">Start guessing</button></div>'
            : '<p class="qz-msg">No questions about ' + esc(name) + ' yet.</p><div><button class="btn solid" type="button" data-act="new-q" data-side="' + QZ.about + '">Write the first one</button></div>';
        } else if (QZ.state === 'playing'){
          const q = list[QZ.order[QZ.idx]];
          body = '<p class="qz-prog">Question ' + (QZ.idx + 1) + ' of ' + QZ.order.length + '</p><p class="qz-q">' + esc(q.q) + '</p>' +
            QZ.opts.map((o, i) => '<button class="qz-opt' + (QZ.picked !== null ? (o.ok ? ' ok' : (QZ.picked === i ? ' no' : '')) : '') + '" type="button" data-ans="' + i + '"' + (QZ.picked !== null ? ' disabled' : '') + '><span class="wy-l">' + 'ABC'[i] + '</span><span>' + esc(o.t) + '</span></button>').join('') +
            (QZ.picked !== null ? '<div class="page-foot"><button class="btn solid" type="button" data-qz="next">' + (QZ.idx + 1 >= QZ.order.length ? 'See results' : 'Next question') + '</button></div>' : '');
        } else {
          const n = QZ.order.length;
          const msg = QZ.score === n ? 'Perfect. You really pay attention.' : QZ.score >= n / 2 ? 'Pretty good. A few things left to learn.' : 'Time for a long talk. Ask them everything.';
          body = '<p class="qz-msg">You got ' + QZ.score + ' of ' + n + ' about ' + esc(name) + '.</p><p class="pg-desc">' + msg + '</p><div><button class="btn solid" type="button" data-qz="start">Play again</button></div>';
        }
        root.innerHTML = '<div class="seg">' + ['her', 'his'].map(s => '<button class="seg-b ' + s + '" type="button" data-about="' + s + '" aria-pressed="' + (QZ.about === s) + '">Guess about ' + esc(N(s)) + '</button>').join('') + '</div><div class="qz-area">' + body + '</div>';
      }
      root.addEventListener('click', e => {
        const ab = e.target.closest('[data-about]'), st = e.target.closest('[data-qz="start"]'), nx = e.target.closest('[data-qz="next"]'), an = e.target.closest('[data-ans]');
        if (ab){ QZ.about = ab.dataset.about; QZ.state = 'idle'; paint(); }
        if (st){ const n = qzList(QZ.about).length; QZ.order = shuffle(Array.from({ length:n }, (_, i) => i)); QZ.idx = 0; QZ.score = 0; QZ.state = 'playing'; startQ(); paint(); }
        if (an && QZ.picked === null){ const i = +an.dataset.ans; QZ.picked = i; if (QZ.opts[i].ok) QZ.score++; paint(); }
        if (nx){ if (QZ.idx + 1 >= QZ.order.length){ QZ.state = 'done'; } else { QZ.idx++; startQ(); } paint(); }
      });
      paint();
    } };
}

/* ================= GAME ROOM ================= */
const getBest = k => (db.best && db.best[k]) || 0;
function setBest(k, v){ db.best = db.best || {}; db.best[k] = v; saveData(); }
const pickOne = a => a[Math.floor(Math.random() * a.length)];
function fitCanvas(cv, w, h){
  const d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * d); cv.height = Math.round(h * d);
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); return c;
}
function rrect(c, x, y, w, h, r){
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/* ---- the game list: add a new game by adding one line here ---- */
const GAMES = [
  { id:'memory',  title:'Memory Match',     icon:'\uD83C\uDCCF', blurb:'Flip cards and find all eight pairs.',            a:'#ffd3e0', b:'#e2d6ff', pages:[pageMemory] },
  { id:'wyr',     title:'Would You Rather', icon:'\uD83E\uDD14', blurb:'Pick in secret, then see if you matched.',        a:'#d7e3ff', b:'#e9d9ff', pages:[pageWYR] },
  { id:'quiz',    title:'Love Quiz',        icon:'\uD83D\uDC8C', blurb:'Write questions about yourself. Your person guesses.', a:'#ffe1c9', b:'#ffd3e0', pages:[pageQuizBox, pageQuizPlay] },
  { id:'hearts',  title:'Catch the Hearts', icon:'\uD83D\uDC97', blurb:'Catch falling hearts. Dodge the broken ones.',    a:'#ffc2d6', b:'#c9b8ff', mount:mountHearts },
  { id:'scratch', title:'Scratch & Reveal', icon:'\uD83C\uDF9F\uFE0F', blurb:'Scratch a card to win a love coupon.',      a:'#fff0bf', b:'#ffd0e2', mount:mountScratch },
  { id:'wheel',   title:'Spin the Wheel',   icon:'\uD83C\uDFA1', blurb:'Date ideas, truths and dares.',                   a:'#cfe0ff', b:'#ffd6e8', mount:mountWheel },
  { id:'ttt',     title:'Hearts vs Stars',  icon:'\u2B50',       blurb:'Tic-tac-toe with a score that lasts.',            a:'#ffd3e0', b:'#cfe0ff', mount:mountTTT },
  { id:'draw',    title:'Quick Draw',       icon:'\u26A1',       blurb:'Wait for NOW, then tap your side first.',         a:'#ffe7a8', b:'#ffbfd0', mount:mountQuickDraw },
  { id:'aura',    title:'Ask the Aura',     icon:'\uD83D\uDD2E', blurb:'A magic orb for the big questions.',              a:'#d9c6ff', b:'#bcd3ff', mount:mountAura }
];

/* ---- stage: open / close a game ---- */
let activeGame = null;
function buildGameGrid(){
  $('#gamesContainer').innerHTML = GAMES.map(g =>
    '<button class="game-card" type="button" data-game="' + g.id + '" style="--art-a:' + g.a + ';--art-b:' + g.b + '">' +
    '<span class="game-art" aria-hidden="true"><span>' + g.icon + '</span></span>' +
    '<span class="game-blurb">' + esc(g.blurb) + '</span><span class="game-title">' + esc(g.title) + '</span></button>').join('');
}
function renderGame(){
  const g = activeGame.g, body = $('#gameBody');
  if (activeGame.cleanup){ activeGame.cleanup(); activeGame.cleanup = null; }
  body.innerHTML = ''; body.className = 'game-body';
  if (g.pages){
    body.classList.add('papers');
    g.pages.forEach(fn => {
      const pg = fn(), paper = document.createElement('div');
      paper.className = 'game-paper tone-' + pg.tone; paper.innerHTML = pg.html;
      body.appendChild(paper); if (pg.mount) pg.mount(paper);
    });
  } else activeGame.cleanup = g.mount(body) || null;
}
function openGame(id){
  const g = GAMES.find(x => x.id === id); if (!g) return;
  closeGame();
  activeGame = { g, cleanup:null };
  $('#gamesContainer').hidden = true; $('#gameStage').hidden = false; $('#gameTitle').textContent = g.title;
  renderGame();
}
function closeGame(){
  if (activeGame && activeGame.cleanup) activeGame.cleanup();
  activeGame = null; $('#gameBody').innerHTML = '';
  $('#gameStage').hidden = true; $('#gamesContainer').hidden = false;
}
buildGameGrid();
$('#gamesContainer').addEventListener('click', e => { const c = e.target.closest('[data-game]'); if (c) openGame(c.dataset.game); });
$('#btnAllGames').addEventListener('click', closeGame);
$('#gameBody').addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (t) onAction(t); });

/* ================= 1. Catch the Hearts ================= */
function mountHearts(body){
  const W = 400, H = 500;
  body.innerHTML =
    '<div class="hud"><span>Score<b id="hsc">0</b></span><span>Lives<b id="hlv">3</b></span><span>Best<b id="hbs">' + getBest('hearts') + '</b></span></div>' +
    '<canvas class="g-canvas" id="hcv" aria-label="Catch the Hearts game"></canvas>' +
    '<p class="g-msg" id="hmsg">Drag, or use the arrow keys, to move the basket. Dodge the broken hearts.</p>' +
    '<button class="g-btn" id="hgo" type="button">Start</button>';
  const cv = $('#hcv', body), ctx = fitCanvas(cv, W, H);
  const KINDS = [{ e:'\uD83D\uDC97', pts:1, w:46 }, { e:'\uD83D\uDC99', pts:1, w:46 }, { e:'\u2728', pts:5, w:8 }, { e:'\uD83D\uDC94', pts:0, bad:true, w:24 }];
  const stars = Array.from({ length:40 }, () => ({ x:Math.random() * W, y:Math.random() * H, r:1 + Math.random() * 1.6, p:Math.random() * 6 }));
  const items = [], parts = [], keys = { l:false, r:false };
  let raf = 0, last = 0, run = false, score = 0, lives = 3, px = W / 2, tx = W / 2, spawn = 0, shake = 0;

  const pickKind = () => { let n = Math.random() * 124; for (const k of KINDS){ if ((n -= k.w) < 0) return k; } return KINDS[0]; };
  const hud = () => { $('#hsc', body).textContent = score; $('#hlv', body).textContent = '\u2665'.repeat(Math.max(0, lives)) || '\u2013'; };
  function burst(x, y, col){ for (let i = 0; i < 12; i++){ const a = Math.random() * 6.283, s = 70 + Math.random() * 150; parts.push({ x, y, vx:Math.cos(a) * s, vy:Math.sin(a) * s - 70, life:.65, col }); } }
  function start(){
    items.length = 0; parts.length = 0; score = 0; lives = 3; px = tx = W / 2; spawn = 0; run = true;
    hud(); $('#hmsg', body).textContent = 'Go!'; $('#hgo', body).hidden = true;
  }
  function end(){
    run = false; let m = 'Game over. You caught ' + score + '.';
    if (score > getBest('hearts')){ setBest('hearts', score); $('#hbs', body).textContent = score; m += ' A new best!'; }
    $('#hmsg', body).textContent = m; const b = $('#hgo', body); b.hidden = false; b.textContent = 'Play again';
  }
  function frame(t){
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.033, (t - last) / 1000 || 0); last = t;
    if (run){
      tx = clamp(tx + (keys.r - keys.l) * 420 * dt, 40, W - 40);
      px += (tx - px) * Math.min(1, dt * 14);
      spawn -= dt;
      if (spawn <= 0){
        spawn = Math.max(.3, .85 - score * .01);
        items.push({ k:pickKind(), x:26 + Math.random() * (W - 52), y:-30, v:120 + Math.random() * 50 + Math.min(score * 2.5, 200), r:Math.random() * 6, rv:(Math.random() - .5) * 3 });
      }
      for (let i = items.length - 1; i >= 0; i--){
        const it = items[i]; it.y += it.v * dt; it.r += it.rv * dt;
        if (it.y > H - 70 && it.y < H - 26 && Math.abs(it.x - px) < 54){
          items.splice(i, 1);
          if (it.k.bad){ lives--; shake = .35; burst(it.x, it.y, '#9aa0b5'); }
          else { score += it.k.pts; burst(it.x, it.y, it.k.pts > 1 ? '#ffd86b' : '#ff8fb1'); }
          hud(); if (lives <= 0){ end(); break; }
        } else if (it.y > H + 30) items.splice(i, 1);
      }
    }
    for (let i = parts.length - 1; i >= 0; i--){ const p = parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; if (p.life <= 0) parts.splice(i, 1); }

    ctx.save();
    if (shake > 0){ shake -= dt; ctx.translate((Math.random() - .5) * 9, (Math.random() - .5) * 9); }
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b1242'); g.addColorStop(1, '#14224f');
    ctx.fillStyle = g; ctx.fillRect(-12, -12, W + 24, H + 24);
    ctx.fillStyle = '#fff';
    stars.forEach(s => { ctx.globalAlpha = .25 + .6 * Math.abs(Math.sin(t / 900 + s.p)); ctx.fillRect(s.x, s.y, s.r, s.r); });
    ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '34px serif';
    items.forEach(it => { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(Math.sin(it.r) * .35); ctx.fillText(it.k.e, 0, 0); ctx.restore(); });
    parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / .65); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.283); ctx.fill(); });
    ctx.globalAlpha = 1;
    ctx.shadowColor = '#ff8fb1'; ctx.shadowBlur = 18;
    const bg = ctx.createLinearGradient(px - 48, 0, px + 48, 0); bg.addColorStop(0, '#e8718c'); bg.addColorStop(1, '#5b8af0');
    ctx.fillStyle = bg; rrect(ctx, px - 48, H - 58, 96, 30, 15); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '16px serif'; ctx.fillText('\u2665', px, H - 43);
    ctx.restore();
  }
  const setX = e => { const r = cv.getBoundingClientRect(); tx = clamp((e.clientX - r.left) * W / r.width, 40, W - 40); };
  cv.addEventListener('pointermove', setX); cv.addEventListener('pointerdown', setX);
  const kd = e => { const k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'a'){ keys.l = true; e.preventDefault(); } if (k === 'arrowright' || k === 'd'){ keys.r = true; e.preventDefault(); } };
  const ku = e => { const k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'a') keys.l = false; if (k === 'arrowright' || k === 'd') keys.r = false; };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
  $('#hgo', body).addEventListener('click', start);
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); };
}

/* ================= 2. Scratch & Reveal ================= */
const COUPONS = [
  'breakfast in bed, delivered by me', 'movie of your choice, no arguments', 'ten minute back rub', 'slow dance in the kitchen',
  'dishes done tonight', 'handwritten love letter', 'surprise picnic', 'ice cream date, my treat', 'sleep in while I handle the morning',
  'wish granted (within reason)', 'song dedicated to you', 'cuddle marathon, phones away', 'your favorite meal, cooked by me',
  'long walk holding hands', 'game night where you get to pick', 'one honest compliment for every hour of the day'
];
function mountScratch(body){
  body.innerHTML =
    '<p class="g-msg">Scratch the card to reveal your love coupon.</p>' +
    '<div class="scratch-wrap"><div class="coupon" id="cpn"></div><canvas class="scratch-cv" id="scv" aria-label="Scratch card"></canvas></div>' +
    '<button class="g-btn" id="snew" type="button">Another coupon</button>';
  const wrapEl = $('.scratch-wrap', body), cv = $('#scv', body), cpn = $('#cpn', body);
  let ctx, w, h, down = false, lx = 0, ly = 0, done = false, lastCheck = 0, cur = '';
  function foil(){
    w = wrapEl.clientWidth; h = wrapEl.clientHeight; ctx = fitCanvas(cv, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c9b8ff'); g.addColorStop(.35, '#ffd0e2'); g.addColorStop(.7, '#bcd8ff'); g.addColorStop(1, '#e6c8ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    for (let i = 0; i < 46; i++){ ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2.5, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = 'rgba(70,30,100,.75)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'italic 600 ' + Math.round(w * .075) + 'px Fraunces, Georgia, serif'; ctx.fillText('Scratch here', w / 2, h / 2 - 8);
    ctx.font = Math.round(w * .06) + 'px serif'; ctx.fillText('\u2665', w / 2, h / 2 + w * .075);
  }
  function next(){
    done = false; cv.classList.remove('done');
    let c; do { c = pickOne(COUPONS); } while (c === cur);
    cur = c; cpn.innerHTML = '<span><small>Good for one</small>' + esc(c) + '</span>'; foil();
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * w / r.width, (e.clientY - r.top) * h / r.height]; };
  function check(){
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let clear = 0, tot = 0;
    for (let i = 3; i < d.length; i += 64){ tot++; if (d[i] < 40) clear++; }
    if (clear / tot > .55) reveal();
  }
  function reveal(){
    done = true; cv.classList.add('done');
    const r = wrapEl.getBoundingClientRect();
    for (let i = 0; i < 14; i++){
      const s = document.createElement('span'); s.className = 'float-heart'; s.textContent = pickOne(['\uD83D\uDC97', '\uD83D\uDC99', '\u2728', '\uD83D\uDC96']);
      s.style.left = (r.left + Math.random() * r.width) + 'px'; s.style.top = (r.top + r.height * .6 + Math.random() * 30) + 'px';
      s.style.animationDelay = (Math.random() * .4) + 's'; document.body.appendChild(s); setTimeout(() => s.remove(), 2400);
    }
  }
  function scratch(e){
    if (!down || done) return;
    const p = pos(e);
    ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(26, w * .09);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p[0] + .01, p[1] + .01); ctx.stroke(); lx = p[0]; ly = p[1];
    const now = performance.now(); if (now - lastCheck > 200){ lastCheck = now; check(); }
  }
  cv.addEventListener('pointerdown', e => { down = true; const p = pos(e); lx = p[0]; ly = p[1]; try { cv.setPointerCapture(e.pointerId); } catch (x) {} scratch(e); });
  cv.addEventListener('pointermove', scratch);
  const up = () => { if (down && !done) check(); down = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('#snew', body).addEventListener('click', next);
  next();
  return null;
}

/* ================= 3. Spin the Wheel ================= */
const WHEELS = {
  date: { label:'Date ideas', items:[
    ['Picnic', 'Pack snacks and have a picnic somewhere pretty.'], ['Movie night', 'Build a blanket fort and watch something you both pick.'],
    ['Cook together', 'Choose a recipe neither of you has tried and make it together.'], ['Stargazing', 'Find a dark spot, bring a blanket and name your own constellations.'],
    ['Dance night', 'Put on a playlist and dance in the living room.'], ['Dessert run', 'Go out for dessert only. Order one of everything.'],
    ['Photo walk', 'Take a walk and photograph each other. Add the best ones to the book.'], ['Game night', 'Play a board game with a silly forfeit for the loser.'] ] },
  truth: { label:'Truths', items:[
    ['First crush', 'Who was your first crush, and what happened?'], ['Best memory', 'What is your favorite memory of us so far?'],
    ['Secret habit', 'What weird habit do you have that I might not know about?'], ['First look', 'What was your first impression of me?'],
    ['Dream trip', 'Where would you take me if money did not matter?'], ['Little thing', 'What small thing do I do that makes your day better?'],
    ['A fear', 'What is something you have been afraid to tell me?'], ['In 5 years', 'Where do you see us in five years?'] ] },
  dare: { label:'Dares', items:[
    ['Dance', 'Dance for 30 seconds with no music.'], ['Compliments', 'Give me three compliments without repeating a word.'],
    ['Accent', 'Talk in a fancy accent until the next spin.'], ['Love song', 'Sing me a few lines of a love song, any song.'],
    ['Long hug', 'Give a 20 second hug. No letting go early.'], ['Poem', 'Make up a two line poem about me on the spot.'],
    ['Impression', 'Do your best impression of me.'], ['Forehead kiss', 'Kiss me on the forehead and tell me why.'] ] }
};
function mountWheel(body){
  const SIZE = 340, COLORS = ['#ffb3c7', '#d9c6ff', '#bcd3ff', '#ffd9b8'];
  body.innerHTML =
    '<div class="g-seg" id="wtabs"></div>' +
    '<div class="wheel-wrap"><div class="wheel-ptr"></div><canvas id="wcv" aria-label="Wheel"></canvas></div>' +
    '<button class="g-btn" id="wspin" type="button">Spin</button>' +
    '<div class="wheel-res" id="wres"><b>Ready when you are</b><p>Pick a wheel and give it a spin.</p></div>';
  const cv = $('#wcv', body), ctx = fitCanvas(cv, SIZE, SIZE);
  let mode = 'date', rot = 0, spinning = false, raf = 0;
  const tabs = () => { $('#wtabs', body).innerHTML = Object.keys(WHEELS).map(k => '<button type="button" data-m="' + k + '" aria-pressed="' + (k === mode) + '">' + WHEELS[k].label + '</button>').join(''); };
  function draw(){
    const items = WHEELS[mode].items, n = items.length, a = Math.PI * 2 / n, c = SIZE / 2, R = c - 4;
    ctx.clearRect(0, 0, SIZE, SIZE); ctx.save(); ctx.translate(c, c); ctx.rotate(rot);
    for (let i = 0; i < n; i++){
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, i * a, (i + 1) * a); ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.rotate((i + .5) * a); ctx.fillStyle = '#3c2842'; ctx.font = '700 14px Nunito, system-ui, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(items[i][0], R - 16, 0); ctx.restore();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(c, c, 26, 0, 6.283); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8718c'; ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u2665', c, c + 1);
  }
  function finish(){
    spinning = false; $('#wspin', body).disabled = false;
    const items = WHEELS[mode].items, a = Math.PI * 2 / items.length;
    const ang = (((-Math.PI / 2 - rot) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const it = items[Math.floor(ang / a) % items.length];
    const res = $('#wres', body); res.innerHTML = '<b>' + esc(it[0]) + '</b><p>' + esc(it[1]) + '</p>';
    res.classList.remove('pop'); void res.offsetWidth; res.classList.add('pop');
  }
  function spin(){
    if (spinning) return; spinning = true; $('#wspin', body).disabled = true;
    const start = rot, total = Math.PI * 2 * (5 + Math.random() * 2) + Math.random() * Math.PI * 2, dur = 4200, t0 = performance.now();
    (function step(now){
      const t = Math.min(1, ((now || performance.now()) - t0) / dur), e = 1 - Math.pow(1 - t, 4);
      rot = start + total * e; draw();
      if (t < 1) raf = requestAnimationFrame(step); else finish();
    })(t0);
  }
  $('#wtabs', body).addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || spinning) return;
    mode = b.dataset.m; tabs(); draw();
    $('#wres', body).innerHTML = '<b>Ready when you are</b><p>Give it a spin.</p>';
  });
  $('#wspin', body).addEventListener('click', spin);
  tabs(); draw();
  return () => cancelAnimationFrame(raf);
}

/* ================= 4. Hearts vs Stars (tic-tac-toe) ================= */
function mountTTT(body){
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const sc = Object.assign({ her:0, his:0, draw:0 }, (db.best && db.best.ttt) || {});
  let board, turn, over, starter = 'her';
  body.innerHTML =
    '<div class="hud"><span class="c-her">' + esc(N('her')) + ' \u2665<b id="t-her">' + sc.her + '</b></span><span>Draws<b id="t-draw" style="color:var(--ink)">' + sc.draw + '</b></span><span class="c-his">' + esc(N('his')) + ' \u2605<b id="t-his">' + sc.his + '</b></span></div>' +
    '<p class="g-msg" id="tmsg"></p><div class="ttt-grid" id="tgrid"></div><button class="g-btn" id="tnew" type="button">New round</button>';
  const grid = $('#tgrid', body), msg = $('#tmsg', body), cells = [];
  const mark = s => s === 'her' ? '\u2665' : '\u2605';
  for (let i = 0; i < 9; i++){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ttt-cell'; b.setAttribute('aria-label', 'Square ' + (i + 1));
    b.addEventListener('click', () => play(i)); grid.appendChild(b); cells.push(b);
  }
  function reset(){
    board = Array(9).fill(''); turn = starter; over = false;
    cells.forEach(c => { c.className = 'ttt-cell'; c.innerHTML = ''; c.disabled = false; });
    msg.textContent = N(turn) + ', your turn (' + mark(turn) + ')';
  }
  function finish(){
    starter = starter === 'her' ? 'his' : 'her'; db.best = db.best || {}; db.best.ttt = sc; saveData();
    $('#t-her', body).textContent = sc.her; $('#t-his', body).textContent = sc.his; $('#t-draw', body).textContent = sc.draw;
    cells.forEach(c => { c.disabled = true; });
  }
  function play(i){
    if (over || board[i]) return;
    board[i] = turn; cells[i].classList.add(turn); cells[i].innerHTML = '<span class="mark">' + mark(turn) + '</span>'; cells[i].disabled = true;
    const line = LINES.find(l => l.every(k => board[k] === turn));
    if (line){ over = true; line.forEach(k => cells[k].classList.add('win')); sc[turn]++; msg.textContent = N(turn) + ' wins the round!'; finish(); return; }
    if (board.every(Boolean)){ over = true; sc.draw++; msg.textContent = 'A draw. Nobody loses in love.'; finish(); return; }
    turn = turn === 'her' ? 'his' : 'her'; msg.textContent = N(turn) + ', your turn (' + mark(turn) + ')';
  }
  $('#tnew', body).addEventListener('click', reset);
  reset();
  return null;
}

/* ================= 5. Quick Draw ================= */
function mountQuickDraw(body){
  const WIN = 3, sc = { her:0, his:0 };
  let state = 'idle', t0 = 0, timer = 0, matchOver = false;
  body.innerHTML =
    '<p class="g-msg" id="qmsg">First to 3 wins. Wait for NOW, then tap your side.</p>' +
    '<div class="qd" id="qd">' +
      '<button class="qd-side her" type="button" data-s="her"><span class="qd-name">' + esc(N('her')) + '</span><span>Tap here or press A</span><b id="q-her">0</b></button>' +
      '<button class="qd-side his" type="button" data-s="his"><span class="qd-name">' + esc(N('his')) + '</span><span>Tap here or press L</span><b id="q-his">0</b></button>' +
    '</div>' +
    '<p class="g-msg" id="qbest" style="font:600 15px var(--sans);color:var(--ink-soft)"></p>' +
    '<button class="g-btn" id="qgo" type="button">Start round</button>';
  const qd = $('#qd', body), msg = $('#qmsg', body), go = $('#qgo', body);
  const other = s => s === 'her' ? 'his' : 'her';
  const say = (t, now) => { msg.textContent = t; msg.classList.toggle('now', !!now); };
  const showBest = () => { const b = getBest('qd'); $('#qbest', body).textContent = b ? 'Fastest reaction so far: ' + b + ' ms' : ''; };
  const paint = () => { $('#q-her', body).textContent = sc.her; $('#q-his', body).textContent = sc.his; };
  function arm(){
    if (state !== 'idle') return;
    if (matchOver){ sc.her = sc.his = 0; matchOver = false; paint(); }
    state = 'wait'; qd.className = 'qd wait'; go.hidden = true; say('Wait for it\u2026');
    timer = setTimeout(() => { state = 'go'; qd.className = 'qd go'; t0 = performance.now(); say('NOW!', true); }, 1500 + Math.random() * 3200);
  }
  function award(w, text){
    state = 'idle'; qd.className = 'qd'; sc[w]++; paint(); go.hidden = false;
    if (sc[w] >= WIN){ matchOver = true; say(text + ' ' + N(w) + ' takes the match!'); go.textContent = 'Play again'; }
    else { say(text); go.textContent = 'Next round'; }
  }
  function hit(s){
    if (state === 'wait'){ clearTimeout(timer); award(other(s), N(s) + ' jumped the gun. ' + N(other(s)) + ' gets the point.'); }
    else if (state === 'go'){
      const ms = Math.round(performance.now() - t0), b = getBest('qd');
      if (!b || ms < b){ setBest('qd', ms); showBest(); }
      award(s, N(s) + ' wins in ' + ms + ' ms.');
    }
  }
  qd.addEventListener('pointerdown', e => { const b = e.target.closest('[data-s]'); if (b){ e.preventDefault(); hit(b.dataset.s); } });
  const kd = e => { if (e.repeat) return; const k = e.key.toLowerCase(); if (k === 'a') hit('her'); else if (k === 'l') hit('his'); };
  document.addEventListener('keydown', kd);
  go.addEventListener('click', arm); showBest();
  return () => { clearTimeout(timer); document.removeEventListener('keydown', kd); };
}

/* ================= 6. Ask the Aura ================= */
const AURA = [
  'Yes, and soon.', 'Ask again after a hug.', 'The stars say yes.', 'Not tonight, love.', 'Definitely.', 'Only if dessert is involved.',
  'Trust your heart.', 'Ask them. They are right there.', 'A kiss will help you decide.', 'Everything points to yes.',
  'Maybe. Sleep on it together.', 'Yes, but hold hands first.', 'The aura is cloudy. Try a slow dance.', 'Go for it.',
  'Snacks first, then decide.', 'Not yet. Good things are on the way.'
];
function mountAura(body){
  body.innerHTML =
    '<p class="g-msg">Think of a question for the two of you, then tap the orb.</p>' +
    '<button class="aura" id="aura" type="button" aria-label="Ask the aura"><span class="aura-ring"></span><span class="aura-in"><span id="atxt">Tap me</span></span></button>' +
    '<p class="g-msg" style="font:400 14px var(--sans);color:var(--ink-soft)">Answers are just for fun. The real decisions are yours.</p>';
  const orb = $('#aura', body), txt = $('#atxt', body); let busy = false, lastA = -1, tm = 0;
  orb.addEventListener('click', () => {
    if (busy) return; busy = true; txt.style.opacity = 0; orb.classList.add('ask');
    tm = setTimeout(() => {
      let i; do { i = Math.floor(Math.random() * AURA.length); } while (i === lastA);
      lastA = i; txt.textContent = AURA[i]; txt.style.opacity = 1; orb.classList.remove('ask'); busy = false;
    }, 1300);
  });
  return () => clearTimeout(tm);
}

