import {base64,unbase64} from './lan-crypto.mjs';
export function shortCode(){const values=new Uint32Array(1);let n;do{crypto.getRandomValues(values);n=values[0];}while(n>=4294000000);return String(n%1000000).padStart(6,'0');}
export async function pairingIdentity(){
  const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
  return {privateKey:keys.privateKey,publicKey:base64(new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey)))};
}
export async function pairingCommit(publicKey,nonce,requestId){
  if(typeof publicKey!=='string'||publicKey.length>200||typeof nonce!=='string'||unbase64(nonce).length!==32||typeof requestId!=='string'||requestId.length>100)throw new Error('Invalid pairing commitment.');
  return base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(['Guitar.io pairing commitment v1',requestId,publicKey,nonce])))));
}
/** Bind the verification digits and session key to both public keys and this one-time request. */
export async function pairingSession(identity, remoteKey, requestId, initiator){
  if(typeof requestId!=='string'||requestId.length>100||typeof remoteKey!=='string'||remoteKey.length>200)throw new Error('Invalid pairing request.');
  const remote=await crypto.subtle.importKey('raw',unbase64(remoteKey),{name:'ECDH',namedCurve:'P-256'},false,[]);
  const bits=await crypto.subtle.deriveBits({name:'ECDH',public:remote},identity.privateKey,256);
  const transcript=new TextEncoder().encode(JSON.stringify(['Guitar.io pairing v1',requestId,initiator?identity.publicKey:remoteKey,initiator?remoteKey:identity.publicKey]));
  const material=await crypto.subtle.importKey('raw',bits,'HKDF',false,['deriveBits']);
  const secret=base64(new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:transcript,info:new TextEncoder().encode('session encryption')},material,256)));
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array([...new Uint8Array(bits),...transcript])));
  const number=new DataView(hash.buffer).getUint32(0)%1000000;
  return {secret,digits:String(number).padStart(6,'0')};
}
