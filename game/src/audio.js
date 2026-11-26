// Sound: every sound is synthesized with WebAudio — no audio files, no
// network. Engine hum follows throttle, rings chime, touchdown thuds, and a
// crash is a burst of filtered noise. Silent until the first user gesture.
export function createAudio() {
  return { ctx: null, engine: null, engineGain: null, enabled: false };
}

/** Start the audio context after a user gesture; safe to call repeatedly. */
export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  try {
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctx) return;
    audio.ctx = new Ctx();
    const osc = audio.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 70;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audio.ctx.destination);
    osc.start();
    audio.engine = osc;
    audio.engineGain = gain;
    audio.enabled = true;
  } catch {
    audio.enabled = false;
  }
}

/** Engine hum tracks throttle and airspeed. */
export function updateEngineSound(audio, plane) {
  if (!audio.enabled || !audio.engine) return;
  const target = plane.onGround ? plane.throttle * 0.05 : 0.02 + plane.throttle * 0.06;
  audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
  audio.engine.frequency.setTargetAtTime(55 + plane.throttle * 55 + plane.speed * 0.4, audio.ctx.currentTime, 0.1);
}

/** A short tone: frequency, duration, type, volume. */
export function beep(audio, freq, seconds, type = 'sine', volume = 0.12) {
  if (!audio.enabled || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
  osc.connect(gain);
  gain.connect(audio.ctx.destination);
  osc.start(t);
  osc.stop(t + seconds);
}

export function ringChime(audio) {
  beep(audio, 880, 0.25);
  setTimeout(() => beep(audio, 1318, 0.3), 90);
}

export function thud(audio) {
  beep(audio, 90, 0.25, 'triangle', 0.25);
}

export function crashSound(audio) {
  if (!audio.enabled || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * 0.5, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  src.connect(filter);
  filter.connect(audio.ctx.destination);
  src.start(t);
}
