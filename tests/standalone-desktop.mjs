// Drive a normal packaged launch: Electron's launcher otherwise tears down
// descendant processes when the app exits, including an updater waiting for exit.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import net from 'node:net';
async function freePort(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
export async function launch(executablePath,profile){
 const inspect=await freePort(),debug=await freePort(),child=spawn(executablePath,[`--inspect=${inspect}`,`--remote-debugging-port=${debug}`],{env:{...process.env,GUITARIO_TEST_PROFILE:profile},windowsHide:true,stdio:'ignore'});
 let targets;for(let n=0;n<150;n++){targets=await fetch(`http://127.0.0.1:${inspect}/json/list`).then(r=>r.json()).catch(()=>undefined);if(targets?.length)break;await new Promise(r=>setTimeout(r,100));}
 if(!targets?.length)throw Error('Standalone inspector did not start.');const ws=new WebSocket(targets[0].webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map();ws.onmessage=e=>{const data=JSON.parse(e.data);if(data.id&&pending.has(data.id)){const p=pending.get(data.id);pending.delete(data.id);data.result?.exceptionDetails?p.reject(Error(data.result.exceptionDetails.text)):p.resolve(data.result?.result?.value);}};
 let browser;for(let n=0;n<150;n++){try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${debug}`);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 if(!browser)throw Error('Standalone browser did not start.');let page;for(let n=0;n<150;n++){page=browser.contexts()[0]?.pages()[0];if(page)break;await new Promise(r=>setTimeout(r,100));}
 return {firstWindow:async()=>page,evaluate:(fn,arg)=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method:'Runtime.evaluate',params:{expression:`(${fn.toString()})(process.mainModule.require('electron'),${JSON.stringify(arg) ?? 'undefined'})`,awaitPromise:true,returnByValue:true}}));}),disconnectInspector:()=>ws.close(),close:async()=>{ws.close();if(child.exitCode===null)child.kill();await browser.close().catch(()=>{});await new Promise(r=>setTimeout(r,400));}};
}
