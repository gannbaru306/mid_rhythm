// ノート配列から譜面を生成する。現状はNormalのみ（単押し＋ロング）
const CFG = { normal: { gap: 0.2, longMin: 0.5 } };

export function generate(notes, lanes = 4, diff = 'normal') {
  const c = CFG[diff];
  const pool = notes.filter(n => n.ch !== 9); // ドラムを除外

  // メロディ候補: 単音率・音域・ノート数でトラック/チャンネルを採点
  const groups = {};
  for (const n of pool) (groups[n.trk + '-' + n.ch] ??= []).push(n);
  let best = null, bs = -1;
  for (const a of Object.values(groups)) {
    if (a.length < 8) continue;
    const mean = a.reduce((s, n) => s + n.pitch, 0) / a.length;
    let mono = 0;
    for (let i = 1; i < a.length; i++) if (a[i].t >= a[i - 1].end - 0.02) mono++;
    const s = a.length * (mono / a.length) * (0.5 + mean / 127);
    if (s > bs) { bs = s; best = a; }
  }

  // 間引き（最小間隔）
  const out = [];
  let last = -9;
  for (const n of best || pool) {
    if (n.t - last < c.gap) continue;
    out.push(n); last = n.t;
  }
  if (!out.length) return [];

  // 音高の分位数でレーンへ割り当て
  const ps = out.map(n => n.pitch).sort((a, b) => a - b);
  const laneOf = p => Math.min(lanes - 1, Math.floor(ps.findIndex(x => x >= p) / ps.length * lanes));
  let prev = -1, dir = 1;
  const chart = out.map((n, i) => {
    let l = laneOf(n.pitch);
    if (l === prev && i && n.t - out[i - 1].t < 0.3) { // 同レーン連打を少し散らす
      l += (l + dir < 0 || l + dir >= lanes) ? -dir : dir;
      dir = -dir;
    }
    prev = l;
    return { t: n.t, end: n.end, lane: l, long: n.end - n.t >= c.longMin, state: 0 };
  });

  // ロングの終端を同レーンの次ノートの手前で切る
  chart.forEach((n, i) => {
    if (!n.long) { n.end = n.t; return; }
    const nx = chart.slice(i + 1).find(m => m.lane === n.lane);
    if (nx) n.end = Math.min(n.end, nx.t - 0.12);
    if (n.end - n.t < 0.3) { n.long = false; n.end = n.t; }
  });
  return chart;
}
