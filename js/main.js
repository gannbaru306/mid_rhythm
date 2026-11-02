import { parseMidi } from './midi-parser.js';
import { generate } from './chart.js';
import * as audio from './audio.js';

const $ = id => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
const SF_URL = 'soundfonts/GeneralUser-GS.sf2';
const WIN = [0.045, 0.09, 0.13]; // PERFECT / GREAT / GOOD (秒)
const PTS = { PERFECT: 1000, GREAT: 700, GOOD: 400, BAD: 0, MISS: 0 };
const COL = { PERFECT: '#7be0d0', GREAT: '#a9c7ff', GOOD: '#d9d9e8', BAD: '#9a9ab0', MISS: '#ff7a7a' };

let sfBuf = null, midiBuf = null;
let chart = [], lanes = 4, idx = 0, running = false, started = false, leadEnd = 0;
let score = 0, combo = 0, maxCombo = 0, fb = { txt: '', t: 0, c: '' };
let cnt, holds = new Map(), lit = [], speed = 1.5, offset = 0;

const load = k => { try { return localStorage.getItem(k); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 無視 */ } };
$('lanes').value = load('lanes') || 4;
$('speed').value = load('speed') || 1.5;
$('offset').value = load('offset') || 0;
const showVals = () => { $('speedV').textContent = (+$('speed').value).toFixed(1); $('offsetV').textContent = $('offset').value + 'ms'; };
showVals();
['speed', 'offset'].forEach(i => $(i).addEventListener('input', showVals));

// 音源の先読み
const status = $('status');
function ready() { $('start').disabled = !(sfBuf && midiBuf); }
fetch(SF_URL).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
  .then(b => { sfBuf = b; status.textContent = '音源の準備ができました'; ready(); })
  .catch(() => { status.textContent = '音源を取得できません。SoundFont（.sf2/.sf3）を選択してください'; $('sfRow').hidden = false; });
$('sf').onchange = async e => { sfBuf = await e.target.files[0].arrayBuffer(); status.textContent = '音源を読み込みました'; ready(); };
$('midi').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  midiBuf = await f.arrayBuffer(); $('fname').textContent = f.name; ready();
};

$('start').onclick = async () => {
  $('start').disabled = true; status.textContent = '音源を展開中…';
  try {
    const initP = audio.init(sfBuf); // タップ内で呼び出す
    lanes = +$('lanes').value; speed = +$('speed').value; offset = +$('offset').value;
    save('lanes', lanes); save('speed', speed); save('offset', offset);
    chart = generate(parseMidi(midiBuf), lanes);
    if (chart.length < 4) throw new Error('譜面にできるノートが見つかりません');
    await initP;
    audio.load(midiBuf);
  } catch (err) { status.textContent = 'エラー: ' + err.message; $('start').disabled = false; return; }
  status.textContent = '';
  $('menu').hidden = true; $('result').hidden = true;
  idx = 0; score = combo = maxCombo = 0; cnt = { PERFECT: 0, GREAT: 0, GOOD: 0, BAD: 0, MISS: 0 };
  holds.clear(); started = false; running = true; leadEnd = performance.now() + 2000;
  resize(); requestAnimationFrame(loop);
};

const now = () => (started ? audio.time() : -(leadEnd - performance.now()) / 1000) + offset / 1000;

function judge(k) {
  cnt[k]++; score += PTS[k];
  if (k === 'BAD' || k === 'MISS') combo = 0; else maxCombo = Math.max(maxCombo, ++combo);
  fb = { txt: k, t: performance.now(), c: COL[k] };
}

cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (!running) return;
  const l = Math.min(lanes - 1, Math.floor(e.clientX / innerWidth * lanes)), t = now();
  lit[l] = performance.now();
  let best = null;
  for (let i = idx; i < chart.length; i++) {
    const n = chart[i];
    if (n.t - t > 0.2) break;
    if (n.state === 0 && n.lane === l && Math.abs(n.t - t) <= 0.15 && (!best || Math.abs(n.t - t) < Math.abs(best.t - t))) best = n;
  }
  if (!best) return;
  const d = Math.abs(best.t - t);
  judge(d <= WIN[0] ? 'PERFECT' : d <= WIN[1] ? 'GREAT' : d <= WIN[2] ? 'GOOD' : 'BAD');
  best.state = best.long ? 2 : 1;
  if (best.long) holds.set(e.pointerId, best);
});
const release = e => {
  const n = holds.get(e.pointerId);
  if (!n) return;
  holds.delete(e.pointerId); n.state = 3;
  judge(now() >= n.end - 0.15 ? 'PERFECT' : 'MISS');
};
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);

