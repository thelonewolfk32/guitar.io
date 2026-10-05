import { chromium, _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
const root=path.resolve('dist');
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.mjs':'text/javascript','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));fs.mkdirSync('test-results',{recursive:true});
const desktop=process.argv.includes('--desktop'),{version}=JSON.parse(fs.readFileSync('package.json','utf8'));
const browser=desktop?await electron.launch({executablePath:path.resolve(process.env.GUITARIO_OUTPUT_DIR || 'release/artifacts',`Guitar-io-${version}-Windows-x64/Guitar.io.exe`),env:{...process.env,GUITARIO_TEST_PROFILE:fs.mkdtempSync(path.resolve('test-results/desktop-v8-'))}}):await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=desktop?await browser.firstWindow():await browser.newPage({viewport:{width:1512,height:960}});
await page.addInitScript(()=>localStorage.setItem('guitario-auto-artwork','off'));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
async function stored(){return page.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);});return new Promise(r=>{const q=db.transaction('songs').objectStore('songs').getAll();q.onsuccess=()=>{db.close();r(q.result);};});});}
const card=title=>page.locator('.song-card').filter({has:button(`Open ${title}`)});
const order=()=>page.locator('.song-card h2').allTextContents();
async function waitRating(title,n){await page.waitForFunction(({title,n})=>document.querySelector(`[aria-label="${title} difficulty"] button[aria-checked=true]`)?.getAttribute('aria-label')===`${n} ${n===1?'star':'stars'}`,{title,n});}
const fixture=alphaTab.importer.ScoreLoader.loadAlphaTex('\\title "One click study" \\artist "Import test" . 0.6.4 2.6.4 3.6.4 5.6.4');
const bytes=Array.from(new alphaTab.exporter.Gp7Exporter().export(fixture));
try{
  await page.goto(desktop?'guitario://app/':`http://127.0.0.1:${server.address().port}/`);await button('Open Afterglow').waitFor();
  assert.equal(await page.locator('.add-song-card').innerText(),'');
  await card('Paper Trails').getByRole('radio',{name:'4 stars',exact:true}).click();await waitRating('Paper Trails',4);
  await card('Afterglow').getByRole('radio',{name:'2 stars',exact:true}).click();await waitRating('Afterglow',2);
  await card('Afterglow').getByRole('radio',{name:'2 stars',exact:true}).press('ArrowRight');await waitRating('Afterglow',3);
  await page.reload();await button('Open Afterglow').waitFor();await waitRating('Afterglow',3);await waitRating('Paper Trails',4);
  await button('Filters & sort').click();await page.getByLabel('Filter difficulty').selectOption('4');assert.deepEqual(await order(),['Paper Trails']);
  await page.getByLabel('Filter difficulty').selectOption('unrated');assert.deepEqual(await order(),['Low Orbit']);await page.getByLabel('Filter difficulty').selectOption('');await button('Filters & sort').click();
  await button('Edit Paper Trails details').click();await page.getByLabel('Artist',{exact:true}).fill('Alpha');await page.getByLabel('Album',{exact:true}).fill('Zebra');await button('Save changes').click();
  await button('Edit Afterglow details').click();await page.getByLabel('Artist',{exact:true}).fill('Zed');await page.getByLabel('Album',{exact:true}).fill('Apple');await button('Save changes').click();
  await button('List view').click();await button('Sort by difficulty').click();assert.deepEqual(await order(),['Paper Trails','Afterglow','Low Orbit']);
  await button('Sort by difficulty').click();assert.deepEqual(await order(),['Low Orbit','Afterglow','Paper Trails']);
  await button('Sort by name').click();assert.deepEqual(await order(),['Afterglow','Low Orbit','Paper Trails']);await button('Sort by name').click();assert.deepEqual(await order(),['Paper Trails','Low Orbit','Afterglow']);
  await button('Sort by artist').click();assert.equal((await order())[0],'Paper Trails');await button('Sort by artist').click();assert.equal((await order())[0],'Afterglow');
  await button('Sort by album').click();assert.equal((await order())[0],'Low Orbit');await button('Sort by album').click();assert.equal((await order())[0],'Paper Trails');
  await page.screenshot({path:'test-results/v8-list.png'});await page.setViewportSize({width:1100,height:760});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/v8-list-small.png'});await page.setViewportSize({width:1512,height:960});
  await button('Artists').click();await button('Small cards').click();await button('Tunings').click();await button('Large cards').click();await button('Guitars').click();await button('Small cards').click();
  await page.reload();await button('Open Afterglow').waitFor();assert.equal(await button('List view').getAttribute('aria-pressed'),'true');
  for(const [tab,view] of [['Artists','Small cards'],['Tunings','Large cards'],['Guitars','Small cards']]){await button(tab).click();assert.equal(await button(view).getAttribute('aria-pressed'),'true');}
  await button('Add guitar').click();await page.getByLabel('Guitar name',{exact:true}).fill('Auto ESP');await button('Add tuning').click();await button('STANDARD').click();await page.getByLabel('Tuning preset').selectOption('guitar-6-Standard-0');await button('Use this tuning').click();await button('Save guitar').click();
  await button('Open Auto ESP collection').click();await button('Open E standard collection').click();await button('Open Paper Trails').waitFor();assert.equal(await page.locator('.song-card').count(),1);
  await button('Open Paper Trails').click();await page.waitForFunction(()=>!document.querySelector('[aria-label=Play]').disabled);
  await button('Player settings').click();await button('Transpose / tuning').click();await page.getByLabel('Pitch or tuning').selectOption('tuning');await button('STANDARD').click();await page.getByLabel('Tuning preset').selectOption('guitar-6-Standard--1');await button('Apply notation edit').click();await page.getByRole('dialog').waitFor({state:'detached'});
  await button('Your library').click();await button('All songs').click();await button('Guitars').click();await button('Open Auto ESP collection').click();await button('Open E standard collection').click();assert.equal(await page.locator('.song-card').count(),0);
  await button('Edit guitar Auto ESP').click();await button('Add tuning').click();await button('STANDARD').click();await page.getByLabel('Tuning preset').selectOption('guitar-6-Standard--1');await button('Use this tuning').click();await button('Save guitar').click();
  await page.getByRole('button',{name:/Auto ESP tunings/}).click();await button('Open E♭ standard collection').click();await button('Open Paper Trails').waitFor();
  await button('Edit Paper Trails details').click();assert(await page.getByRole('checkbox',{name:'Auto ESP',exact:true}).isChecked());assert(await page.getByRole('checkbox',{name:'Auto ESP',exact:true}).isDisabled());await button('Cancel').click();
  assert(!(await stored()).find(s=>s.title==='Paper Trails').guitars.includes('Auto ESP'));
  console.log('PASS: automatic guitar matching follows existing songs, retuning and profile changes; difficulty saves, filters, keyboard input, sortable columns and independent layouts persist.');
  await button('All songs').click();await button('Open Afterglow').click();await button('Select bar 24').waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-label=Play]').disabled);
  await button('Edit Intro').click();await page.getByLabel('Learning status').selectOption('mastered');await button('Save section').click();
  await button('Loop selected bars').click();await button('Player settings').click();await page.screenshot({path:'test-results/v8-player-settings.png'});await button('Player settings').click();
  await button('Edit Verse').click();await page.screenshot({path:'test-results/v8-player-sections.png'});await button('Cancel section edit').click();await button('Song map').click();await page.screenshot({path:'test-results/v8-song-map.png'});await button('Close dialog').click();
  await button('Your library').click();await button('Sort by progress').click();assert.equal((await order())[0],'Afterglow');await button('Sort by progress').click();assert.equal((await order()).at(-1),'Afterglow');
  await button('Add songs').click();const importer=page.getByRole('dialog',{name:'Add songs'});assert(!/via songsterr|Uses the song title|Files are copied|Find album covers/i.test(await importer.innerText()));await page.getByRole('note',{name:/Compatible formats/}).hover();await page.getByRole('tooltip').waitFor({state:'visible'});await page.waitForTimeout(220);assert.match(await page.locator('.import-drop').innerText(),/30 MB/);await page.screenshot({path:'test-results/v8-import.png'});
  if(desktop){
    await browser.evaluate(async({net,session,app},bytes)=>{
      const original=net.fetch.bind(net);net.fetch=async(url,options)=>url==='https://www.songsterr-downloader.com/api/download/byRevisionJson'?new Response('Provider browser check',{status:403}):original(url,options);
      // A local fixture of the provider's ordinary form, never a live challenge.
      const html=`<!doctype html><meta charset="utf-8"><form action="?/getMetadataFromTabUrl" onsubmit="event.preventDefault();document.getElementById('gp').hidden=false"><input id="songsterr-url" oninput="document.getElementById('submit').disabled=false"><button id="submit" disabled>Download</button></form><button id="gp" hidden onclick="const a=document.createElement('a');a.href=window.URL.createObjectURL(new Blob([new Uint8Array(${JSON.stringify(bytes)})],{type:'application/gp'}));a.download='One-click.gp';a.click()">Download Guitar Pro</button>`;
      await session.fromPartition('songsterr-import').protocol.handle('https',()=>new Response(html,{headers:{'Content-Type':'text/html'}}));
    },bytes);
  }else await page.evaluate(bytes=>{window.guitarIO={downloadSongsterr:async()=>({name:'One-click.gp',bytes:new Uint8Array(bytes)})};},bytes);
  await page.getByLabel('Songsterr song link').fill('https://www.songsterr.com/a/wsa/one-click-study-tab-s123');await button('Import').click();
  await page.getByRole('dialog',{name:'Review import'}).waitFor({timeout:15000});if(desktop)assert.equal(browser.windows().length,1);
  assert.equal((await stored()).length,3);await page.getByRole('radiogroup',{name:'Difficulty',exact:true}).getByRole('radio',{name:'5 stars',exact:true}).click();await button('Import 1 song').click();await button('Open One click study').waitFor();await waitRating('One click study',5);
  await button('Backups').click();
  if(desktop){
    await browser.evaluate(({session},target)=>{globalThis.__backupState=null;session.defaultSession.once('will-download',(_event,item)=>{item.setSavePath(target);item.once('done',(_event,state)=>{globalThis.__backupState=state;});});},path.resolve('test-results/v8-backup.json'));
    await button('Export').click();
    for(let i=0;i<100 && await browser.evaluate(()=>globalThis.__backupState)===null;i++)await new Promise(r=>setTimeout(r,50));
    assert.equal(await browser.evaluate(()=>globalThis.__backupState),'completed');
  }else{const pending=page.waitForEvent('download');await button('Export').click();await (await pending).saveAs('test-results/v8-backup.json');}
  const backup=JSON.parse(fs.readFileSync('test-results/v8-backup.json','utf8'));assert.equal(backup.songs.find(s=>s.title==='One click study').difficulty,5);
  await page.locator('#restore-file').setInputFiles('test-results/v8-backup.json');await button('Restore & replace matches').click();await button('Close dialog').click();await button('Open One click study').waitFor();await waitRating('One click study',5);
  assert.deepEqual(errors,[]);console.log('PASS: refreshed player sections/map/settings, minimal importer with formats tooltip, single-click native browser fallback and GP capture, review, difficulty backup/restore.');
}catch(e){if(desktop){for(const [i,w] of browser.windows().entries()){console.error('Window',i,w.url(),await w.locator('body').innerText().catch(()=>'<closed>'));if(i)await w.screenshot({path:`test-results/v8-provider-${i}.png`}).catch(()=>{});}}await page.screenshot({path:'test-results/v8-failure.png'});console.error('Errors:',errors);console.error((await page.locator('body').innerText()).slice(-2400));throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));}
