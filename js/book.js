'use strict';

/* ================= book engine ================= */
const bookEl = $('#book'), shell = $('#shell'), tabsEl = $('#tabs');
const book = { S:[], sec:{}, leaves:[], c:0, maxC:0, single:false, pw:400, ph:560, s:1 };
let built = false, userTouched = false;

/* Dyed-ribbon bookmarks. Each colour is checked to at least 4.5:1 against its
   own label, since the tab text is bold 13.5px and so not "large text". */
const TABS = [
  { id:'stories',  label:'Stories',    short:'Stories', e:'\uD83D\uDCD6', bg:'#a32a5e', fg:'#fffafd' },
  { id:'memories', label:'Memories',   short:'Photos',  e:'\uD83D\uDCF8', bg:'#5b3496', fg:'#fffafd' },
  { id:'notes',    label:'Love notes', short:'Notes',   e:'\uD83D\uDC8C', bg:'#d9a441', fg:'#2a2213' },
  { id:'movies',   label:'Movies',     short:'Movies',  e:'\uD83C\uDF7F', bg:'#7a2a6e', fg:'#fffafd' },
  { id:'dates',    label:'Dates',      short:'Dates',   e:'\uD83C\uDF39', bg:'#c0427e', fg:'#fffafd' }
];
const SEC_LABEL = { cover:'The cover', intro:'Contents', stories:'Stories', memories:'Memories', notes:'Love notes', movies:'Movies', dates:'Dates', end:'The end' };

function computeLayout(){
  const w = window.innerWidth, h = window.innerHeight;
  const single = w < 900;
  let pw, ph;
  if (single){ pw = Math.min(w - 36, 430); ph = Math.max(430, Math.min(h - 232, pw * 1.5, 690)); }
  else { const pw0 = Math.min((w - 270) / 2, 540); ph = Math.max(450, Math.min(h - 215, pw0 * 1.42, 740)); pw = Math.min(pw0, ph * .8); }
  const s = clamp(pw / 470, .85, 1.12);
  book.pw = pw; book.ph = ph; book.s = s;
  shell.style.setProperty('--pw', pw + 'px'); shell.style.setProperty('--ph', ph + 'px'); shell.style.setProperty('--s', s.toFixed(3));
  shell.style.setProperty('--bw', (single ? pw : pw * 2) + 'px');
  return single;
}

