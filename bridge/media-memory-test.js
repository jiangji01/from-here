const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MediaMemory } = require('./media-memory');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'from-here-media-'));
const file = path.join(dir, 'media.json');
const t0 = 100000;
const track = { title: 'Dirty Paws', artist: 'Of Monsters and Men', album: 'My Head Is an Animal' };

const a = new MediaMemory(file, { ttlMs: 6 * 3600e3 });
assert.equal(a.fallback(t0).track, null);
const fresh = a.accept(track, t0);
assert.equal(fresh.stale, false);
assert.equal(fresh.track.title, 'Dirty Paws');
const blankAfter20s = a.fallback(t0 + 20000);
assert.equal(blankAfter20s.track.title, 'Dirty Paws');
assert.equal(blankAfter20s.stale, true);

// Side Panel closing destroys its JS memory; the Bridge must still preserve the track.
const b = new MediaMemory(file, { ttlMs: 6 * 3600e3 });
const reopened = b.fallback(t0 + 60000);
assert.equal(reopened.track.artist, 'Of Monsters and Men');
assert.equal(reopened.source, 'last-good');

const expired = b.fallback(t0 + 7 * 3600e3);
assert.equal(expired.track, null);
console.log('✓ media memory: transient blank + Side Panel reopen + TTL');
