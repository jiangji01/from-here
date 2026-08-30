const fs = require('fs');

class MediaMemory {
  constructor(file, { ttlMs = 6 * 60 * 60 * 1000 } = {}) {
    this.file = file;
    this.ttlMs = ttlMs;
    this.lastGood = null;
    this.lastGoodAt = 0;
    this.load();
  }

  load() {
    try {
      if (!this.file || !fs.existsSync(this.file)) return;
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (raw?.track?.title && raw?.track?.artist) {
        this.lastGood = raw.track;
        this.lastGoodAt = Number(raw.at || 0);
      }
    } catch {}
  }

  save() {
    if (!this.file || !this.lastGood) return;
    try {
      fs.writeFileSync(this.file, JSON.stringify({ track: this.lastGood, at: this.lastGoodAt }, null, 2));
    } catch {}
  }

  accept(track, now = Date.now()) {
    if (!track?.title || !track?.artist) return this.fallback(now);
    this.lastGood = { ...track };
    this.lastGoodAt = now;
    this.save();
    return { track: { ...this.lastGood }, stale: false, source: 'fresh', lastGoodAt: this.lastGoodAt };
  }

  fallback(now = Date.now()) {
    if (!this.lastGood) return { track: null, stale: true, source: 'none', lastGoodAt: 0 };
    const ageMs = Math.max(0, now - this.lastGoodAt);
    if (this.ttlMs > 0 && ageMs > this.ttlMs) return { track: null, stale: true, source: 'expired', lastGoodAt: this.lastGoodAt, ageMs };
    return { track: { ...this.lastGood }, stale: true, source: 'last-good', lastGoodAt: this.lastGoodAt, ageMs };
  }
}

module.exports = { MediaMemory };