/* ---------- page builders ---------- */
function pageCover(){
  return { tone:'cover', html:
    '<div class="cover" data-act="open"><div class="cover-inner">' +
      '<div class="cover-orn" aria-hidden="true">&#9829;</div>' +
      '<h2 class="cover-title">Our Story</h2>' +
      '<p class="cover-names"><span class="nm-her">' + esc(N('her')) + '</span><span class="amp">&amp;</span><span class="nm-his">' + esc(N('his')) + '</span></p>' +
      '<p class="cover-sub">two sides, one story</p>' +
      '<button class="cover-open" type="button" data-act="open">Open the book</button>' +
    '</div></div>' };
}
function pageBack(){
  return { tone:'back', html:
    '<div class="cover back-cover"><div class="cover-inner">' +
      '<div class="cover-orn" aria-hidden="true">&#9829;</div>' +
      '<h2 class="cover-title" style="font-size:calc(40px*var(--s))">The end,<br>for now</h2>' +
      '<p class="cover-sub">There is always room for another chapter.</p>' +
      '<button class="cover-open" type="button" data-act="restart">Back to the beginning</button>' +
    '</div></div>' };
}
function daysTogether(){
  if (!db.since) return null;
  const a = new Date(db.since + 'T00:00:00'), b = new Date(); b.setHours(0, 0, 0, 0);
  const d = Math.round((b - a) / 86400000);
  return isNaN(d) ? null : d;
}
function pageBelongs(){
  const d = daysTogether();
  const together = d === null
    ? '<div class="together"><p>Add the day you got together and this page will count every day since.</p><p><button class="btn solid" type="button" data-act="settings">Set the date</button></p></div>'
    : '<div class="together"><div class="days">' + (d < 0 ? 'Soon' : d.toLocaleString()) + '</div><p>' + (d === 1 ? 'day' : 'days') + ' of us</p></div>';
  return { tone:'her', html:
    '<div class="page"><div class="belong">' +
      '<p class="lead">This book belongs to</p>' +
      '<p class="nm her">' + esc(N('her')) + '</p><p class="amp">&amp;</p><p class="nm his">' + esc(N('his')) + '</p>' +
      together +
    '</div><div class="page-foot" style="justify-content:center"><button class="btn ghost" type="button" data-act="settings">Names, date and secret word</button></div></div>' };
}
function pageContents(){
  const rows = [
    ['stories',  '\uD83D\uDCD6', 'Stories',    'Write your chapters, side by side'],
    ['memories', '\uD83D\uDCF8', 'Memories',   'Your photos, pinned like polaroids'],
    ['notes',    '\uD83D\uDC8C', 'Love notes', 'Little messages for each other'],
    ['movies',   '\uD83C\uDF7F', 'Movies',     'Movies we enjoy together'],
    ['dates',    '\uD83C\uDF39', 'Dates',      'Time we spent together']
  ].map(r => '<button class="toc-row" type="button" data-act="sec" data-sec="' + r[0] + '"><span class="e" aria-hidden="true">' + r[1] + '</span><span><b>' + r[2] + '</b><span class="d">' + r[3] + '</span></span></button>').join('');
  return { tone:'his', html:
    '<div class="page"><h3 class="pg-title">Inside this book</h3><div class="toc">' + rows + '</div>' +
    '<p class="pg-desc" style="text-align:center">Turn pages with the arrows, the page edges, or the bookmarks.</p></div>' };
}
function pageStory(side, story, idx, total){
  if (!story){
    return { tone:side, html:
      '<div class="page"><div class="page-head"><span class="chip">' + esc(poss(side)) + ' side</span></div>' +
      '<div class="empty"><p class="pg-title" style="font-size:1.4em">Nothing here yet</p>' +
      '<p class="soft">' + esc(N(side)) + ', this page is waiting for a story.</p>' +
      '<button class="btn solid" type="button" data-act="new-story" data-side="' + side + '">Write a story</button></div></div>' };
  }
  return { tone:side, html:
    '<div class="page"><div class="page-head"><span class="chip">' + esc(poss(side)) + ' story</span><span class="count">' + (idx + 1) + ' of ' + total + '</span></div>' +
    '<h3 class="story-title">' + esc(story.title || 'Untitled') + '</h3>' +
    '<p class="story-date">' + esc(fmtDate(story.date)) + '</p>' +
    '<div class="scroll story-body">' + esc(story.body) + '</div>' +
    '<div class="page-foot"><button class="btn ghost" type="button" data-act="del-story" data-id="' + story.id + '">Delete</button>' +
    '<button class="btn" type="button" data-act="edit-story" data-id="' + story.id + '">Edit</button>' +
    '<button class="btn solid" type="button" data-act="new-story" data-side="' + side + '">New story</button></div></div>' };
}

/* ---- photos ---- */
function polaroid(p){
  return '<button class="pol" type="button" data-act="photo" data-id="' + p.id + '" style="--r:' + hashRot(p.id, 3).toFixed(1) + 'deg" aria-label="Open photo' + (p.cap ? ': ' + esc(p.cap) : '') + '">' +
    '<span class="pic" style="background-image:url(\'' + p.src + '\')"></span><span class="cap">' + esc(p.cap) + '</span></button>';
}
function pagePhotos(j, left){
  const start = j * 8 + (left ? 0 : 4), slice = photos.slice(start, start + 4);
  const cells = slice.map(polaroid).join('') + Array.from({ length: 4 - slice.length }, () => '<div class="pol blank" aria-hidden="true"></div>').join('');
  const head = left
    ? '<div class="page-head"><span class="chip">' + (j === 0 ? 'Our photos' : 'More photos') + '</span><button class="btn solid" type="button" data-act="add-photos">Add photos</button></div>'
    : '<div class="page-head"><span class="chip">' + photos.length + (photos.length === 1 ? ' memory' : ' memories') + '</span></div>';
  const note = (!photos.length && left) ? '<p class="pg-desc">Add a few photos and they get pinned here. They also float around the login orb.</p>' : '';
  return { tone: left ? 'her' : 'his', html:
    '<div class="page">' + head + '<h3 class="pg-title">' + (left ? 'Memories' : (j === 0 ? 'Pinned up' : 'Keep going')) + '</h3>' + note + '<div class="pol-grid">' + cells + '</div></div>' };
}

