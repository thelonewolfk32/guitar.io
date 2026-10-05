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
const browser=desktop?await electron.launch({executablePath:path.resolve(process.env.GUITARIO_OUTPUT_DIR || 'release/artifacts',`Guitar-io-${version}-Windows-x64/Guitar.io.exe`),env:{...process.env,GUITARIO_TEST_PROFILE:fs.mkdtempSync(path.resolve('test-results/desktop-v7-'))}}):await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=desktop?await browser.firstWindow():await browser.newPage({viewport:{width:1512,height:960}});
await page.addInitScript(()=>localStorage.setItem('guitario-auto-artwork','off'));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const button=name=>page.getByRole('button',{name,exact:true});
async function stored(){return page.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('guitar-io-v1');q.onsuccess=()=>r(q.result);});return new Promise(r=>{const q=db.transaction('songs').objectStore('songs').getAll();q.onsuccess=()=>{db.close();r(q.result);};});});}
const fixture=alphaTab.importer.ScoreLoader.loadAlphaTex('\\title "Learn study" \\artist "Test artist" . 0.6.4 2.6.4 3.6.4 5.6.4 | 7.6.4 8.6.4 10.6.4 12.6.4');
const bytes=Array.from(new alphaTab.exporter.Gp7Exporter().export(fixture));
let learn;
try{
  await page.goto(desktop?'guitario://app/':`http://127.0.0.1:${server.address().port}/`);await button('Open Afterglow').waitFor();
  assert.equal(await page.locator('.app-header').getByRole('button',{name:'Backups'}).count(),0);
  assert.equal(await page.locator('.app-header').getByRole('button',{name:'Import tabs'}).count(),0);
  assert.equal(await page.locator('.library-tabs .nav-count').count(),0);
  await button('Small cards').click(); assert.equal(await page.locator('.library-home').getAttribute('data-library-view'),'compact');
  assert.equal(await page.locator('.card-tuning').first().isVisible(),false);await page.screenshot({path:'test-results/v7-compact.png'});
  await button('List view').click();assert.equal(await page.locator('.song-list-heading').innerText(),'Artwork\nName\nArtist\nAlbum\nTuning\nDifficulty\nProgress');
  const first=page.locator('.song-card').first(); const box=await first.boundingBox(); assert(box.height<120);
  assert(await first.locator('.card-tuning').isVisible());assert(await first.locator('.progress-rail').isVisible());
  await page.screenshot({path:'test-results/v7-list.png'});await page.reload();await button('Open Afterglow').waitFor();assert.equal(await button('List view').getAttribute('aria-pressed'),'true');
  await button('Large cards').click();await button('Artists').click();const artists=page.locator('.collection-card');
  assert.equal(await artists.first().locator('.collection-stats span').count(),3);assert.equal(await artists.first().locator('.distribution-rail i').count(),3);
  await page.screenshot({path:'test-results/v7-artists.png'});await button('Guitars').click();assert.equal(await button('Open Unassigned collection').count(),0);
  await button('Add guitar').click();await page.getByLabel('Guitar name',{exact:true}).fill('Empty ESP');
  await page.getByLabel('Guitar photo',{exact:true}).setInputFiles({name:'guitar.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')});
  await button('Add tuning').click();await button('DROP').click();await page.getByLabel('Tuning preset',{exact:true}).selectOption('guitar-6-Drop--3');await button('Use this tuning').click();await button('Save guitar').click();
  const guitar=page.locator('.collection-card').filter({has:button('Open Empty ESP collection')});await guitar.locator('img').waitFor();
  await page.reload();await button('Guitars').click();await guitar.locator('img').waitFor();await button('Open Empty ESP collection').click();
  assert.equal(await page.locator('.collection-card').count(),1);await button('Open Drop B collection').waitFor();assert.equal(await button('DROP').count(),0);
  console.log('PASS: persistent card/compact/list layouts, distribution summaries, direct assigned tunings and photos on empty guitar profiles.');
  await button('All songs').click();await button('Add songs').hover();
  const gradient=await button('Add songs').evaluate(async el=>{const values=[];for(let n=0;n<15;n++){values.push(getComputedStyle(el).backgroundImage);await new Promise(requestAnimationFrame);}return values;});assert(gradient.every(g=>g.includes('linear-gradient')));
  await page.locator('#import-files').setInputFiles({name:'cancel.gp',mimeType:'application/octet-stream',buffer:Buffer.from(bytes)});
  await page.getByRole('dialog',{name:'Review import'}).waitFor();assert.equal((await stored()).length,3);await button('Cancel import').click();assert.equal((await stored()).length,3);
  // Exercise the real native bridge in desktop mode, with a controlled provider response.
  if(desktop) await browser.evaluate(({net},bytes)=>{const original=net.fetch.bind(net);net.fetch=async(url,options)=>{if(url==='https://www.songsterr-downloader.com/api/download/byRevisionJson'){globalThis.__downloadBody=JSON.parse(options.body);return new Response(new Uint8Array(bytes),{headers:{'content-type':'application/gp','content-disposition':'attachment; filename="Learn-study.gp"'}});}return original(url,options);};},bytes);
  else await page.evaluate(bytes=>{window.guitarIO={downloadSongsterr:async()=>({name:'Learn-study.gp',bytes:new Uint8Array(bytes)})};},bytes);
  await button('Add songs').click();await page.getByLabel('Songsterr song link').fill('https://www.songsterr.com/a/wsa/learn-study-tab-s123');await button('Import').click();
  await page.getByRole('dialog',{name:'Review import'}).waitFor();assert.equal((await stored()).length,3);
  await page.getByLabel('Import artist').fill('Reviewed artist');await button('Import 1 song').click();await button('Open Learn study').waitFor();
  assert.equal((await stored()).find(s=>s.title==='Learn study').artist,'Reviewed artist');
  if(desktop)assert.deepEqual(await browser.evaluate(()=>globalThis.__downloadBody),{byLinkUrl:'https://www.songsterr.com/a/wsa/learn-study-tab-s123'});
  const imported=page.locator('.song-card').filter({has:button('Open Learn study')});assert.equal(await imported.getByLabel('Guitar Pro file').count(),1);assert.equal(await imported.getByLabel('MIDI playback').count(),1);
  await imported.locator('.card-body').click({position:{x:15,y:64}});await button('Select bar 2').waitFor();
  await page.waitForFunction(()=>!document.querySelector('[aria-label=Play]').disabled);await button('Play').click();
  const newWindow=desktop?browser.waitForEvent('window'):page.waitForEvent('popup');await button('Learn').click();learn=await newWindow;learn.on('pageerror',e=>errors.push(e.message));
  await learn.getByRole('heading',{name:'Scales & modes'}).waitFor();await learn.locator('.learn-analysis strong').waitFor();
  assert.match(await learn.locator('.learn-analysis strong').innerText(),/E Aeolian/);assert.equal(await learn.locator('.fret-string').count(),6);assert.equal(await page.locator('.workspace').count(),1);
  await learn.getByLabel('Scale root',{exact:true}).selectOption('4');await learn.getByRole('button',{name:/^Dorian/}).click();
  await learn.getByLabel('Intervals',{exact:true}).check();const note=learn.getByRole('button',{name:'String 6, fret 0, E2, degree 1',exact:true});await note.waitFor();
  await learn.evaluate(()=>{window.__peak=0;const p=window.alphaTab.synth.AlphaSynthAudioWorkletOutput.prototype,original=p.addSamples;p.addSamples=function(samples){for(const n of samples)window.__peak=Math.max(window.__peak,Math.abs(n));return original.call(this,samples);};});
  await note.click();await learn.waitForFunction(()=>window.__peak>.001,null,{timeout:10000});
  await learn.getByRole('checkbox',{name:'Only notes in the song'}).check();assert.equal(await learn.locator('.fret-note').count(),await learn.locator('.fret-note.used-note').count());
  await learn.locator('.learn-positions button').nth(1).click();assert(await learn.locator('.fret-note small').count());await learn.waitForTimeout(250);await learn.screenshot({path:'test-results/v7-learn-song.png'});
  await learn.getByLabel('Learn song',{exact:true}).selectOption('');await learn.getByLabel('Library instrument').selectOption('8');assert.equal(await learn.locator('.fret-string').count(),8);
  await learn.getByLabel('Learn tuning').selectOption('guitar-8-Drop-0');assert.match(await learn.locator('.fret-string-name').last().innerText(),/E1/);
  await learn.getByLabel('Library instrument').selectOption('bass');assert.equal(await learn.locator('.fret-string').count(),4);
  await learn.getByLabel('Library instrument').selectOption('6');await learn.getByLabel('Selected scale').selectOption('minor-pentatonic');assert.equal(await learn.getByRole('button',{name:/^Minor pentatonic/}).getAttribute('aria-pressed'),'true');await learn.screenshot({path:'test-results/v7-learn-library.png'});
  await learn.setViewportSize({width:900,height:700});assert(await learn.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await learn.screenshot({path:'test-results/v7-learn-small.png'});
  if(desktop){await page.bringToFront();await button('Learn').click();await learn.waitForFunction(()=>document.querySelector('.learn-analysis strong')?.textContent.includes('E Aeolian'));assert.equal(browser.windows().length,2);}
  await learn.close();learn=undefined;await page.bringToFront();if(await button('Pause').isVisible())await button('Pause').click();await button('Your library').click();
  const emptyWindow=desktop?browser.waitForEvent('window'):page.waitForEvent('popup');await button('Learn').click();learn=await emptyWindow;await learn.getByLabel('Library instrument').waitFor();await learn.close();learn=undefined;
  assert.deepEqual(errors,[]);
  console.log('PASS: hover gradient, cancel/review/save import, GP/MIDI icons, native or simulated Songsterr response, separate Learn window, edited mode highlights, audible note preview, hand positions, 6/8-string and bass library.');
}catch(e){await page.screenshot({path:'test-results/v7-failure.png'});if(learn&&!learn.isClosed())await learn.screenshot({path:'test-results/v7-learn-failure.png'});console.error('Errors:',errors);console.error((await page.locator('body').innerText()).slice(-1600));throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));}
