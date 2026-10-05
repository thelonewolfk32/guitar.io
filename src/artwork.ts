import type { Asset, Song, LibrarySong } from './types';

type Release = { id: string; title: string; status?: string; date?: string; 'release-group'?: { 'primary-type'?: string } };
type Match = { score: number; title: string; 'artist-credit'?: { name?: string; artist?: { name: string } }[]; releases?: Release[] };
const normal = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
const quote = (value: string) => `"${value.replace(/[\\"]/g, ' ')}"`;

export function bestRelease(matches: Match[], song: Pick<Song, 'title' | 'artist' | 'album'>): Release | undefined {
  const releases = matches.filter(m => Number(m.score) >= 95 && normal(m.title) === normal(song.title) && m['artist-credit']?.some(a => normal(a.artist?.name || a.name || '') === normal(song.artist))).flatMap(m => m.releases || []).filter(r => /^[0-9a-f-]{36}$/i.test(r.id) && r.status === 'Official' && (!song.album || normal(r.title) === normal(song.album)));
  const albums = releases.filter(r => r['release-group']?.['primary-type'] === 'Album');
  return (albums.length ? albums : releases).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))[0];
}

let musicBrainzQueue: Promise<unknown> = Promise.resolve();
let lastLookup = 0;
async function lookupRelease(song: Song): Promise<Release | undefined> {
  const task = musicBrainzQueue.catch(() => {}).then(async () => {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, lastLookup + 1100 - Date.now())));
    lastLookup = Date.now();
    const query = new URLSearchParams({ query: `recording:${quote(song.title)} AND artist:${quote(song.artist)}`, fmt: 'json', limit: '10' });
    const response = await fetch(`https://musicbrainz.org/ws/2/recording/?${query}`, { signal: AbortSignal.timeout(10000), credentials: 'omit' });
    if (!response.ok) throw new Error('Music lookup is unavailable.');
    const body = await response.json();
    return bestRelease(body.recordings || [], song);
  });
  musicBrainzQueue = task;
  return task;
}

export async function imageAsset(url: string, name: string): Promise<Asset> {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), credentials: 'omit' });
  if (!response.ok) throw new Error('Artwork is unavailable.');
  const blob = await response.blob();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 8 * 1024 * 1024) throw new Error('Artwork format is unsupported.');
  return { id: crypto.randomUUID(), kind: 'artwork', name, mime: blob.type, blob };
}

export type ArtworkCandidate = { title: string; artist: string; image: string; source: string; recording?:string };
export async function searchArtwork(song: Pick<Song,'title'|'artist'|'album'>, term = [song.artist,song.album || song.title].join(' ')): Promise<ArtworkCandidate[]> {
  const candidates: ArtworkCandidate[] = [];
  const tasks = await Promise.allSettled([
    (async()=>{
      for(const [queryTerm,entity] of [[term,song.album?'album':'song'],[song.artist,'album']]) {
        const query=new URLSearchParams({term:queryTerm,media:'music',entity,limit:'30'});
        const response=await fetch(`https://itunes.apple.com/search?${query}`,{signal:AbortSignal.timeout(10000),credentials:'omit'});
        if(!response.ok)continue;
        const body=await response.json();
        for(const r of body.results || []) if(r.artworkUrl100 && /^https:\/\/[^/]*\.mzstatic\.com\//.test(r.artworkUrl100)) candidates.push({title:r.collectionName || r.trackName,artist:r.artistName || '',recording:r.trackName,image:r.artworkUrl100.replace(/100x100bb/,'600x600bb'),source:/^https:\/\/(music|itunes)\.apple\.com\//.test(r.collectionViewUrl || '')?r.collectionViewUrl:'https://music.apple.com/'});
        if(body.results?.length)break;
      }
    })(),
    musicBrainzQueue.catch(()=>{}).then(async()=>{
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,lastLookup+1100-Date.now())));lastLookup=Date.now();
      const query=new URLSearchParams({query:song.album?`release:${quote(song.album)} AND artist:${quote(song.artist)}`:`artist:${quote(song.artist)}`,fmt:'json',limit:'12'});
      const response=await fetch(`https://musicbrainz.org/ws/2/release/?${query}`,{signal:AbortSignal.timeout(10000),credentials:'omit'});
      if(!response.ok)return;
      const body=await response.json();
      for(const r of body.releases || []) if(/^[0-9a-f-]{36}$/i.test(r.id)) candidates.push({title:r.title,artist:r['artist-credit']?.map((a:{name:string})=>a.name).join(', ') || song.artist,image:`https://coverartarchive.org/release/${r.id}/front-500`,source:`https://musicbrainz.org/release/${r.id}`});
    }),
    (async()=>{
      const query=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrsearch:`${song.artist} ${song.album || song.title} album`,gsrlimit:'5',prop:'pageimages|pageterms',wbptterms:'description',piprop:'thumbnail',pithumbsize:'600'});
      const response=await fetch(`https://en.wikipedia.org/w/api.php?${query}`,{signal:AbortSignal.timeout(10000),credentials:'omit'});
      if(!response.ok)return;
      const body=await response.json();
      for(const p of Object.values(body.query?.pages || {}) as {title:string;thumbnail?:{source:string};terms?:{description?:string[]}}[]) if(p.thumbnail && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(p.thumbnail.source) && /album|soundtrack|EP/i.test(p.terms?.description?.join(' ') || p.title)) candidates.push({title:p.title.replace(/\s*\([^)]*album\)$/i,''),artist:song.artist,image:p.thumbnail.source,source:`https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`});
    })(),
  ]);
  musicBrainzQueue=Promise.resolve();
  if(!candidates.length && tasks.every(r=>r.status==='rejected')) throw new Error('Artwork search is unavailable. Try again or upload a picture.');
  return [...new Map(candidates.map(c=>[normal(c.title)+normal(c.artist),c])).values()].sort((a,b)=>Number(normal(b.artist)===normal(song.artist))-Number(normal(a.artist)===normal(song.artist))).slice(0,16);
}

