'use strict';

/* ================= toast + modal ================= */
let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3400); }

let lastFocus = null;
function openModal(title, html, onMount){
  lastFocus = document.activeElement;
  $('#mTitle').textContent = title;
  $('#mBody').innerHTML = html;
  $('#modal').hidden = false;
  $('#app').inert = true; $('#login').inert = true; $('#gamesScreen').inert = true;
  if (onMount) onMount($('#mBody'));
  const first = $('#mBody input:not([type=radio]), #mBody textarea');
  if (first) setTimeout(() => first.focus(), 50);
}
function closeModal(){
  $('#modal').hidden = true; $('#mBody').innerHTML = '';
  $('#app').inert = false; $('#login').inert = false; $('#gamesScreen').inert = false;
  /* discards any un-saved palette preview from the Settings modal */
  if (typeof applyTheme === 'function') applyTheme();
  if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch(e){}
}
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

function armed(btn, fn, label){
  if (btn.dataset.armed){ clearTimeout(btn._t); fn(); return; }
  btn.dataset.armed = '1'; btn._orig = btn.innerHTML; btn.classList.add('armed'); btn.innerHTML = label || 'Sure?';
  btn._t = setTimeout(() => { delete btn.dataset.armed; btn.classList.remove('armed'); btn.innerHTML = btn._orig; }, 2600);
}

/* ================= theme =================
   db.theme is '' (follow the device), 'light' or 'dark'. The matching
   data-theme attribute is also set by a tiny inline script in index.html so the
   saved choice is already on <html> before the first paint. */
