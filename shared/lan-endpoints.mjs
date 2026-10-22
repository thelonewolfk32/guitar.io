import {localEndpoint} from './lan-crypto.mjs';
export function directEndpoint(value){const text=value.trim();return localEndpoint(text.startsWith('http://')?text:`http://${text}${text.endsWith('/sync')?'':'/sync'}`);}
export function rankEndpoints(values){
  const rank=value=>{const host=new URL(value).hostname;return host.startsWith('169.254.')?3:host.startsWith('127.')?2:1;};
  return [...new Set(values.map(localEndpoint))].sort((a,b)=>rank(a)-rank(b));
}
export function connectionProblem(error,endpoint){
  const text=String(error?.message||error),code=String(error?.cause?.code||error?.code||'');
  if(/identity|commitment/i.test(text))return `[LAN-PAIR-004] Device identity did not match at ${endpoint}.`;
  if(/ECONNREFUSED|refused/i.test(code+' '+text))return `[LAN-NET-002] Connection refused at ${endpoint}. Keep Guitar.io open with Local sync enabled; check its firewall permission.`;
  if(/Timeout|ETIMEDOUT|timed out|aborted/i.test(code+' '+text))return `[LAN-NET-001] Connection timed out at ${endpoint}. Check the address, network and firewall.`;
  if(/Pairing rejected|Pairing is unavailable|code/i.test(text))return `[LAN-PAIR-002] Pairing rejected at ${endpoint}. Check the six-digit code and any pending confirmation.`;
  return `[LAN-NET-003] Cannot connect at ${endpoint}: ${text}`;
}
