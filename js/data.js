'use strict';

/* ================= storage ================= */
const K_DATA = 'twosides:data:v1', K_PHOTOS = 'twosides:photos:v1';
function readKey(k){ try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch(e){ return null; } }
function writeKey(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }

let db = Object.assign({
  names:{ her:'Her', his:'Him' }, since:'', secret:'forever', secretChanged:false, me:'',
  stories:[], notes:[], quiz:[], memBest:null, seeded:false, tipShown:false,
  watchlist:[], watched:[], dates:[], best:{}
}, readKey(K_DATA) || {});
/* older saved data may be missing the newer lists, so make sure they all exist */
['stories', 'notes', 'quiz', 'watchlist', 'watched', 'dates'].forEach(k => { if (!Array.isArray(db[k])) db[k] = []; });
if (!db.best || typeof db.best !== 'object') db.best = {};
if (!db.names || typeof db.names !== 'object') db.names = { her:'Her', his:'Him' };
let photos = readKey(K_PHOTOS) || [];
const MAX_PHOTOS = 30;

function saveData(){ if (!writeKey(K_DATA, db)) toast("Couldn't save on this device. Changes last until you close the page."); }
function savePhotos(){ if (!writeKey(K_PHOTOS, photos)){ toast("Not enough space to save every photo here. They'll stay until you close the page."); return false; } return true; }

const DEFAULT_NAME = { her:'Her', his:'Him' };
const N = s => (db.names && db.names[s] && db.names[s].trim()) || DEFAULT_NAME[s];
const poss = s => { const n = N(s); return n === 'Her' ? 'Her' : n === 'Him' ? 'His' : n + "'s"; };
function mySide(){
  const me = (db.me || '').trim().toLowerCase();
  if (!me) return null;
  if (me === N('her').toLowerCase()) return 'her';
  if (me === N('his').toLowerCase()) return 'his';
  return null;
}

function seed(){
  if (db.seeded) return;
  const t = todayISO();
  db.stories.push({ id:uid(), side:'her', title:'How I found you', date:t,
    body:"This page is mine, and the one across from it is yours.\n\nTap Edit to swap this note for the real story: the first message, the first laugh, the moment I knew. Add as many chapters as you like. Every story written from my side lands on this page." });
  db.stories.push({ id:uid(), side:'his', title:'Chapter one', date:t,
    body:"And this one is mine.\n\nTap Edit and write it your way: the funny bits, the small moments, the things I never say out loud. When you add more stories, the pages fill up side by side." });
  db.notes.push({ id:uid(), side:'her', text:"I saved you a page. Come find me on the other side.", date:t });
  db.notes.push({ id:uid(), side:'his', text:"Found it. Best book I've ever been in.", date:t });
  db.seeded = true; saveData();
}

