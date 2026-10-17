import type {Entitlement} from '../src/plans';
import type {Song,Asset} from '../src/types';
export type CryptoOperation='seal'|'open'|'identity'|'commit'|'session';
export type ScoreRequest={method:'inspect';fileName:string;base64:string}|{method:'load'|'learn';song:Omit<Song,'source'>;assets?:Omit<Asset,'blob'>[];entitlement?:Entitlement;sectionColours?:boolean}|{method:'cache';kind:'source'|'asset';fileId:string;base64:string;hash?:string;meta?:Omit<Asset,'blob'>}|{method:'pause'}|{method:'crypto';operation:CryptoOperation;args:any[]};
export type BridgeChunk={type:'chunk';id:string;index:number;total:number;data:string};
export type ScoreResponse={type:'result';id:string;result?:any;error?:string}|{type:'ready'}|{type:'save';id:string;song:any;assets:any[]}|{type:'back'}|{type:'practice';songId:string;seconds:number};
export const BRIDGE_CHUNK=48*1024;
export function chunkMessage(id:string,value:unknown):BridgeChunk[]{const text=JSON.stringify(value);if(text.length>48*1024*1024)throw Error('Score bridge message exceeds its size limit.');const total=Math.max(1,Math.ceil(text.length/BRIDGE_CHUNK));return Array.from({length:total},(_,index)=>({type:'chunk',id,index,total,data:text.slice(index*BRIDGE_CHUNK,(index+1)*BRIDGE_CHUNK)}));}
export class BridgeAssembler {
 private pending=new Map<string,{parts:string[];next:number;total:number;size:number;at:number}>();
 accept(value:BridgeChunk):unknown|undefined{
  for(const [id,p]of this.pending)if(p.at<Date.now()-120000)this.pending.delete(id);
  if(value.type!=='chunk'||typeof value.id!=='string'||value.id.length>100||!Number.isInteger(value.total)||value.total<1||value.total>1024||!Number.isInteger(value.index)||value.index<0||value.index>=value.total||typeof value.data!=='string'||value.data.length>BRIDGE_CHUNK)throw Error('Invalid score bridge chunk.');
  if(value.index===0){if(this.pending.size>=4)throw Error('Too many score transfers.');this.pending.set(value.id,{parts:[],next:0,total:value.total,size:0,at:Date.now()});}
  const p=this.pending.get(value.id);if(!p||p.next!==value.index||p.total!==value.total)throw Error('Score transfer is out of order.');p.parts.push(value.data);p.next++;p.size+=value.data.length;if(p.size>48*1024*1024){this.pending.delete(value.id);throw Error('Score transfer is too large.');}
  if(p.next!==p.total)return;this.pending.delete(value.id);return JSON.parse(p.parts.join(''));
 }
}