function systemPrefersDark(){
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function themeIsDark(){
  return db.theme ? db.theme === 'dark' : systemPrefersDark();
}
function applyTheme(){
  const root = document.documentElement;
  if (db.theme) root.setAttribute('data-theme', db.theme);
  else root.removeAttribute('data-theme');
  const b = $('#btnTheme');
  if (b){
    const dark = themeIsDark();
    b.textContent = dark ? 'Daylight' : 'Lamplight';
    b.setAttribute('aria-pressed', String(dark));
    b.title = dark ? 'Switch to the light palette' : 'Switch to the dark palette';
  }
  /* cursor.js and orb.js both read the palette off :root, so they have to be told
     when it moves. Guarded because both load after this file. */
  if (typeof window.refreshSparkleColours === 'function') window.refreshSparkleColours();
  if (typeof window.refreshOrbColours === 'function') window.refreshOrbColours();
}
function toggleTheme(){
  db.theme = themeIsDark() ? 'light' : 'dark';
  saveData(); applyTheme();
}
$('#btnTheme').addEventListener('click', toggleTheme);
/* if the choice is "follow the device", track the device changing its mind */
if (window.matchMedia){
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => { if (!db.theme) applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

/* ================= narrow-screen menu ================= */
/* Under 900px the side rail would sit on top of the single-page book, so it
   collapses into this disclosure instead. See the media query in book.css. */
const appEl = $('#app');
function setMenu(open){
  appEl.classList.toggle('menu-open', open);
  $('#btnMenu').setAttribute('aria-expanded', String(open));
}
$('#btnMenu').addEventListener('click', e => { e.stopPropagation(); setMenu(!appEl.classList.contains('menu-open')); });
$('#sideMenu').addEventListener('click', () => setMenu(false));
document.addEventListener('click', e => {
  if (!appEl.classList.contains('menu-open')) return;
  if (e.target.closest('#sideMenu') || e.target.closest('#btnMenu')) return;
  setMenu(false);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

/* ================= sparkles + photo field ================= */
(function makeSparkles(){
  const box = $('#sparkles');
  for (let i = 0; i < 24; i++){
    const s = document.createElement('i');
    s.style.cssText = 'left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;--d:' + (3 + Math.random() * 5) + 's;--dl:' + (-Math.random() * 6) + 's;--z:' + (.6 + Math.random() * 1.3);
    box.appendChild(s);
  }
})();

const field = $('#photoField');
let phCursor = 0;
function reslot(el, first){
  const pic = $('.pic', el);
  pic.className = 'pic'; pic.style.backgroundImage = '';
  if (photos.length){ pic.style.backgroundImage = 'url("' + photos[phCursor++ % photos.length].src + '")'; }
  else { pic.classList.add('empty'); pic.classList.add(phCursor++ % 2 ? 'tone-blue' : 'tone-rose'); }
  const W = window.innerWidth, H = window.innerHeight;
  const w = W < 700 ? 104 : Math.min(190, Math.max(120, W * .13));
  const h = w * 1.4;
  let x = 10, y = 10, tries = 0, ok = false;
  while (!ok && tries < 50){
    x = 10 + Math.random() * Math.max(10, W - w - 20);
    y = 10 + Math.random() * Math.max(10, H - h - 20);
    const dx = Math.abs(x + w / 2 - W / 2) / (W / 2), dy = Math.abs(y + h / 2 - H / 2) / (H / 2);
    ok = (dx * dx + dy * dy) > .42; tries++;
  }
  if (!ok){ x = Math.random() < .5 ? 10 : W - w - 10; y = Math.random() < .5 ? 10 : H - h - 10; }
  const s = el.style;
  s.setProperty('--w', w + 'px'); s.setProperty('--x', x + 'px'); s.setProperty('--y', y + 'px');
  s.setProperty('--r', ((Math.random() * 14) - 7).toFixed(1) + 'deg');
  s.setProperty('--dx', ((Math.random() * 60) - 30).toFixed(0) + 'px'); s.setProperty('--dy', (-10 - Math.random() * 40).toFixed(0) + 'px');
  s.setProperty('--dur', (9 + Math.random() * 5).toFixed(1) + 's');
  s.setProperty('--delay', (first ? Math.random() * 6 : Math.random() * 1.2).toFixed(1) + 's');
  s.animation = 'none'; void el.offsetWidth; s.animation = '';
}
function buildPhotoField(){
  field.innerHTML = '';
  const n = window.innerWidth < 700 ? 5 : 8;
  for (let i = 0; i < n; i++){
    const el = document.createElement('div'); el.className = 'ph'; el.innerHTML = '<div class="pic"></div>';
    el.addEventListener('animationend', () => reslot(el, false));
    field.appendChild(el); reslot(el, true);
  }
}
function updateLoginTools(){
  const n = photos.length;
  $('#btnLoginPhotos').textContent = n ? 'Add more photos' : 'Add our photos';
  const pc = $('#photoCount'); pc.style.display = n ? '' : 'none'; pc.textContent = n + (n === 1 ? ' photo' : ' photos');
  $('#btnClearPhotos').style.display = n ? '' : 'none';
}

/* ---- photo upload ---- */
function readPhoto(file, maxSize){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = maxSize || 640, sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', .74));
      };
      img.onerror = reject; img.src = fr.result;
    };
    fr.onerror = reject; fr.readAsDataURL(file);
  });
}
async function addPhotos(fileList){
  const files = Array.from(fileList || []).filter(f => f.type && f.type.indexOf('image/') === 0);
  if (!files.length) return;
  const room = MAX_PHOTOS - photos.length;
  if (room <= 0){ toast('The book holds ' + MAX_PHOTOS + ' photos. Remove one to add another.'); return; }
  let added = 0;
  for (const f of files.slice(0, room)){
    try { photos.push({ id:uid(), src: await readPhoto(f), cap:'' }); added++; } catch(e){}
  }
  if (files.length > room) toast('Added ' + added + '. The book holds ' + MAX_PHOTOS + ' photos.');
  else if (added) toast(added === 1 ? 'Photo added.' : added + ' photos added.');
  else toast("Couldn't read that file. Try a JPG or PNG.");
  if (added){ savePhotos(); afterPhotosChanged(); }
}
function afterPhotosChanged(){
  updateLoginTools();
  $$('.ph', field).forEach(el => reslot(el, true));
  if (built) rebuildBook();
}
$('#btnLoginPhotos').addEventListener('click', () => $('#fileLogin').click());
$('#fileLogin').addEventListener('change', e => { addPhotos(e.target.files); e.target.value = ''; });
$('#fileBook').addEventListener('change', e => { addPhotos(e.target.files); e.target.value = ''; });
$('#btnClearPhotos').addEventListener('click', e => armed(e.currentTarget, () => { photos = []; savePhotos(); afterPhotosChanged(); toast('Photos cleared.'); }, 'Really clear?'));

/* ================= login flow ================= */
const wrap = $('#orbWrap');
let busy = false;
function setOrbMsg(t, err){ const m = $('#orbMsg'); m.textContent = t || ''; m.classList.toggle('err', !!err); }
function resetOrbHint(){ setOrbMsg(db.secretChanged ? '' : 'First time? The secret word is "forever". You can change it in Settings.', false); }
function shake(){ wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake'); }

async function attemptLogin(){
  if (busy) return;
  const name = $('#inName').value.trim(), pass = $('#inPass').value.trim();
  if (!name || !pass){ setOrbMsg('Enter your name and the secret word.', true); shake(); return; }
  if (pass.toLowerCase() !== String(db.secret).toLowerCase()){ setOrbMsg("That's not our secret word. Try again.", true); shake(); $('#inPass').select(); return; }
  busy = true; db.me = name; saveData();
  $('#inName').disabled = true; $('#inPass').disabled = true; $('#btnEnter').disabled = true;
  await runLoader();
  enterApp();
}
function runLoader(){
  return new Promise(res => {
    wrap.classList.add('loading'); $('#orbLogin').classList.add('gone'); $('#orbLoading').classList.add('on');
    const total = reduceMotion ? 900 : 3800;
    const msgs = ['Gathering our memories\u2026', 'Dusting off the pages\u2026', 'Opening our story\u2026'];
    const prog = $('#ringProg'), dot = $('#ringDot'), pct = $('#loadPct'), lm = $('#loadMsg');
    const CIRC = 301.6;
    const size = wrap.offsetWidth, r = size * 1.14 * .48;
    const t0 = performance.now();
    function frame(now){
      const t = clamp((now - t0) / total, 0, 1);
      const p = -(Math.cos(Math.PI * t) - 1) / 2;
      prog.style.strokeDashoffset = String(CIRC * (1 - p));
      const ang = -Math.PI / 2 + p * Math.PI * 2;
      dot.style.transform = 'translate(' + (Math.cos(ang) * r) + 'px,' + (Math.sin(ang) * r) + 'px)';
      pct.textContent = Math.round(p * 100) + '%';
      lm.textContent = msgs[Math.min(msgs.length - 1, Math.floor(p * msgs.length))];
      if (t < 1) requestAnimationFrame(frame);
      else { wrap.classList.add('burst'); setTimeout(res, reduceMotion ? 50 : 650); }
    }
    requestAnimationFrame(frame);
  });
}
$('#btnEnter').addEventListener('click', attemptLogin);
['inName', 'inPass'].forEach(id => $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); attemptLogin(); } }));

