/* Soundtrack composer for Couple's Kitchen.
   Runs in a browser OfflineAudioContext (see tools/render-music.js) and renders
   each mood as a seamless loop. Every note has a soft attack and release, so
   there are no clicks, and the mix goes through a compressor so it never clips.

   chill — lobby & Recipe Relay: mellow electric piano, walking bass, brushed beat (F major, 74 bpm)
   rush  — Split Kitchen: bouncy plucks, busy bass, claps (C major, 104 bpm)
   sneak — Midnight Snack: music box over soft pads and a heartbeat bass (A minor, 62 bpm)       */
(() => {
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // Small seeded random, so every render is identical.
  function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

  const SONGS = {
    chill: {
      bpm: 74, bars: 16, swing: 0.58, seed: 7,
      // Fmaj9 – Em7 – Am7 – Dm9 | Gm9 – C13 – Fmaj7 – Bbmaj7
      chords: [[53, 57, 60, 64, 67], [52, 55, 59, 62], [57, 60, 64, 67], [50, 53, 57, 60, 64], [55, 58, 62, 65, 69], [48, 52, 58, 62, 69], [53, 57, 60, 64], [46, 50, 53, 57]],
      bass: [41, 40, 45, 38, 43, 36, 41, 46],
      scale: [65, 67, 69, 72, 74, 76, 77, 79, 81],
      drums: { kick: [0, 2.5], snare: [1, 3], hat: 'swing8', vol: 0.8 },
      lead: 'epiano', pad: 0.5, melodyDensity: 0.55,
    },
    rush: {
      bpm: 104, bars: 16, swing: 0.5, seed: 11,
      // C – Am – F – G | C – Em – F – G
      chords: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [60, 64, 67, 71], [52, 55, 59, 64], [53, 57, 60, 64], [55, 59, 62, 65]],
      bass: [36, 33, 41, 43, 36, 40, 41, 43],
      scale: [72, 74, 76, 79, 81, 84, 86, 88],
      drums: { kick: [0, 1.5, 2, 3.5], snare: [1, 3], hat: 'straight8', vol: 1 },
      lead: 'pluck', pad: 0.25, melodyDensity: 0.75, bassPattern: 'eighths',
    },
    sneak: {
      bpm: 62, bars: 8, swing: 0.5, seed: 3,
      // Am9 – Fmaj7 – Dm9 – E7sus4
      chords: [[57, 60, 64, 67, 71], [53, 57, 60, 64], [50, 53, 57, 60, 64], [52, 57, 59, 62]],
      bass: [45, 41, 38, 40],
      scale: [81, 83, 84, 86, 88, 91, 93],
      drums: null,
      lead: 'musicbox', pad: 0.9, melodyDensity: 0.4, bassPattern: 'heartbeat',
    },
  };

  // ---- instruments --------------------------------------------------------
  function env(g, t, attack, peak, decayTo, decayTime, end) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(peak * decayTo, t + attack, decayTime / 3);
    g.gain.setTargetAtTime(0, end, 0.04);            // smooth release, no click
  }
  function osc(ctx, out, type, freq, t, dur, vol, { attack = 0.01, decayTo = 0.5, decayTime = 0.6, detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    env(g, t, attack, vol, decayTo, decayTime, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.3);
  }
  const INSTR = {
    epiano(ctx, out, f, t, d, v) {      // Rhodes-ish: sine + soft 2nd harmonic + gentle bell
      osc(ctx, out, 'sine', f, t, d, v, { attack: 0.012, decayTo: 0.35, decayTime: 1.4 });
      osc(ctx, out, 'sine', f * 2, t, d * 0.6, v * 0.15, { attack: 0.012, decayTo: 0.1, decayTime: 0.4 });
      osc(ctx, out, 'sine', f * 4.01, t, 0.25, v * 0.03, { attack: 0.01, decayTo: 0, decayTime: 0.15 });
    },
    pluck(ctx, out, f, t, d, v) {
      osc(ctx, out, 'triangle', f, t, Math.min(d, 0.5), v, { attack: 0.01, decayTo: 0.05, decayTime: 0.35 });
      osc(ctx, out, 'sine', f * 2, t, 0.2, v * 0.2, { attack: 0.008, decayTo: 0, decayTime: 0.12 });
    },
    musicbox(ctx, out, f, t, d, v) {
      osc(ctx, out, 'sine', f, t, 1.6, v, { attack: 0.01, decayTo: 0.02, decayTime: 1.4 });
      osc(ctx, out, 'sine', f * 3, t, 0.5, v * 0.08, { attack: 0.008, decayTo: 0, decayTime: 0.3 });
    },
    pad(ctx, out, f, t, d, v) {
      osc(ctx, out, 'sine', f, t, d, v, { attack: Math.min(0.8, d / 3), decayTo: 0.85, decayTime: d, detune: -5 });
      osc(ctx, out, 'sine', f, t, d, v, { attack: Math.min(0.8, d / 3), decayTo: 0.85, decayTime: d, detune: 5 });
    },
    bass(ctx, out, f, t, d, v) {
      osc(ctx, out, 'sine', f, t, d, v, { attack: 0.012, decayTo: 0.6, decayTime: 0.5 });
      osc(ctx, out, 'triangle', f * 2, t, d * 0.5, v * 0.12, { attack: 0.01, decayTo: 0.2, decayTime: 0.2 });
    },
  };
  function kick(ctx, out, t, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(0, t + 0.02, 0.07);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.5);
  }
  function noiseHit(ctx, out, noise, t, v, type, freq, q, decay) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.setTargetAtTime(0, t + 0.007, decay);
    s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + decay * 8 + 0.05);
  }

  // ---- arrangement --------------------------------------------------------
  async function render(name, sampleRate = 44100) {
    const S = SONGS[name], rand = rng(S.seed);
    const spb = 60 / S.bpm, beats = S.bars * 4, loopLen = beats * spb, tail = 3;
    const ctx = new OfflineAudioContext(2, Math.ceil((loopLen + tail) * sampleRate), sampleRate);

    // Mix bus: gentle low-pass for warmth → compressor → master
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    const master = ctx.createGain(); master.gain.value = 0.9;
    const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 5200; warm.Q.value = 0.3;
    warm.connect(comp).connect(master).connect(ctx.destination);
    // Slight stereo width: two panned sub-buses
    const left = ctx.createStereoPanner(); left.pan.value = -0.25; left.connect(warm);
    const right = ctx.createStereoPanner(); right.pan.value = 0.25; right.connect(warm);
    const mid = ctx.createGain(); mid.connect(warm);
    const drumCut = ctx.createBiquadFilter(); drumCut.type = 'lowpass'; drumCut.frequency.value = 7000; drumCut.Q.value = 0.4; drumCut.connect(warm);

    const noise = ctx.createBuffer(1, sampleRate, sampleRate);
    const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;

    const chordBeats = name === 'sneak' ? 8 : 8;     // two bars per chord
    for (let beat = 0; beat < beats; beat++) {
      const t = beat * spb, bar = Math.floor(beat / 4), inBar = beat % 4;
      const ci = Math.floor(beat / chordBeats) % S.chords.length;
      const chord = S.chords[ci], root = S.bass[ci];

      // pads / comping
      if (beat % chordBeats === 0) for (const n of chord) INSTR.pad(ctx, left, midi(n), t, spb * chordBeats, 0.028 * S.pad);
      if (S.lead === 'epiano' && (inBar === 0 || (inBar === 2 && rand() < 0.6))) {
        const at = t + (inBar === 2 ? spb * 0.5 : 0);
        chord.slice(1).forEach((n, k) => INSTR.epiano(ctx, right, midi(n), at + k * 0.012, spb * 1.6, 0.05));
      }
      if (S.lead === 'pluck' && inBar % 2 === 1) chord.forEach(n => INSTR.pluck(ctx, right, midi(n), t + spb * 0.5, spb * 0.4, 0.035));

      // bass
      if (S.bassPattern === 'eighths') {
        [0, 0.5].forEach(o => INSTR.bass(ctx, mid, midi(o === 0 ? root : root + (inBar % 2 ? 7 : 12)), t + o * spb, spb * 0.45, 0.16));
      } else if (S.bassPattern === 'heartbeat') {
        if (inBar === 0) { INSTR.bass(ctx, mid, midi(root), t, spb * 0.4, 0.13); INSTR.bass(ctx, mid, midi(root), t + spb * 0.45, spb * 0.4, 0.09); }
      } else {
        const walk = [root, root + 7, root + 12, root + (rand() < 0.5 ? 10 : 9)];
        INSTR.bass(ctx, mid, midi(walk[inBar]), t, spb * 0.9, 0.15);
      }

      // drums
      const D = S.drums;
      if (D) {
        for (const k of D.kick) if (Math.floor(k) === inBar) kick(ctx, mid, t + (k - inBar) * spb, 0.5 * D.vol);
        if (D.snare.includes(inBar)) noiseHit(ctx, drumCut, noise, t, 0.09 * D.vol, 'bandpass', name === 'rush' ? 1400 : 1800, 0.9, name === 'rush' ? 0.045 : 0.03);
        const hats = D.hat === 'swing8' ? [0, S.swing] : [0, 0.5];
        hats.forEach((o, k) => noiseHit(ctx, drumCut, noise, t + o * spb, (k ? 0.012 : 0.016) * D.vol, 'bandpass', 5500, 1.2, 0.01));
      }

      // melody: phrases from the scale, resolving to chord tones
      if (rand() < S.melodyDensity) {
        const steps = S.lead === 'musicbox' ? [0, 0.5] : rand() < 0.5 ? [0] : [0, 0.5];
        for (const o of steps) {
          const tones = S.scale.filter(n => chord.some(c => (n - c) % 12 === 0));
          const pool = rand() < 0.6 && tones.length ? tones : S.scale;
          const n = pool[Math.floor(rand() * pool.length)];
          INSTR[S.lead](ctx, S.lead === 'musicbox' ? right : left, midi(n), t + o * spb, spb * (steps.length > 1 ? 0.5 : 0.9), S.lead === 'musicbox' ? 0.06 : 0.07);
        }
      }
    }

    const buf = await ctx.startRendering();
    // Fold the tail back onto the start so the loop is seamless.
    const loopSamples = Math.round(loopLen * sampleRate);
    const out = [];
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch), o = new Float32Array(loopSamples);
      o.set(d.subarray(0, loopSamples));
      for (let i = loopSamples; i < d.length; i++) o[i - loopSamples] += d[i];
      out.push(o);
    }
    // Normalise to -1 dBFS peak
    let peak = 0; for (const o of out) for (const x of o) peak = Math.max(peak, Math.abs(x));
    const gain = 0.89 / (peak || 1);
    for (const o of out) for (let i = 0; i < o.length; i++) o[i] *= gain;
    return { sampleRate, channels: out, seconds: loopLen, peakBefore: peak };
  }

  window.KitchenSoundtrack = { render, SONGS };
})();
