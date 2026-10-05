import http from 'node:http';
import os from 'node:os';
import {Bonjour} from 'bonjour-service';
import {open,seal,privateIPv4,localEndpoint} from '../shared/lan-crypto.mjs';

export class LanService {
  constructor(handler){this.handler=handler;this.peers=new Map();this.replay=new Map();this.server=undefined;this.bonjour=undefined;this.config=undefined;this.pending=0;}
  status(){return {available:true,enabled:!!this.server,name:this.config?.name || os.hostname(),endpoints:this.endpoints || [],discovered:[...this.peers.values()],error:this.error || ''};}
  addresses(){const port=this.server?.address()?.port,addresses=port?Object.values(os.networkInterfaces()).flat().filter(a=>a?.family==='IPv4'&&!a.internal&&privateIPv4(a.address)).map(a=>`http://${a.address}:${port}/sync`):[];const routed=addresses.filter(a=>!a.includes('169.254.'));return routed.length?routed:addresses;}
  advertise(){this.service=this.bonjour.publish({name:`Guitar.io ${this.config.id}`,type:'guitario',port:this.server.address().port,txt:{id:this.config.id,name:this.config.name,protocol:'1',code:this.config.pairingCode || ''}});}
  async configure(config){
    if(!config.enabled){await this.stop();return this.status();}
    if(typeof config.id!=='string'||config.id.length>200||typeof config.secret!=='string'||typeof config.name!=='string'||config.name.length>100)throw new Error('Invalid LAN configuration.');
    if(this.server && this.config?.secret===config.secret && this.config?.name===config.name && this.config?.pairingCode===config.pairingCode)return this.status();
    await this.stop();this.config=config;this.error='';
    this.server=http.createServer(async(request,response)=>{
      response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
      if(request.method!=='POST'||request.url!=='/sync'||!privateIPv4(request.socket.remoteAddress || '')){response.writeHead(403);response.end();return;}
      if(this.pending>=4){response.writeHead(429);response.end();return;}
      this.pending++;
      try{
        let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>48*1024*1024)throw new Error('Sync page too large.');chunks.push(chunk);}
        const envelope=JSON.parse(Buffer.concat(chunks).toString());
        if(envelope?.op==='pair:init'||envelope?.op==='pair:reveal'||envelope?.op==='pair:finish'){
          if(size>4096)throw new Error('Pairing request too large.');
          const payload=await this.handler(envelope,'pairing');
          response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(payload));return;
        }
        const message=await open(this.config.secret,envelope);
        if(Math.abs(Date.now()-message.at)>120000 || typeof message.requestId!=='string'||message.requestId.length>100||this.replay.has(message.requestId)||typeof message.deviceId!=='string'||message.deviceId.length>200)throw new Error('Expired or replayed request.');
        this.replay.set(message.requestId,Date.now());for(const [id,time] of this.replay)if(time<Date.now()-120000)this.replay.delete(id);if(this.replay.size>20000)throw new Error('Too many sync requests.');
        let payload;try{payload=await this.handler(message.payload,message.deviceId);}catch(e){payload={error:e.message || 'Sync request failed.'};}
        const result=await seal(this.config.secret,{requestId:message.requestId,deviceId:this.config.id,payload});response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(result));
      }catch{response.writeHead(403);response.end();}finally{this.pending--;}
    });
    this.server.requestTimeout=30000;this.server.headersTimeout=10000;
    await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(0,'0.0.0.0',resolve);});
    const port=this.server.address().port;
    this.endpoints=this.addresses();
    try{
      this.bonjour=new Bonjour();this.advertise();
      const discovered=service=>{const id=service.txt?.id;if(!id||id===config.id)return;const all=(service.addresses || []).filter(privateIPv4).map(address=>`http://${address}:${service.port}/sync`),routed=all.filter(a=>!a.includes('169.254.')),endpoints=routed.length?routed:all;if(endpoints.length)this.peers.set(id,{id,name:service.txt?.name || 'Guitar.io',code:service.txt?.code || this.peers.get(id)?.code || '',endpoints});};
      this.browser=this.bonjour.find({type:'guitario'},discovered);
      this.browser.on('txt-update',discovered);this.browser.on('srv-update',discovered);
      this.browser.on('down',service=>this.peers.delete(service.txt?.id));
      this.networkTimer=setInterval(()=>{const addresses=this.addresses();if(JSON.stringify(addresses)!==JSON.stringify(this.endpoints)){this.endpoints=addresses;this.service?.stop(()=>{if(this.server&&this.bonjour)this.advertise();});}},5000);this.networkTimer.unref();
    }catch(e){this.error='Automatic discovery unavailable. Use the pairing address. '+e.message;}
    return this.status();
  }
  async request(endpoint,body){localEndpoint(endpoint);const result=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000),redirect:'error'});if(!result.ok)throw new Error(result.status===403?'Pairing rejected. Check the pairing code and device clocks.':`LAN connection failed (${result.status}).`);const text=await result.text();if(text.length>64*1024*1024)throw new Error('Sync response too large.');return JSON.parse(text);}
  async stop(){if(this.networkTimer)clearInterval(this.networkTimer);this.browser?.stop();this.bonjour?.unpublishAll();this.bonjour?.destroy();this.bonjour=undefined;this.browser=undefined;this.peers.clear();this.endpoints=[];if(this.server){const server=this.server;this.server=undefined;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
}