function resetLogin(){
  busy = false;
  wrap.classList.remove('loading', 'burst', 'shake');
  $('#orbLogin').classList.remove('gone'); $('#orbLoading').classList.remove('on');
  $('#ringProg').style.strokeDashoffset = '301.6';
  $('#inName').disabled = false; $('#inPass').disabled = false; $('#btnEnter').disabled = false;
  $('#inPass').value = ''; $('#inName').value = db.me || '';
  resetOrbHint();
}

/* ---------- interactions ---------- */
bookEl.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (nav){ userTouched = true; goTo(book.c + parseInt(nav.dataset.nav, 10)); return; }
  const t = e.target.closest('[data-act]'); if (t) onAction(t);
});
tabsEl.addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) goSection(t.dataset.tab); });
$('#prev').addEventListener('click', () => { userTouched = true; goTo(book.c - 1); });
$('#next').addEventListener('click', () => { userTouched = true; goTo(book.c + 1); });
document.addEventListener('keydown', e => {
  if (!built || $('#app').classList.contains('off') || !$('#modal').hidden) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''))) return;
  if (e.key === 'ArrowRight'){ userTouched = true; goTo(book.c + 1); }
  if (e.key === 'ArrowLeft'){ userTouched = true; goTo(book.c - 1); }
});
/*
  Drag a page sideways to turn it. This used to be touch only; mouse drags now
  count too, which is why body carries user-select:none (otherwise dragging
  across a story selects the paragraph instead of turning the leaf).

  A drag that STARTS on something interactive is ignored, so pulling away from a
  button cannot also flip the page out from under it.
*/
const NO_DRAG = 'button,a,input,textarea,select,[data-act],[data-nav],[data-tab],.scroll';
let sx = 0, sy = 0, sTarget = null;
$('#stage').addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; sTarget = e.target; });
$('#stage').addEventListener('pointerup', e => {
  const t = sTarget; sTarget = null;
  if (!t || (t.closest && t.closest(NO_DRAG))) return;
  const dx = e.clientX - sx, dy = e.clientY - sy;
  const far = e.pointerType === 'mouse' ? 90 : 70;
  if (Math.abs(dx) > far && Math.abs(dy) < 60){ userTouched = true; goTo(book.c + (dx < 0 ? 1 : -1)); }
});

