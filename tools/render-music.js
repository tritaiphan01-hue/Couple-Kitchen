// Renders the soundtrack loops to public/music/<mood>.mp3.
//   node tools/render-music.js
// Needs Playwright's Chromium (for OfflineAudioContext) and ffmpeg with libmp3lame.
// To use your own music instead, just replace the files in public/music/ (same names).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

function wav(channels, sampleRate) {
  const n = channels[0].length, ch = channels.length;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * ch * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, channels[c][i])); buf.writeInt16LE(Math.round(v * 32767), o); o += 2; }
  return buf;
}

(async () => {
  const outDir = path.join(__dirname, '..', 'public', 'music');
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ck-music-'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>render</title>');
  await page.addScriptTag({ path: path.join(__dirname, 'music-synth.js') });
  for (const mood of ['chill', 'rush', 'sneak']) {
    const r = await page.evaluate(async m => {
      const { sampleRate, channels, seconds, peakBefore } = await window.KitchenSoundtrack.render(m);
      return { sampleRate, seconds, peakBefore, channels: channels.map(c => Array.from(c)) };
    }, mood);
    const wavPath = path.join(tmp, mood + '.wav'), mp3Path = path.join(outDir, mood + '.mp3');
    fs.writeFileSync(wavPath, wav(r.channels.map(c => Float32Array.from(c)), r.sampleRate));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '128k', mp3Path]);
    console.log(`${mood}: ${r.seconds.toFixed(1)}s loop, raw peak ${r.peakBefore.toFixed(2)} → ${(fs.statSync(mp3Path).size / 1024).toFixed(0)} KB`);
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();