/* ---- love notes ---- */
function pageNotes(side){
  const list = db.notes.filter(n => n.side === side).slice().reverse();
  const body = list.length
    ? '<div class="scroll"><div class="notes">' + list.map(n => '<div class="note" style="--r:' + hashRot(n.id, 1.2).toFixed(1) + 'deg"><button class="x" type="button" data-act="del-note" data-id="' + n.id + '" aria-label="Delete note">&times;</button><p>' + esc(n.text) + '</p><time>' + esc(fmtDate(n.date)) + '</time></div>').join('') + '</div></div>'
    : '<div class="empty"><p class="soft">No notes from ' + esc(N(side)) + ' yet. Leave one for them to find.</p></div>';
  return { tone:side, html:
    '<div class="page"><div class="page-head"><span class="chip">Notes from ' + esc(N(side)) + '</span><span class="count">' + list.length + '</span></div>' +
    '<h3 class="pg-title">' + (side === 'her' ? 'Left on your pillow' : 'Tucked in your pocket') + '</h3>' + body +
    '<div class="page-foot"><button class="btn solid" type="button" data-act="new-note" data-side="' + side + '">Write a note</button></div></div>' };
}

/* ---- movies ---- */
function movieCard(m, listName, withMove){
  const img = m.thumb ? '<img class="thumb" src="' + esc(m.thumb) + '" alt="">' : '';
  const shown = m.link && m.thumb ? '<a href="' + esc(m.link) + '" target="_blank" rel="noopener noreferrer">' + img + '</a>' : img;
  const linkOnly = m.link && !m.thumb ? '<a class="ml" href="' + esc(m.link) + '" target="_blank" rel="noopener noreferrer">Open link</a>' : '';
  return '<div class="note movie-card" style="--r:' + hashRot(m.id, 1).toFixed(1) + 'deg">' +
    '<button class="x" type="button" data-act="del-movie" data-id="' + m.id + '" data-list="' + listName + '" aria-label="Delete">&times;</button>' + shown +
    '<p class="mt">' + esc(m.title) + '</p>' + linkOnly +
    (withMove ? '<div class="mact"><button class="btn solid" type="button" data-act="move-movie" data-id="' + m.id + '">Mark watched</button></div>' : '') +
    '</div>';
}
function pageWatchlist() {
  const list = db.watchlist || [];
  const body = list.length
    ? '<div class="scroll"><div class="card-grid">' + list.map(m => movieCard(m, 'watchlist', true)).join('') + '</div></div>'
    : '<div class="empty"><p class="soft">Nothing on the list yet. Add the one you keep meaning to watch.</p></div>';
  return { tone: 'her', html:
    '<div class="page"><div class="page-head"><span class="chip">To watch</span><span class="count">' + list.length + '</span></div>' +
    '<h3 class="pg-title">Movie nights, planned</h3>' + body +
    '<div class="page-foot"><button class="btn solid" type="button" data-act="new-movie">Add a movie</button></div></div>' };
}
function pageWatched() {
  const list = db.watched || [];
  const body = list.length
    ? '<div class="scroll"><div class="card-grid">' + list.map(m => movieCard(m, 'watched', false)).join('') + '</div></div>'
    : '<div class="empty"><p class="soft">Nothing watched yet. Mark one off the list and it lands here.</p></div>';
  return { tone: 'his', html:
    '<div class="page"><div class="page-head"><span class="chip">Watched</span><span class="count">' + list.length + '</span></div>' +
    '<h3 class="pg-title">Ones we have seen</h3>' + body +
    '</div>' };
}