/*
  Wheel over the book turns pages, but only when the thing under the pointer is
  not itself scrollable. A long story body keeps its own scrolling until it hits
  an end, and only then does the wheel pass through to the page turn.
*/
let wheelLock = false;
$('#stage').addEventListener('wheel', e => {
  if (!built || !$('#modal').hidden) return;
  const sc = e.target.closest && e.target.closest('.scroll,.wy-body,.qz-area,.notes');
  if (sc && sc.scrollHeight > sc.clientHeight + 1){
    const up = e.deltaY < 0, atTop = sc.scrollTop <= 0;
    const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
    if (!(up && atTop) && !(!up && atBottom)) return;
  }
  e.preventDefault();
  if (wheelLock) return;
  const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
  if (Math.abs(d) < 6) return;
  wheelLock = true;
  userTouched = true;
  goTo(book.c + (d > 0 ? 1 : -1));
  setTimeout(() => { wheelLock = false; }, 440);
}, { passive:false });

function onAction(t){
  const a = t.dataset.act, id = t.dataset.id, side = t.dataset.side;
  switch (a){
    case 'open': userTouched = true; goTo(1); break;
    case 'restart': userTouched = true; goTo(0); break;
    case 'sec': goSection(t.dataset.sec); break;
    case 'settings': openSettings(); break;
    case 'new-story': openStoryModal(side || mySide() || 'her'); break;
    case 'edit-story': openStoryModal(null, db.stories.find(s => s.id === id)); break;
    case 'del-story': armed(t, () => { db.stories = db.stories.filter(s => s.id !== id); commit('Story removed.'); }); break;
    case 'new-note': openNoteModal(side || mySide() || 'her'); break;
    case 'del-note': armed(t, () => { db.notes = db.notes.filter(n => n.id !== id); commit('Note removed.'); }, '?'); break;
    case 'add-photos': $('#fileBook').click(); break;
    case 'photo': openPhotoModal(id); break;
    case 'new-q': openQuestionModal(side || mySide() || 'her'); break;
    case 'del-q': armed(t, () => { db.quiz = db.quiz.filter(q => q.id !== id); commit('Question removed.'); }, '?'); break;
    case 'new-movie': openMovieModal(); break;
    case 'move-movie': {
      const movieIndex = db.watchlist.findIndex(m => m.id === id);
      if (movieIndex > -1){
        const movie = db.watchlist.splice(movieIndex, 1)[0];
        db.watched.push(movie);
        commit('Marked as watched \uD83C\uDF7F');
      }
      break;
    }
    case 'del-movie':
      armed(t, () => {
        const listName = t.dataset.list === 'watched' ? 'watched' : 'watchlist';
        db[listName] = db[listName].filter(m => m.id !== id);
        commit('Movie removed.');
      });
      break;
    case 'new-date': openDateModal(); break;
    case 'del-date':
      armed(t, () => { db.dates = db.dates.filter(d => d.id !== id); commit('Date removed.'); });
      break;
  }
}
function commit(msg){ saveData(); rebuildBook(); if (activeGame && activeGame.g.pages) renderGame(); if (msg) toast(msg); }

