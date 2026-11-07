/* Couple's Kitchen — soundtrack player.
   Plays pre-rendered, seamlessly looping tracks from /music/<mood>.mp3 through
   Web Audio (light on the CPU, and the only way to fade volume on iPhone).
   The tracks are composed by tools/music-synth.js; to use your own music,
   replace public/music/chill.mp3, rush.mp3 and sneak.mp3 (any length loops).

     chill — lobby / Recipe Relay   rush — Split Kitchen   sneak — Midnight Snack */
(() => {
  'use strict';

  const MOODS = { chill: 0.55, rush: 0.5, sneak: 0.6 };   // per-track volume
  let ctx = null, master = null;
  let enabled = true, mood = 'chill';
  const buffers = {}, loading = {};
  let current = null;            // { mood, src, gain }

  function load(m) {
    if (buffers[m] || loading[m]) return loading[m] || Promise.resolve(buffers[m]);
    loading[m] = fetch(`music/${m}.mp3`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(data => new Promise((res, rej) => ctx.decodeAudioData(data, res, rej)))   // callback form works on older iPhones
      .then(buf => { buffers[m] = buf; return buf; })
      .catch(() => null)
      .finally(() => { delete loading[m]; });
    return loading[m];
  }

  function fade(gain, to, secs) {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + secs);
  }

  function stopCurrent(secs = 1.2) {
    if (!current) return;
    const c = current; current = null;
    fade(c.gain, 0, secs);
    try { c.src.stop(ctx.currentTime + secs + 0.05); } catch { /* already stopped */ }
  }

  async function play(m) {
    if (!ctx || !enabled) return;
    if (current && current.mood === m) return;
    const buf = await load(m);
    if (!buf || !enabled || mood !== m) return;      // mood changed while loading
    if (current && current.mood === m) return;
    stopCurrent(1.2);
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buf; src.loop = true;
    gain.gain.value = 0;
    src.connect(gain).connect(master);
    src.start();
    fade(gain, MOODS[m] || 0.5, 1.5);
    current = { mood: m, src, gain };
  }

  window.Music = {
    // Call from a tap handler with an unlocked AudioContext.
    attach(audioCtx) {
      if (!ctx) {
        ctx = audioCtx;
        master = ctx.createGain(); master.gain.value = 1;
        master.connect(ctx.destination);
        // warm up the other tracks quietly in the background
        setTimeout(() => Object.keys(MOODS).forEach(load), 1500);
      }
      if (enabled) play(mood);
    },
    setEnabled(on) {
      enabled = !!on;
      if (!ctx) return;
      if (enabled) play(mood); else stopCurrent(0.5);
    },
    get enabled() { return enabled; },
    setMood(m) {
      if (!MOODS[m] || m === mood) return;
      mood = m;
      if (ctx && enabled) play(m);
    },
  };
})();
