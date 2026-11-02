import { WorkletSynthesizer, Sequencer } from '../vendor/spessasynth.js';

let ctx, synth, seq;

// ユーザー操作（タップ）の中で最初に呼ぶこと（iOS対策）
export async function init(sfBuf) {
  if (ctx) { await ctx.resume(); return; }
  ctx = new AudioContext();
  await ctx.resume();
  await ctx.audioWorklet.addModule('vendor/spessasynth_processor.min.js');
  synth = new WorkletSynthesizer(ctx);
  await synth.soundBankManager.addSoundBank(sfBuf, 'main');
  await synth.isReady;
}

export function load(midiBuf) {
  seq = new Sequencer(synth);
  seq.skipToFirstNoteOn = false; // 譜面の時刻とずらさない
  seq.loopCount = 0;
  seq.loadNewSongList([{ binary: midiBuf.slice(0) }]);
}

export const play = () => seq.play();
export const stop = () => seq && seq.pause();
export const time = () => seq.currentTime;
export const done = () => seq.isFinished;