/* ---------- modals ---------- */
function sideToggle(cur){
  return '<div class="m-seg" role="group" aria-label="Whose side">' +
    ['her', 'his'].map(s => '<button type="button" class="' + s + '" data-side-pick="' + s + '" aria-pressed="' + (cur === s) + '">' + esc(poss(s)) + ' side</button>').join('') + '</div>';
}
function wireSideToggle(root, getSet){
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-side-pick]'); if (!b) return;
    getSet(b.dataset.sidePick);
    $$('[data-side-pick]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
}

function openStoryModal(side, story){
  let cur = story ? story.side : side;
  openModal(story ? 'Edit story' : 'Write a story',
    sideToggle(cur) +
    '<label class="m-field">Title<input id="fTitle" type="text" maxlength="80" placeholder="The night we..." value="' + esc(story ? story.title : '') + '"></label>' +
    '<label class="m-field">Date<input id="fDate" type="date" value="' + esc(story ? story.date : todayISO()) + '"></label>' +
    '<label class="m-field">Your story<textarea id="fBody" maxlength="6000" placeholder="Start anywhere. Nobody is reading over your shoulder.">' + esc(story ? story.body : '') + '</textarea></label>' +
    '<div class="m-actions"><button class="m-btn" type="button" data-close>Cancel</button><button class="m-btn solid" type="button" id="fSave">Save story</button></div>',
    root => {
      wireSideToggle(root, v => cur = v);
      $('#fSave', root).addEventListener('click', () => {
        const title = $('#fTitle', root).value.trim(), body = $('#fBody', root).value.trim(), date = $('#fDate', root).value || todayISO();
        if (!body){ toast('Write a few words first.'); $('#fBody', root).focus(); return; }
        let target;
        if (story){ Object.assign(story, { side:cur, title:title || 'Untitled', body, date }); target = story; }
        else { target = { id:uid(), side:cur, title:title || 'Untitled', body, date }; db.stories.push(target); }
        closeModal(); saveData(); rebuildBook();
        const list = (cur === 'her' ? book.built.herList : book.built.hisList), idx = Math.max(0, list.findIndex(s => s.id === target.id));
        const sideIdx = book.sec.stories + idx * 2 + (cur === 'his' ? 1 : 0);
        userTouched = true; goTo(cFromSide(sideIdx)); toast('Story saved.');
      });
    });
}
function openNoteModal(side){
  let cur = side;
  openModal('Write a love note',
    sideToggle(cur).replace(/ side</g, '<') +
    '<p class="m-hint">Pick who it is from. Keep it short and sweet.</p>' +
    '<label class="m-field">Your note<textarea id="fNote" maxlength="280" style="min-height:100px" placeholder="I was thinking about you when..."></textarea></label>' +
    '<div class="m-actions"><button class="m-btn" type="button" data-close>Cancel</button><button class="m-btn solid" type="button" id="fSend">Leave note</button></div>',
    root => {
      wireSideToggle(root, v => cur = v);
      $('#fSend', root).addEventListener('click', () => {
        const text = $('#fNote', root).value.trim(); if (!text){ toast('Write a few words first.'); return; }
        db.notes.push({ id:uid(), side:cur, text, date:todayISO() });
        closeModal(); commit('Note left.');
      });
    });
}
function openMovieModal(){
  openModal('Add a movie',
    '<p class="m-hint">Add a movie to your shared watchlist.</p>' +
    '<label class="m-field">Movie Title<input id="fMovTitle" type="text" maxlength="80" placeholder="e.g. The Princess Bride"></label>' +
    '<label class="m-field">Poster Image (Optional)<input id="fMovThumb" type="file" accept="image/*"></label>' +
    '<label class="m-field">Streaming Link (Optional)<input id="fMovLink" type="text" placeholder="Paste a link here (e.g., Netflix)"></label>' +
    '<div class="m-actions"><button class="m-btn" type="button" data-close>Cancel</button><button class="m-btn solid" type="button" id="fSaveMovie">Save movie</button></div>',
    root => {
      $('#fSaveMovie', root).addEventListener('click', async () => {
        const title = $('#fMovTitle', root).value.trim();
        const link = safeUrl($('#fMovLink', root).value);
        const fileInput = $('#fMovThumb', root);
        let thumbData = '';

        if (!title){ toast('Please enter a movie title.'); return; }

        if (fileInput.files && fileInput.files.length > 0) {
          try { thumbData = await readPhoto(fileInput.files[0], 320); }
          catch (e) { toast("Couldn't read that image file."); return; }
        }

        db.watchlist.push({ id:uid(), title:title, thumb:thumbData, link:link });
        closeModal(); commit('Movie added!');
      });
    });
}
function openQuestionModal(side){
  let cur = side;
  const opts = [0, 1, 2].map(i => '<div class="opt-row"><input type="radio" name="fCorrect" value="' + i + '" id="r' + i + '" aria-label="Mark answer ' + (i + 1) + ' as correct"' + (i === 0 ? ' checked' : '') + '><input type="text" class="fOpt" maxlength="60" placeholder="Answer ' + (i + 1) + '" aria-label="Answer ' + (i + 1) + '"></div>').join('');
  openModal('Add a quiz question',
    sideToggle(cur).replace(/ side</g, '<') +
    '<p class="m-hint">Write a question about the person you picked. Select the circle next to the true answer.</p>' +
    '<label class="m-field">Question<input id="fQ" type="text" maxlength="120" placeholder="What is my comfort food?"></label>' +
    '<div class="m-field" style="margin-bottom:6px">Answers</div>' + opts +
    '<div class="m-actions" style="margin-top:14px"><button class="m-btn" type="button" data-close>Cancel</button><button class="m-btn solid" type="button" id="fAdd">Add question</button></div>',
    root => {
      wireSideToggle(root, v => cur = v);
      $('#fAdd', root).addEventListener('click', () => {
        const q = $('#fQ', root).value.trim(), o = $$('.fOpt', root).map(i => i.value.trim());
        const correct = +($('input[name="fCorrect"]:checked', root) || { value:0 }).value;
        if (!q){ toast('Write the question first.'); return; }
        if (o.some(x => !x)){ toast('Fill in all three answers.'); return; }
        db.quiz.push({ id:uid(), side:cur, q, opts:o, correct });
        closeModal(); commit('Question added.');
      });
    });
}
function openPhotoModal(id){
  const p = photos.find(x => x.id === id); if (!p) return;
  openModal('Memory',
    '<img class="lb-img" alt="' + esc(p.cap || 'Our photo') + '" src="' + p.src + '">' +
    '<label class="m-field">Caption<input id="fCap" type="text" maxlength="60" placeholder="Where were we?" value="' + esc(p.cap) + '"></label>' +
    '<div class="m-actions"><button class="m-btn" type="button" id="fDel">Delete</button><button class="m-btn" type="button" data-close>Close</button><button class="m-btn solid" type="button" id="fSaveCap">Save caption</button></div>',
    root => {
      $('#fSaveCap', root).addEventListener('click', () => { p.cap = $('#fCap', root).value.trim(); closeModal(); savePhotos(); rebuildBook(); toast('Caption saved.'); });
      $('#fDel', root).addEventListener('click', e => armed(e.currentTarget, () => { photos = photos.filter(x => x.id !== id); closeModal(); savePhotos(); afterPhotosChanged(); toast('Photo removed.'); }, 'Really delete?'));
    });
}
function openSettings(){
  openModal('Settings',
    '<label class="m-field">Her name<input id="sHer" type="text" maxlength="24" value="' + esc(db.names.her) + '"></label>' +
    '<label class="m-field">His name<input id="sHis" type="text" maxlength="24" value="' + esc(db.names.his) + '"></label>' +
    '<label class="m-field">The day you got together<input id="sSince" type="date" value="' + esc(db.since) + '"></label>' +
    '<label class="m-field">Secret word<input id="sSecret" type="text" maxlength="40" value="' + esc(db.secret) + '"></label>' +
    '<p class="m-hint">The secret word only keeps the login screen cozy. It is not real security, so keep private things off this page.</p>' +
    '<div class="m-field" style="margin-bottom:6px">Palette</div>' +
    '<div class="m-seg" role="group" aria-label="Palette">' +
      ['', 'light', 'dark'].map(v =>
        '<button type="button" data-theme-pick="' + v + '" aria-pressed="' + (db.theme === v) + '">' +
        (v === '' ? 'Device' : v === 'light' ? 'Daylight' : 'Lamplight') + '</button>').join('') +
    '</div>' +
    '<label class="m-check"><input id="sHam" type="checkbox"' + (db.hamilton ? ' checked' : '') + '><span>Hamilton</span></label>' +
    '<p class="m-hint">Puts a certain seven-time world champion on the bottom of the screen, driving back and forth. Entirely unnecessary.</p>' +
    '<div class="m-actions"><button class="m-btn" type="button" data-close>Cancel</button><button class="m-btn solid" type="button" id="sSave">Save settings</button></div>',
    root => {
      let pickedTheme = db.theme;
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-theme-pick]'); if (!b) return;
        pickedTheme = b.dataset.themePick;
        $$('[data-theme-pick]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        /* preview only: db is not touched until Save, and closeModal re-applies
           the stored value, so cancelling puts the old palette back */
        if (pickedTheme) document.documentElement.setAttribute('data-theme', pickedTheme);
        else document.documentElement.removeAttribute('data-theme');
      });
      $('#sSave', root).addEventListener('click', () => {
        db.theme = pickedTheme;
        db.hamilton = $('#sHam', root).checked;
        db.names.her = $('#sHer', root).value.trim() || 'Her';
        db.names.his = $('#sHis', root).value.trim() || 'Him';
        db.since = $('#sSince', root).value || '';
        const sec = $('#sSecret', root).value.trim();
        if (sec && sec.toLowerCase() !== String(db.secret).toLowerCase()){ db.secret = sec; db.secretChanged = true; }
        else if (sec) db.secret = sec;
        closeModal(); applyTheme();
        if (typeof window.refreshHamilton === 'function') refreshHamilton();
        commit('Settings saved.'); resetOrbHint();
      });
    });
}