/* ---- dates ---- */
function pageDates(side) {
  /* dates alternate between the two pages so each page has its own entries */
  const all = db.dates || [];
  const list = all.filter((_, i) => (i % 2 === 0) === (side === 'her'));
  const body = list.length
    ? '<div class="scroll"><div class="notes">' + list.map(d => {
      const img = d.thumb
        ? '<img class="dthumb" src="' + esc(d.thumb) + '" alt="">'
        : '<div class="dthumb"></div>';
      const playBtn = d.link
        ? '<a class="dplay" href="' + esc(d.link) + '" target="_blank" rel="noopener noreferrer" aria-label="Open link">&#9658;</a>'
        : '<div class="dplay off" aria-hidden="true"></div>';
      return '<div class="note date-row" style="--r:' + hashRot(d.id, 1).toFixed(1) + 'deg">' +
             '<button class="x" type="button" data-act="del-date" data-id="' + d.id + '" aria-label="Delete">&times;</button>' +
             img +
             '<div class="dmeta">' + playBtn + '<span class="dwhen">' + esc(fmtDate(d.date)) + '</span></div>' +
             '</div>';
    }).join('') + '</div></div>'
    : '<div class="empty"><p class="soft">No days logged yet. Add one and it keeps its place here.</p></div>';

  return { tone: side, html:
    '<div class="page"><div class="page-head"><span class="chip">Time we spent</span><span class="count">' + list.length + '</span></div>' +
    '<h3 class="pg-title">Days worth keeping</h3>' + body +
    '<div class="page-foot"><button class="btn solid" type="button" data-act="new-date">Add a date</button></div></div>' };
}

function openDateModal(){
  openModal('Add a Date',
    '<p class="m-hint">Log a special day we spent together.</p>' +
    '<label class="m-field">When was it?<input id="fDateVal" type="date"></label>' +
    '<label class="m-field">Picture<input id="fDateThumb" type="file" accept="image/*"></label>' +
    '<label class="m-field">Video/Song Link (Optional)<input id="fDateLink" type="text" placeholder="Paste a link for the play button"></label>' +
    '<div class="m-actions"><button class="m-btn" type="button" data-close>Cancel</button><button class="m-btn solid" type="button" id="fSaveDate">Save date</button></div>',
    root => {
      $('#fSaveDate', root).addEventListener('click', async () => {
        const dateVal = $('#fDateVal', root).value;
        const link = safeUrl($('#fDateLink', root).value);
        const fileInput = $('#fDateThumb', root);
        let thumbData = '';

        if (!dateVal){ toast('Please pick a date.'); return; }

        if (fileInput.files && fileInput.files.length > 0) {
          try { thumbData = await readPhoto(fileInput.files[0], 320); }
          catch (e) { toast("Couldn't read that image file."); return; }
        }

        db.dates.push({ id:uid(), date:dateVal, thumb:thumbData, link:link });
        db.dates.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        closeModal(); commit('Date added!');
      });
    });
}

/* ---------- assemble sides ---------- */
function buildSides(){
  const S = [], sec = {};
  S.push(pageCover()); S.push(pageBelongs()); S.push(pageContents());
  const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');
  const her = db.stories.filter(s => s.side === 'her').sort(byDate), his = db.stories.filter(s => s.side === 'his').sort(byDate);
  const k = Math.max(her.length, his.length, 1);
  sec.stories = S.length;
  for (let i = 0; i < k; i++){ S.push(pageStory('her', her[i], i, her.length)); S.push(pageStory('his', his[i], i, his.length)); }
  sec.memories = S.length;
  const m = Math.max(1, Math.ceil(photos.length / 8));
  for (let j = 0; j < m; j++){ S.push(pagePhotos(j, true)); S.push(pagePhotos(j, false)); }
  sec.notes = S.length;
  S.push(pageNotes('her')); S.push(pageNotes('his'));
  sec.movies = S.length;
  S.push(pageWatchlist()); S.push(pageWatched());
  sec.dates = S.length;
  S.push(pageDates('her')); S.push(pageDates('his'));
  S.push(pageBack());
  return { list:S, sec, herList:her, hisList:his };
}