function resize() {
  const r = devicePixelRatio || 1;
  cv.width = innerWidth * r; cv.height = innerHeight * r;
  g.setTransform(r, 0, 0, r, 0, 0);
}
addEventListener('resize', resize);

function loop() {
  if (!running) return;
  if (!started && performance.now() >= leadEnd) { started = true; audio.play(); }
  const t = now();
  while (idx < chart.length) {
    const n = chart[idx];
    if (n.state !== 0) { idx++; continue; }
    if (n.t < t - 0.15) { n.state = -1; judge('MISS'); idx++; continue; }
    break;
  }
  for (const [id, n] of holds) if (t > n.end) { n.state = 3; holds.delete(id); judge('PERFECT'); }
  draw(t);
  const last = chart[chart.length - 1];
  if (t > last.end + 1.5 || (started && audio.done() && t > last.end)) return finish();
  requestAnimationFrame(loop);
}

function draw(t) {
  const w = innerWidth, h = innerHeight, lw = w / lanes, hy = h * 0.82, pps = h * 0.45 * speed, ms = performance.now();
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < lanes; i++) {
    const a = Math.max(0, 1 - (ms - (lit[i] || -1e9)) / 180);
    if (a > 0) { g.fillStyle = `rgba(123,224,208,${a * 0.22})`; g.fillRect(i * lw, 0, lw, h); }
  }
  g.strokeStyle = '#2a2f4a'; g.lineWidth = 1;
  for (let i = 0; i <= lanes; i++) { g.beginPath(); g.moveTo(i * lw, 0); g.lineTo(i * lw, h); g.stroke(); }
  g.strokeStyle = '#e8ecff'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, hy); g.lineTo(w, hy); g.stroke();
  for (let i = chart.length - 1; i >= 0; i--) {
    const n = chart[i];
    if (n.state === 1 || n.state === 3) continue;
    const y = hy - (n.t - t) * pps;
    if (y < -60) continue;
    if (y > h + 60 && n.state !== 2) break;
    const yh = n.state === 2 ? hy : y, yt = hy - (n.end - t) * pps, x = n.lane * lw + 4, ww = lw - 8;
    g.globalAlpha = n.state < 0 ? 0.25 : 1;
    if (n.long) { g.fillStyle = 'rgba(240,180,90,.35)'; g.fillRect(x + ww * 0.2, yt, ww * 0.6, yh - yt); }
    g.fillStyle = n.long ? '#f0b45a' : '#7be0d0'; g.fillRect(x, yh - 9, ww, 18);
    g.globalAlpha = 1;
  }
  g.fillStyle = '#e8ecff'; g.textAlign = 'left'; g.font = '600 18px sans-serif';
  g.fillText(String(score).padStart(7, '0'), 14, 30);
  if (combo > 1) { g.textAlign = 'center'; g.font = '700 40px sans-serif'; g.fillText(combo, w / 2, h * 0.35); }
  const fa = 1 - (ms - fb.t) / 500;
  if (fa > 0) { g.globalAlpha = fa; g.fillStyle = fb.c; g.textAlign = 'center'; g.font = '700 22px sans-serif'; g.fillText(fb.txt, w / 2, h * 0.42); g.globalAlpha = 1; }
  if (!started) { g.fillStyle = '#e8ecff'; g.textAlign = 'center'; g.font = '600 20px sans-serif'; g.fillText('Ready', w / 2, h * 0.5); }
}

function finish() {
  running = false; audio.stop();
  $('rScore').textContent = score;
  $('rDetail').textContent = `MAX COMBO ${maxCombo}  /  PERFECT ${cnt.PERFECT}  GREAT ${cnt.GREAT}  GOOD ${cnt.GOOD}  BAD ${cnt.BAD}  MISS ${cnt.MISS}`;
  $('result').hidden = false;
}
$('again').onclick = () => { $('result').hidden = true; $('menu').hidden = false; $('start').disabled = false; g.clearRect(0, 0, innerWidth, innerHeight); };
