ObjC.import('Foundation');

function unwrap(value) {
  if (value === undefined || value === null) return null;
  try { return ObjC.unwrap(value); } catch (_) {}
  try { return value.js; } catch (_) {}
  try { return String(value); } catch (_) {}
  return null;
}

function valueFor(dict, key) {
  if (!dict) return null;
  try { return unwrap(dict.valueForKey(key)); } catch (_) { return null; }
}

function numberFor(dict, key) {
  const v = valueFor(dict, key);
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function stringFor(dict, key) {
  const v = valueFor(dict, key);
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s || /^(null|nil|undefined)$/i.test(s)) return '';
  return s;
}

function run() {
  try {
    const bundle = $.NSBundle.bundleWithPath('/System/Library/PrivateFrameworks/MediaRemote.framework/');
    if (!bundle) return JSON.stringify({ ok: false, error: 'MediaRemote.framework unavailable' });
    bundle.load;

    const Request = $.NSClassFromString('MRNowPlayingRequest');
    if (!Request) return JSON.stringify({ ok: false, error: 'MRNowPlayingRequest unavailable' });

    let appName = '';
    try {
      const path = Request.localNowPlayingPlayerPath;
      const client = path ? path.client : null;
      appName = client ? String(unwrap(client.displayName) || '') : '';
    } catch (_) {}

    let item = null;
    try { item = Request.localNowPlayingItem; } catch (_) {}
    if (!item) return JSON.stringify({ ok: true, detector: 'system-jxa', appName, track: null });

    let info = null;
    try { info = item.nowPlayingInfo; } catch (_) {}
    if (!info) return JSON.stringify({ ok: true, detector: 'system-jxa', appName, track: null });

    const track = {
      title: stringFor(info, 'kMRMediaRemoteNowPlayingInfoTitle'),
      artist: stringFor(info, 'kMRMediaRemoteNowPlayingInfoArtist'),
      album: stringFor(info, 'kMRMediaRemoteNowPlayingInfoAlbum'),
      duration: numberFor(info, 'kMRMediaRemoteNowPlayingInfoDuration'),
      elapsedTime: numberFor(info, 'kMRMediaRemoteNowPlayingInfoElapsedTime'),
      playbackRate: numberFor(info, 'kMRMediaRemoteNowPlayingInfoPlaybackRate'),
      uniqueIdentifier: stringFor(info, 'kMRMediaRemoteNowPlayingInfoUniqueIdentifier')
    };

    return JSON.stringify({ ok: true, detector: 'system-jxa', appName, track });
  } catch (error) {
    return JSON.stringify({ ok: false, error: String(error) });
  }
}
