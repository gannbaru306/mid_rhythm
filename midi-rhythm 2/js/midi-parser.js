// 標準MIDIファイルを解析し、秒単位のノート配列 {t,end,pitch,vel,ch,trk} を返す
export function parseMidi(buf) {
  const d = new DataView(buf);
  let p = 0;
  const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
  const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
  const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 127); } while (b & 128); return v; };
  if (d.getUint32(0) !== 0x4d546864) throw new Error('MIDIファイルではありません');
  p = 8; u16();
  const n = u16(), div = u16();
  if (div & 0x8000) throw new Error('SMPTE形式のMIDIは未対応です');
  const tempos = [[0, 500000]], raw = [];
  for (let k = 0; k < n; k++) {
    p += 4;
    const len = u32(), end = p + len; // トラック長
    let tick = 0, st = 0;
    while (p < end) {
      tick += vlq();
      let s = d.getUint8(p);
      if (s & 128) { p++; if (s < 0xF0) st = s; } else s = st;
      if (s === 0xFF) {
        const type = d.getUint8(p++), l = vlq();
        if (type === 0x51) tempos.push([tick, (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2)]);
        p += l;
      } else if (s === 0xF0 || s === 0xF7) {
        p += vlq();
      } else {
        const t = s & 0xF0, ch = s & 15, a = d.getUint8(p++);
        const b = (t === 0xC0 || t === 0xD0) ? 0 : d.getUint8(p++);
        if (t === 0x90 && b > 0) raw.push({ tick, k, ch, a, v: b, on: 1 });
        else if (t === 0x80 || t === 0x90) raw.push({ tick, k, ch, a, on: 0 });
      }
    }
    p = end;
  }
  tempos.sort((x, y) => x[0] - y[0]);
  let acc = 0;
  const seg = tempos.map((t, i) => {
    if (i) acc += (t[0] - tempos[i - 1][0]) * tempos[i - 1][1] / div / 1e6;
    return { tick: t[0], sec: acc, us: t[1] };
  });
  const sec = tk => {
    let s = seg[0];
    for (const x of seg) { if (x.tick <= tk) s = x; else break; }
    return s.sec + (tk - s.tick) * s.us / div / 1e6;
  };
  raw.sort((x, y) => x.tick - y.tick || x.on - y.on);
  const open = {}, notes = [];
  for (const e of raw) {
    const key = e.k + '-' + e.ch + '-' + e.a;
    if (e.on) open[key] = { t: sec(e.tick), pitch: e.a, vel: e.v, ch: e.ch, trk: e.k };
    else if (open[key]) { const o = open[key]; o.end = sec(e.tick); notes.push(o); delete open[key]; }
  }
  return notes.sort((a, b) => a.t - b.t);
}