function makeFace(page, kind, idx, single){
  const f = document.createElement('div');
  f.className = 'face ' + kind + ' tone-' + page.tone;
  f.innerHTML = page.html + '<i class="shade"></i>';
  if (kind === 'front'){
    f.insertAdjacentHTML('beforeend', '<button class="edge next" type="button" data-nav="1" tabindex="-1" aria-label="Next page"></button>');
    if (single && idx > 0) f.insertAdjacentHTML('beforeend', '<button class="edge prev" type="button" data-nav="-1" tabindex="-1" aria-label="Previous page"></button>');
  } else {
    f.insertAdjacentHTML('beforeend', '<button class="edge prev" type="button" data-nav="-1" tabindex="-1" aria-label="Previous page"></button>');
  }
  if (page.mount) page.mount(f);
  return f;
}
function makeBlank(){ const f = document.createElement('div'); f.className = 'face back blank'; f.innerHTML = '<i class="shade"></i>'; return f; }
function restZ(lf, i){ lf.style.zIndex = lf.classList.contains('flipped') ? (i + 1) : (book.leaves.length - i); }

function buildBook(){
  const b = buildSides();
  book.S = b.list; book.sec = b.sec; book.built = b;
  const nLeaves = book.single ? b.list.length : b.list.length / 2;
  book.maxC = book.single ? b.list.length - 1 : nLeaves;
  book.c = clamp(book.c, 0, book.maxC);
  bookEl.classList.add('noanim');
  $$('.leaf', bookEl).forEach(n => n.remove());
  book.leaves = [];
  for (let i = 0; i < nLeaves; i++){
    const leaf = document.createElement('div'); leaf.className = 'leaf';
    const front = makeFace(book.single ? b.list[i] : b.list[2 * i], 'front', i, book.single);
    const back = book.single ? makeBlank() : makeFace(b.list[2 * i + 1], 'back', i, false);
    leaf.appendChild(front); leaf.appendChild(back); bookEl.appendChild(leaf); book.leaves.push(leaf);
  }
  book.leaves.forEach((lf, i) => { lf.classList.toggle('flipped', i < book.c); restZ(lf, i); });
  renderTabs(); updateChrome();
  void bookEl.offsetWidth; bookEl.classList.remove('noanim');
}
function rebuildBook(){ if (built) buildBook(); }

function renderTabs(){
  tabsEl.innerHTML = TABS.map(t =>
    '<button class="tab" type="button" data-tab="' + t.id + '" style="--tc:' + t.bg + ';--tt:' + t.fg + '" aria-label="' + t.label + '">' +
    '<span class="tab-e" aria-hidden="true">' + t.e + '</span><span class="tab-l">' + t.label + '</span><span class="tab-s">' + t.short + '</span></button>').join('');
}
const cFromSide = n => book.single ? n : Math.ceil(n / 2);
function currentSection(){
  if (book.c === 0) return 'cover';
  if (book.c >= book.maxC) return 'end';
  const n = book.single ? book.c : 2 * book.c - 1;
  let cur = 'intro';
  TABS.forEach(t => { if (n >= book.sec[t.id]) cur = t.id; });
  return cur;
}
function updateChrome(){
  const c = book.c;
  const sec = currentSection();
  bookEl.classList.toggle('single', book.single); shell.classList.toggle('single', book.single);
  bookEl.classList.toggle('closed', c === 0); bookEl.classList.toggle('end', !book.single && c >= book.maxC);
  let tx = 0;
  if (!book.single){ if (c === 0) tx = -book.pw / 2; else if (c >= book.maxC) tx = book.pw / 2; }
  shell.style.transform = 'translateX(' + tx + 'px)';
  $$('.tab', tabsEl).forEach(t => t.classList.toggle('active', t.dataset.tab === sec));
  $('#navLabel').textContent = SEC_LABEL[sec];
  $('#prev').disabled = c <= 0; $('#next').disabled = c >= book.maxC;
  book.leaves.forEach((lf, i) => {
    const fr = lf.firstChild, bk = lf.lastChild;
    fr.inert = i !== c;
    bk.inert = book.single ? true : i !== c - 1;
  });
}

/* ---------- dust dissolve ----------
   The three phases never overlap: ink leaves, THEN the paper turns, THEN the new
   ink arrives. A multi-page jump dissolves out once, flips as many leaves as it
   needs, and dissolves in once at the destination, rather than strobing on every
   intermediate page. */
