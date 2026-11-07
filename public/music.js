/* Couple's Kitchen — generative lo-fi background music (Web Audio, no files).
   Three moods that crossfade when the screen changes:
     chill  — lobby / Recipe Relay: slow jazzy 7th chords, soft drums, vinyl crackle
     rush   — Split Kitchen: a bit faster, clearer beat
     sneak  — Midnight Snack: minor chords, very quiet, no drums                    */
(() => {
  'use strict';

  const MOODS = {
    chill: { bpm: 72, gain: 0.32, drums: 0.8, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], bass: [41, 40, 38, 36] },
    rush:  { bpm: 92, gain: 0.30, drums: 1.0, chords: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], bass: [45, 41, 43, 40] },
    sneak: { bpm: 60, gain: 0.20, drums: 0,   chords: [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 56, 59, 62]], bass: [45, 41, 38, 40] },
  };
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  let ctx = null, out = null, filter = null, noise = null, crackle = null;
  let enabled = true, mood = 'chill', running = false;
  let nextBeat = 0, beat = 0, timer = null;

  function setup(audioCtx) {
    if (ctx) return;
    ctx = audioCtx;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1800; filter.Q.value = 0.4;
    out = ctx.createGain(); out.gain.value = 0;
    filter.connect(out).connect(ctx.destination);
    // One second of white noise, reused for hats, snares and crackle.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Vinyl crackle: sparse pops.
    const cb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), cd = cb.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.6 : (Math.random() * 2 - 1) * 0.004;
    crackle = ctx.createBufferSource(); crackle.buffer = cb; crackle.loop = true;
    const cg = ctx.createGain(); cg.gain.value = 0.5;
    crackle.connect(cg).connect(filter); crackle.start();
  }

  function pad(freq, t, dur, vol) {
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq; o.detune.value = detune;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.6);
      g.gain.setValueAtTime(vol, t + dur - 0.8);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(filter); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  function bass(freq, t, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(filter); o.start(t); o.stop(t + dur);
  }
  function kick(t, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(filter); o.start(t); o.stop(t + 0.3);
  }
  function hiss(t, vol, dur, type, freq) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(filter); s.start(t, Math.random() * 0.5); s.stop(t + dur);
  }

  // Schedule a little ahead of time so the beat stays steady.
  function schedule() {
    const m = MOODS[mood];
    const spb = 60 / m.bpm;
    while (nextBeat < ctx.currentTime + 0.4) {
      const t = nextBeat, inBar = beat % 4, bar = Math.floor(beat / 4);
      const chord = bar % 2 === 0 && inBar === 0 ? Math.floor(bar / 2) % m.chords.length : -1;
      if (chord >= 0) {
        for (const n of m.chords[chord]) pad(midi(n), t, spb * 8, 0.035);
        // a soft melody note now and then
        if (Math.random() < 0.6) {
          const top = m.chords[chord][Math.floor(Math.random() * 4)] + 12;
          const mt = t + spb * (2 + Math.floor(Math.random() * 4));
          bass(midi(top), mt, spb * 1.5, 0.03);
        }
      }
      const root = m.bass[Math.floor(bar / 2) % m.bass.length];
      if (inBar === 0 || inBar === 2) bass(midi(root), t, spb * 1.6, 0.11);
      if (m.drums) {
        if (inBar === 0 || (inBar === 2 && Math.random() < 0.7)) kick(t, 0.35 * m.drums);
        if (inBar === 1 || inBar === 3) hiss(t, 0.06 * m.drums, 0.18, 'bandpass', 1800);
        hiss(t, 0.02 * m.drums, 0.05, 'highpass', 7000);
        hiss(t + spb * 0.58, 0.014 * m.drums, 0.04, 'highpass', 7000);   // swung off-beat hat
      }
      nextBeat += spb; beat++;
    }
  }

  function fadeTo(v, secs = 1.2) {
    if (!out) return;
    const now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(v, now + secs);
  }

  function start() {
    if (!ctx || running || !enabled) return;
    running = true;
    nextBeat = ctx.currentTime + 0.1; beat = 0;
    timer = setInterval(schedule, 100);
    fadeTo(MOODS[mood].gain, 2);
  }
  function stop() {
    if (!running) return;
    running = false;
    fadeTo(0, 0.6);
    setTimeout(() => { if (!running) clearInterval(timer); }, 700);
  }

  window.Music = {
    // Call from a tap handler with an unlocked AudioContext.
    attach(audioCtx) { setup(audioCtx); if (enabled) start(); },
    setEnabled(on) { enabled = !!on; if (enabled) start(); else stop(); },
    get enabled() { return enabled; },
    setMood(m) {
      if (!MOODS[m] || m === mood) return;
      mood = m;
      if (!running) return;
      // quick dip, then continue in the new mood
      fadeTo(0.04, 0.5);
      setTimeout(() => { if (running) { beat = 0; fadeTo(MOODS[mood].gain, 1.5); } }, 550);
    },
  };
})();
