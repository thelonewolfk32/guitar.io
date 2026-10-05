import { getAsset, getArtworkThumbnail } from './storage';

type Entry = { refs: number; size: number; url: string; promise: Promise<string> };
const urls = new Map<string, Entry>();
function trim() {
  let bytes = [...urls.values()].reduce((n,e)=>n+e.size,0);
  for (const [key,entry] of urls) {
    if (urls.size<=64 && bytes<=32*1024*1024) break;
    if (!entry.refs) { if(entry.url)URL.revokeObjectURL(entry.url);urls.delete(key);bytes-=entry.size; }
  }
}
/** Coalesce duplicate card/story/collection requests and reuse bounded blob URLs. */
export function acquireAssetUrl(id: string, original = false) {
  const key = `${original?'original':'thumbnail'}:${id}`;
  let entry = urls.get(key);
  if (!entry) {
    entry = {refs:0,size:0,url:'',promise:Promise.resolve('')};
    const current=entry;
    current.promise=(original?getAsset(id).then(a=>a?.blob):getArtworkThumbnail(id)).then(blob=>{if(!blob){if(urls.get(key)===current)urls.delete(key);return '';}current.size=blob.size;current.url=URL.createObjectURL(blob);return current.url;}).catch(e=>{if(urls.get(key)===current)urls.delete(key);throw e;});
  }
  urls.delete(key);urls.set(key,entry);entry.refs++;
  let released=false;
  return { promise:entry.promise, release:()=>{if(released)return;released=true;entry!.refs--;void entry!.promise.finally(trim).catch(()=>{});trim();} };
}