async function artistPicture(artist: string): Promise<Asset | undefined> {
  const query = new URLSearchParams({ action: 'query', format: 'json', origin: '*', redirects: '1', prop: 'pageimages|pageterms|pageprops', piprop: 'thumbnail', pithumbsize: '600', wbptterms: 'description', titles: `${artist}|${artist} (band)|${artist} (musician)` });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${query}`, { signal: AbortSignal.timeout(10000), credentials: 'omit' });
  if (!response.ok) return;
  const body = await response.json();
  type Page = { title: string; pageprops?: { disambiguation?: string }; terms?: { description?: string[] }; thumbnail?: { source: string } };
  const page = (Object.values(body.query?.pages || {}) as Page[]).find(p => p.pageprops?.disambiguation === undefined && /band|musician|singer|rapper|composer|musical|duo|trio|guitarist/i.test(p.terms?.description?.join(' ') || '') && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(p.thumbnail?.source || ''));
  if (page?.thumbnail) return imageAsset(page.thumbnail.source, `${artist} · Wikipedia`);
}

export async function findArtwork(song: Song, library: LibrarySong[] = []): Promise<{ song: Song; assets: Asset[]; message: string }> {
  if (!song.artist.trim() || song.artist === 'Unknown artist' || song.demo) return { song, assets: [], message: 'Add an artist name to look up artwork.' };
  const assets: Asset[] = [];
  let updated = { ...song };
  const key = `Artists:${song.artist}`;
  const existingArtistArt = library.find(s => s.artist === song.artist && s.collectionArt?.[key])?.collectionArt?.[key];
  if (existingArtistArt) updated.collectionArt = { ...updated.collectionArt, [key]: existingArtistArt };
  const results = await Promise.allSettled([
    song.artworkAssetId ? Promise.resolve(undefined) : (async()=>{
      const release = await lookupRelease(song).catch(()=>undefined);
      let found: Asset | undefined, album = release?.title || song.album, source = release ? `https://musicbrainz.org/release/${release.id}` : '';
      if(release) found=await imageAsset(`https://coverartarchive.org/release/${release.id}/front-500`, `${release.title} · Cover Art Archive`).catch(()=>undefined);
      if(!found) {
        const choices=await searchArtwork(song).catch(()=>[]);
        for(const c of choices.filter(c=>normal(c.artist)===normal(song.artist) && (song.album ? normal(c.title)===normal(song.album) : normal(c.recording || '')===normal(song.title))).slice(0,3)) { album ||= c.title;found=await imageAsset(c.image,c.title).catch(()=>undefined);if(found){album=c.title;source=c.source;break;} }
      }
      // A confident album match remains useful even when its image is unavailable.
      if(!song.album&&album)updated={...updated,album};
      if(found){assets.push(found);updated={...updated,album:song.album || album,artworkAssetId:found.id,artworkSource:source};}
    }),
    updated.collectionArt?.[key] ? Promise.resolve(undefined) : artistPicture(song.artist).then(asset => {
      if (asset) { assets.push(asset); updated = { ...updated, collectionArt: { ...updated.collectionArt, [key]: asset.id } }; }
    }),
  ]);
  const message = assets.length ? `Found ${assets.length} artwork image${assets.length > 1 ? 's' : ''}.` : results.some(r => r.status === 'rejected') ? 'Artwork lookup was unavailable; your song is saved. You can retry in Song details.' : 'No confident artwork match. You can add a picture in Song details.';
  return { song: updated, assets, message };
}
