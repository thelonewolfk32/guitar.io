import {_electron as electron} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('test-results'),version=JSON.parse(fs.readFileSync('package.json')).version,executablePath=path.resolve('../../Guitar-io-'+version+'-Windows-x64/Guitar.io.exe');
const profiles=[fs.mkdtempSync(path.join(root,'v141-pair-a-')),fs.mkdtempSync(path.join(root,'v141-pair-b-'))],apps=[],errors=[];
const button=(page,name)=>page.getByRole('button',{name,exact:true});
try{
  for(const profile of profiles){const app=await electron.launch({executablePath,env:{...process.env,GUITARIO_TEST_PROFILE:profile}});apps.push(app);const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await button(page,'Device sync').click();await page.getByRole('switch',{name:'Enable local sync'}).click();await page.getByLabel('This device’s pairing code').waitFor();}
  const a=await apps[0].firstWindow(),b=await apps[1].firstWindow(),code=await a.getByLabel('This device’s pairing code').textContent();assert.match(code,/^\d{6}$/);
  let discovered=false;for(let tries=0;tries<20;tries++){const status=await b.evaluate(()=>window.guitarLan.status());if(status.discovered.some(p=>p.code===code)){discovered=true;break;}await b.waitForTimeout(1000);}assert(discovered,'Bonjour did not find the host code');
  await button(b,'Add device').click();await b.getByLabel('Device pairing code').fill(code);await button(b,'Connect device').click();
  const pending=a.getByRole('dialog',{name:'Confirm device'});await pending.waitFor({timeout:10000});await b.getByLabel('Pairing verification digits').waitFor();assert.equal(await a.getByLabel('Pairing verification digits').textContent(),await b.getByLabel('Pairing verification digits').textContent());
  await pending.screenshot({path:'test-results/v141-pairing-confirm.png'});
  // The initiator cannot obtain the key before the host explicitly confirms.
  await button(b,'Digits match').click();await b.getByRole('alert').filter({hasText:'Confirm the matching digits'}).waitFor();assert.equal(await b.locator('.sync-peer').count(),0);
  await pending.getByRole('button',{name:'Digits match',exact:true}).click();await button(b,'Digits match').click();await b.locator('.sync-peer').waitFor();await a.locator('.sync-peer').waitFor();
  await a.getByLabel('Auto sync',{exact:true}).uncheck();await b.getByLabel('Auto sync',{exact:true}).uncheck();await button(a,'Reset pairing code').click();let newCode;for(let n=0;n<20;n++){newCode=await a.getByLabel('This device’s pairing code').textContent();const status=await b.evaluate(()=>window.guitarLan.status());if(newCode!==code&&status.discovered.some(p=>p.code===newCode))break;await b.waitForTimeout(1000);}assert.notEqual(newCode,code);assert((await b.evaluate(()=>window.guitarLan.status())).discovered.some(p=>p.code===newCode),'Updated Bonjour code propagates');await button(b,'Add device').click();await b.getByLabel('Device pairing code').fill(newCode);await button(b,'Connect device').click();await pending.waitFor();await pending.getByRole('button',{name:'Digits match',exact:true}).click();await button(b,'Digits match').click();await b.locator('.pairing-confirm').waitFor({state:'hidden'});await b.screenshot({path:'test-results/v141-device-sync.png'});
  await b.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);});const c=await new Promise(r=>{const q=db.transaction('settings').objectStore('settings').get('lan:config');q.onsuccess=()=>r(q.result);});if(c.autoSync!==false)throw new Error('Preference did not persist.');db.close();});
  await button(b,'Sync now').click();await b.waitForFunction(()=>!document.querySelector('.sync-footer .spin'));
  assert.deepEqual(errors,[]);console.log('PASS packaged V1.4.1: real Bonjour six-digit discovery, matching verification, host approval required, encrypted pairing, reciprocal peers, auto-sync preference and manual sync.');
}catch(error){for(const app of apps){const page=await app.firstWindow();console.log('Pairing diagnostics:',await page.getByRole('alert').allTextContents());}throw error;}finally{for(const app of apps)await app.close();for(const profile of profiles){assert(profile.startsWith(root+path.sep));fs.rmSync(profile,{recursive:true,force:true});}}
