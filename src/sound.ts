// All sound is synthesized with Web Audio, so there are no audio files.

import type { SoundProfile } from './themes';

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

/** Call from a user gesture so browsers allow audio. */
export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
  }
  if (ctx?.state === 'suspended') void ctx.resume();
}

function tone(p: SoundProfile, freq: number, start: number, length: number, gain: number) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, t + length);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = p.wave === 'sawtooth' || p.wave === 'square' ? 2200 : 8000;
  out.connect(filter).connect(ctx.destination);

  const partials = p.bell ? [[1, 1], [2.01, 0.4], [3.02, 0.2]] : [[1, 1]];
  for (const [ratio, level] of partials) {
    const osc = ctx.createOscillator();
    osc.type = p.wave;
    osc.frequency.value = freq * ratio;
    if (p.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 6;
      depth.gain.value = freq * 0.02;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + length);
    }
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }
}

function boom(start: number, gain: number) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const length = 0.5;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t);
}

const note = (p: SoundProfile, step: number) => {
  const octave = Math.floor(step / p.scale.length);
  const semis = p.scale[step % p.scale.length] + 12 * octave;
  return p.root * 2 ** (semis / 12);
};

export function playPickUp(p: SoundProfile) {
  if (muted || !ctx) return;
  tone(p, note(p, 4), 0, 0.08, 0.05);
}

export function playPlace(p: SoundProfile) {
  if (muted || !ctx) return;
  tone(p, note(p, 0) / 2, 0, 0.12, 0.12);
}

export function playClear(p: SoundProfile, lines: number, combo: number) {
  if (muted || !ctx) return;
  const first = Math.min(combo - 1, 6);
  const count = Math.min(lines + 2, 6);
  for (let i = 0; i < count; i++) tone(p, note(p, first + i), i * 0.07, p.decay, 0.14);
  if (p.boom) for (let i = 0; i < Math.min(lines, 3); i++) boom(0.1 + i * 0.18, 0.5);
}

export function playGameOver(p: SoundProfile) {
  if (muted || !ctx) return;
  [4, 2, 0].forEach((step, i) => tone(p, note(p, step) / 2, i * 0.22, p.decay + 0.3, 0.14));
}

export function playClick(p: SoundProfile) {
  if (muted || !ctx) return;
  tone(p, note(p, 7), 0, 0.06, 0.05);
}
