export function youtubeVideoId(input) {
  let url;
  try { url = new URL(input.trim()); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  let id;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com'].includes(host)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null;
  }
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}

export function validOffset(value) { return Number.isFinite(value) && value >= -3600 && value <= 86400; }
export function mediaToScoreSeconds(mediaSeconds, offsetSeconds) { return Math.max(0, mediaSeconds - offsetSeconds); }
export function scoreToMediaSeconds(scoreSeconds, offsetSeconds) { return Math.max(0, scoreSeconds + offsetSeconds); }
export function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
}

export function youtubeError(code) {
  if (code === 101 || code === 150) return 'The video owner has disabled embedding. Use an MP3 or another video that allows embedding.';
  if (code === 100) return 'This video is unavailable or private.';
  if (code === 153) return 'YouTube could not identify this desktop player. Use MP3 playback, or open the video on YouTube.';
  return `YouTube playback failed (${code}). Check the link and your connection, or use an MP3.`;
}
