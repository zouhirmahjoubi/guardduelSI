// Procedural Web Audio Synthesizer - 100% offline, zero external files

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSfxEnabled(val: boolean) {
  enabled = val;
}

export function isSfxEnabled() {
  return enabled;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  vol = 0.5,
  sweep?: number,
) {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac || !masterGain) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (sweep !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(sweep, ac.currentTime + duration);
  }
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(vol, ac.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration + 0.05);
}

function noise(duration: number, vol = 0.3) {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac || !masterGain) return;
  const bufferSize = ac.sampleRate * duration;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * vol;
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  src.connect(gain);
  gain.connect(masterGain);
  src.start(ac.currentTime);
}

export const sfx = {
  chirp() {
    tone(880, 0.06, 'square', 0.3, 1320);
  },
  click() {
    tone(600, 0.03, 'square', 0.2);
  },
  tab() {
    tone(440, 0.04, 'sine', 0.25, 660);
  },
  radar() {
    tone(1200, 0.15, 'sine', 0.2, 400);
  },
  sonar() {
    tone(800, 0.3, 'sine', 0.3, 200);
  },
  breach() {
    tone(220, 0.8, 'sawtooth', 0.5, 110);
    setTimeout(() => tone(180, 0.8, 'sawtooth', 0.4, 90), 100);
    noise(0.3, 0.2);
  },
  shield() {
    tone(660, 0.1, 'sine', 0.3, 990);
    setTimeout(() => tone(880, 0.1, 'sine', 0.3, 1320), 60);
  },
  patch() {
    tone(523, 0.1, 'sine', 0.3);
    setTimeout(() => tone(659, 0.1, 'sine', 0.3), 80);
    setTimeout(() => tone(784, 0.15, 'sine', 0.3), 160);
    setTimeout(() => tone(1047, 0.2, 'sine', 0.35), 240);
  },
  alarm() {
    tone(440, 0.2, 'square', 0.3);
    setTimeout(() => tone(440, 0.2, 'square', 0.3), 300);
  },
  whoosh() {
    noise(0.2, 0.15);
  },
  boot() {
    tone(330, 0.08, 'sine', 0.2);
    setTimeout(() => tone(440, 0.08, 'sine', 0.2), 80);
    setTimeout(() => tone(550, 0.08, 'sine', 0.2), 160);
    setTimeout(() => tone(660, 0.12, 'sine', 0.25), 240);
  },
  toggle() {
    tone(500, 0.04, 'triangle', 0.2, 700);
  },
  error() {
    tone(200, 0.15, 'sawtooth', 0.3, 150);
  },
  success() {
    tone(660, 0.1, 'sine', 0.3);
    setTimeout(() => tone(880, 0.15, 'sine', 0.3), 80);
  },
  fanfare() {
    tone(523, 0.12, 'sine', 0.35);
    setTimeout(() => tone(659, 0.12, 'sine', 0.35), 100);
    setTimeout(() => tone(784, 0.12, 'sine', 0.35), 200);
    setTimeout(() => tone(1047, 0.2, 'sine', 0.4), 300);
    setTimeout(() => tone(1319, 0.3, 'sine', 0.45), 450);
  },
  flagCapture() {
    tone(880, 0.08, 'square', 0.3);
    setTimeout(() => tone(1100, 0.08, 'square', 0.3), 60);
    setTimeout(() => tone(1320, 0.15, 'square', 0.35), 120);
  },
};