const DUST_OUT = 720, DUST_IN = 1500, FLIP_MS = 1250;

function visibleContent(){
  const faces = [];
  const cur = book.leaves[book.c], prev = book.leaves[book.c - 1];
  if (cur) faces.push(cur.firstChild);
  if (prev && !book.single) faces.push(prev.lastChild);
  return faces.map(f => f && ($('.page', f) || $('.cover-inner', f))).filter(Boolean);
}
const allContent = () => $$('.page, .cover-inner', bookEl);

/* cursor.js owns the particle pool and canvas; this just says where and which way */
function dustFrom(node, dir){
  if (typeof window.pageDust !== 'function') return;
  const r = node.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return;
  window.pageDust(r, dir, 90);
}

async function dustOut(){
  if (reduceMotion) return;
  const going = visibleContent();
  going.forEach(n => {
    clearTimeout(n._dt);
    n.classList.remove('dust-in', 'dust-out', 'dust-hidden');
    void n.offsetWidth;                       /* restart the animation */
    n.classList.add('dust-out');
    dustFrom(n, 1);
  });
  await sleep(DUST_OUT);
  /*
    Hide the ink on every OTHER page before the paper starts moving.

    Without this the incoming page was simply sitting there fully rendered: the
    leaf rotated, revealed a page nobody had dissolved, and then dust-in began by
    masking it away, so it appeared and then vanished before assembling. The
    arriving page has to be empty for the whole turn, and only then dust in.
  */
  allContent().forEach(n => { if (!n.classList.contains('dust-out')) n.classList.add('dust-hidden'); });
}

function dustIn(){
  if (reduceMotion) return;
  /* clear both holds in the same task as adding dust-in, so there is never a
     frame where unmasked ink is on screen */
  allContent().forEach(n => n.classList.remove('dust-out', 'dust-hidden'));
  visibleContent().forEach(n => {
    clearTimeout(n._dt);
    n.classList.remove('dust-in');
    void n.offsetWidth;
    n.classList.add('dust-in');
    dustFrom(n, -1);
    n._dt = setTimeout(() => n.classList.remove('dust-in'), DUST_IN + 150);
  });
}

let navToken = 0;
async function goTo(target){
  target = clamp(target, 0, book.maxC);
  if (book.c === target) return;
  const token = ++navToken;

  await dustOut();
  if (token !== navToken) return;

  while (book.c !== target){
    if (token !== navToken) return;
    flipStep(target > book.c ? 1 : -1);
    if (book.c !== target) await sleep(reduceMotion ? 10 : 190);
  }

  await sleep(reduceMotion ? 10 : FLIP_MS * 0.78);
  if (token !== navToken) return;
  dustIn();
}
function flipStep(dir){
  const i = dir > 0 ? book.c : book.c - 1;
  const leaf = book.leaves[i]; if (!leaf) return;
  leaf.style.zIndex = dir > 0 ? (200 + i) : (200 + book.leaves.length - i);
  leaf.classList.add('turning');
  book.c += dir; leaf.classList.toggle('flipped', dir > 0);
  updateChrome();
  /*
    Settle exactly when the transform finishes rather than on a 1000ms timer.
    The old timer fired 50ms after the .95s transition, so for those 50ms the
    leaf had stopped moving but was still elevated and still had `turning` on it;
    dropping the z-index then re-stacked an already-settled page and read as a
    shudder at the end of every flip. The timeout is kept only as a fallback for
    the case where the transition never fires (display:none, reduced motion).
  */
  clearTimeout(leaf._t);
  const settle = () => {
    clearTimeout(leaf._t);
    leaf.removeEventListener('transitionend', onEnd);
    leaf.classList.remove('turning');
    restZ(leaf, i);
  };
  function onEnd(e){ if (e.target === leaf && e.propertyName === 'transform') settle(); }
  leaf.addEventListener('transitionend', onEnd);
  leaf._t = setTimeout(settle, FLIP_MS + 150);
}
const goSection = id => { userTouched = true; goTo(cFromSide(book.sec[id])); };

