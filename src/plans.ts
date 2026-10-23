import {SONG_POLICY} from '../shared/library-policy.mjs';
export const PRO_PRICES = {currency:'AUD',monthly:500,yearly:5000} as const;
export const FREE_LIMITS = {songs:SONG_POLICY.freeSongs as number|null,bytes:150*1024*1024,fileBytes:30*1024*1024};
export const CLOUD_LIMITS = {bytes:1024*1024*1024,fileBytes:30*1024*1024};
export type Capabilities = {localSync:boolean;cloudSync:boolean;learning:boolean;autoSections:boolean;youtubeSync:boolean;onlineImport:boolean;betaFeatures:boolean;enterprise:boolean;stemSplitting:boolean};
export type Grant = {id:string;source:string;kind:'premium'|'beta'|'enterprise'|'limits';expiresAt?:string|null;extraSongs?:number;extraBytes?:number};
export type Entitlement = {schema?:1;plan:'free'|'pro';expiresAt?:string|null;checkedAt?:string;validUntil?:string;providers?:string[];capabilities?:Capabilities;limits?:typeof FREE_LIMITS;grantSources?:Grant[]};
const freeCapabilities:Capabilities={localSync:true,cloudSync:true,learning:true,autoSections:false,youtubeSync:false,onlineImport:false,betaFeatures:false,enterprise:false,stemSplitting:false};
export function entitlementFor(grants:Grant[]=[],now=Date.now()):Entitlement {
  const active=grants.filter(g=>!g.expiresAt||Date.parse(g.expiresAt)>now),paid=active.some(g=>g.kind==='premium'||g.kind==='enterprise');
  const until=Math.min(now+7*86400000,...active.flatMap(g=>g.expiresAt?[Date.parse(g.expiresAt)]:[]));
  return {schema:1,plan:paid?'pro':'free',checkedAt:new Date(now).toISOString(),validUntil:new Date(until).toISOString(),expiresAt:paid?new Date(until).toISOString():undefined,providers:[...new Set(active.map(g=>g.source))],grantSources:active,
    capabilities:{...freeCapabilities,autoSections:paid,youtubeSync:paid,onlineImport:paid,betaFeatures:paid||active.some(g=>g.kind==='beta'),enterprise:active.some(g=>g.kind==='enterprise')},
    limits:{songs:paid?null:SONG_POLICY.freeSongs+active.reduce((n,g)=>n+Math.max(0,g.extraSongs||0),0),bytes:(paid?CLOUD_LIMITS.bytes:FREE_LIMITS.bytes)+active.reduce((n,g)=>n+Math.max(0,g.extraBytes||0),0),fileBytes:FREE_LIMITS.fileBytes}};
}
export function featureAccess(value?:Entitlement,now=Date.now()) {
  const cached=!!value?.schema&&!!value.validUntil&&Date.parse(value.validUntil)>now&&!!value.checkedAt&&Date.parse(value.checkedAt)<=now+60000;
  const legacy=value?.plan==='pro'&&!!value.expiresAt&&Date.parse(value.expiresAt)>now&&(!value.checkedAt||Date.parse(value.checkedAt)+7*86400000>now);
  const effective=cached?value!:entitlementFor(legacy?[{id:'legacy',source:'legacy',kind:'premium',expiresAt:value!.expiresAt}]:[],now);
  const limits={...(effective.limits||FREE_LIMITS)};
  // Cached snapshots from V1.6 must not leave an upgraded tester on five songs.
  // Hosted reservations still enforce the deployed server's authoritative quota.
  if(SONG_POLICY.testing&&effective.plan!=='pro'&&limits.songs!==null)limits.songs=Math.max(SONG_POLICY.freeSongs+(effective.grantSources||[]).filter(g=>!g.expiresAt||Date.parse(g.expiresAt)>now).reduce((n,g)=>n+Math.max(0,g.extraSongs||0),0),limits.songs);
  return {...freeCapabilities,...effective.capabilities,paid:effective.plan==='pro',limits,stemSplitting:false,testingSongLimit:SONG_POLICY.testing};
}
export function canAddEntries(existing:number,additions:number,entitlement?:Entitlement){const limit=featureAccess(entitlement).limits.songs;return limit===null||existing+additions<=limit;}
