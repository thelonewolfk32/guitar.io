export type SharedSongLink={provider:'spotify'|'youtube'|'apple';id:string;url:string};
export type PendingSong={id:string;kind:'pending';title:string;artist:string;link:SharedSongLink;createdAt:string};
export type GPMatch={title:string;url:string;description:string};
export interface AuthorisedGPProvider {search(query:{title:string;artist:string}):Promise<GPMatch[]>;download(candidateId:string):Promise<{fileName:string;bytes:Uint8Array}>;}
export function parseSongLink(input:string):SharedSongLink {
 const match=input.match(/https:\/\/[^\s<>]+/i);if(!match)throw Error('Share an HTTPS Spotify, YouTube or Apple Music song link.');
 const u=new URL(match[0]);if(u.username||u.password||u.port)throw Error('Invalid music link.');
 const host=u.hostname.toLowerCase();let id='';
 if(host==='open.spotify.com'){id=u.pathname.match(/^\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]{22})\/?$/)?.[1]||'';if(id)return {provider:'spotify',id,url:'https://open.spotify.com/track/'+id};}
 if(['www.youtube.com','youtube.com','m.youtube.com','youtu.be'].includes(host)){id=host==='youtu.be'?u.pathname.slice(1):u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:u.searchParams.get('v')||'';if(/^[a-zA-Z0-9_-]{11}$/.test(id))return {provider:'youtube',id,url:'https://www.youtube.com/watch?v='+id};}
 if(host==='music.apple.com'){id=u.searchParams.get('i')||u.pathname.match(/\/song\/(?:[^/]+\/)?(\d+)\/?$/)?.[1]||'';if(/^\d{1,20}$/.test(id)){const country=u.pathname.split('/')[1];if(/^[a-z]{2}$/.test(country))return {provider:'apple',id,url:'https://music.apple.com/'+country+'/song/'+id};}}
 throw Error('Use a single song or YouTube video link, rather than an album, playlist or profile.');
}
export function newPendingSong(input:string,title=''):PendingSong {const link=parseSongLink(input);return {id:crypto.randomUUID(),kind:'pending',title:title.trim().slice(0,200)||'Shared song',artist:'',link,createdAt:new Date().toISOString()};}