/* ================= enter / leave ================= */
function enterApp(){
  const single = computeLayout(); book.single = single; book.c = 0; built = true; userTouched = false;
  buildBook();
  $('#login').classList.add('off'); $('#app').classList.remove('off');
  const me = db.me ? ', ' + db.me : '';
  if (!db.tipShown){ db.tipShown = true; saveData(); setTimeout(() => toast('Tap Settings to add your names and the day you got together.'), 2600); }
  else setTimeout(() => toast('Welcome back' + me + '.'), 900);
  setTimeout(() => { if (!userTouched && book.c === 0) goTo(1); }, reduceMotion ? 300 : 1900);
}
$('#btnSideGames').addEventListener('click', () => {
  $('#app').classList.add('off');
  $('#gamesScreen').classList.remove('off');
});
$('#btnSideMusic').addEventListener('click', () => {
  $('#musicPlayer').classList.remove('off');
});
$('#btnSettings').addEventListener('click', openSettings);
$('#btnBackToBook').addEventListener('click', () => {
  closeGame();
  $('#gamesScreen').classList.add('off');
  $('#app').classList.remove('off');
});
$('#closeMusic').addEventListener('click', () => {
  $('#musicPlayer').classList.add('off');
  $('#musicPlayer').classList.remove('minimized');
});
$('#btnLogout').addEventListener('click', () => {
  $('#app').classList.add('off'); $('#login').classList.remove('off');
  resetLogin(); setTimeout(() => $('#inPass').focus(), 900);
});
$('#minMusic').addEventListener('click', () => {
  $('#musicPlayer').classList.toggle('minimized');
});

let rz;
window.addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => {
    if (!built) return;
    const was = book.single, now = computeLayout();
    if (now !== was){
      book.c = now ? (book.c === 0 ? 0 : 2 * book.c - 1) : Math.ceil(book.c / 2);
      book.single = now; buildBook();
    } else updateChrome();
  }, 140);
});

/* ================= init ================= */
seed();
applyTheme();
buildPhotoField();
updateLoginTools();
resetOrbHint();
$('#inName').value = db.me || '';
/* the intro overlay owns the screen first, so wait for it before taking focus */
function focusName(){ try { $('#inName').focus({ preventScroll:true }); } catch(e){} }
if (window.INTRO_ACTIVE) window.addEventListener('intro:done', () => setTimeout(focusName, 500), { once:true });
else setTimeout(focusName, 400);
