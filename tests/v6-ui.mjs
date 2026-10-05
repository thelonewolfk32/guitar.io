import { chromium, _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost'), file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mjs': 'text/javascript', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
fs.mkdirSync('test-results', { recursive: true });
const desktop = process.argv.includes('--desktop');
const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const browser = desktop ? await electron.launch({ executablePath: path.resolve(`../../Guitar-io-${version}-Windows-x64/Guitar.io.exe`), env: { ...process.env, GUITARIO_TEST_PROFILE: fs.mkdtempSync(path.resolve('test-results/desktop-editing-')) } }) : await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = desktop ? await browser.firstWindow() : await browser.newPage({ viewport: { width: 1512, height: 960 } });
await page.addInitScript(() => localStorage.setItem('guitario-auto-artwork', 'off'));
const errors = []; page.on('pageerror', e => errors.push(e.message));
const button = name => page.getByRole('button', { name, exact: true });
async function stored(title) {
  return page.evaluate(async title => {
    const db = await new Promise(resolve => { const r = indexedDB.open('guitar-io-v1'); r.onsuccess = () => resolve(r.result); });
    return new Promise(resolve => { const r = db.transaction('songs').objectStore('songs').getAll(); r.onsuccess = () => { db.close(); resolve(r.result.find(s => s.title === title)); }; });
  }, title);
}
try {
  await page.goto(desktop ? 'guitario://app/' : `http://127.0.0.1:${server.address().port}/`);
  await button('Open Afterglow').waitFor();
  await page.evaluate(() => {
    const Native = window.alphaTab.AlphaTabApi;
    window.alphaTab.AlphaTabApi = new Proxy(Native, { construct(Target, args) { const api = new Target(...args); window.__testApi = api; return api; } });
    window.__preview = { peak: 0, programs: [] };
    const output = window.alphaTab.synth.AlphaSynthAudioWorkletOutput.prototype, samples = output.addSamples;
    output.addSamples = function(buffer) { for (const sample of buffer) window.__preview.peak = Math.max(window.__preview.peak, Math.abs(sample)); return samples.call(this,buffer); };
    const synth = window.alphaTab.synth.AlphaSynth.prototype, load = synth.loadMidiFile;
    synth.loadMidiFile = function(midi) { window.__previewSynth = this; window.__preview.programs.push(...midi.tracks.flatMap(t => t.events.filter(e => e.type === 192).map(e => e.program))); return load.call(this,midi); };

  });
  await button('Create folder').click();
  assert.equal(await page.locator('.folder-palette button').count(), 10);
  assert.equal(await page.locator('input[type=color]').count(), 0);
  await button('Ocean').click();
  await page.getByRole('textbox', {name:'Folder name'}).fill('Set list');
  await button('Save folder').click();
  await button('Edit Afterglow details').click();
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 300; const ctx = c.getContext('2d'); const gradient = ctx.createLinearGradient(0,0,300,300); gradient.addColorStop(0,'#152934'); gradient.addColorStop(1,'#59aab5'); ctx.fillStyle = gradient; ctx.fillRect(0,0,300,300); ctx.fillStyle = '#dfe9ce'; ctx.font = '26px sans-serif'; ctx.fillText('AFTERGLOW',45,165); return c.toDataURL().split(',')[1]; });
  await page.getByLabel('Song artwork',{exact:true}).setInputFiles({name:'cover.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.getByRole('checkbox',{name:'6-string acoustic',exact:true}).check();
  assert.equal(await page.getByRole('textbox',{name:'Your guitars',exact:true}).count(),0);
  await page.getByRole('combobox',{name:'Tuning label',exact:true}).selectOption('DADGAD');
  await button('Save changes').click();
  await page.getByRole('dialog').waitFor({state:'detached'});
  const card = page.locator('.song-card').filter({has:button('Open Afterglow')});
  assert.equal(await card.locator('img').getAttribute('draggable'),'false');
  await card.locator('.card-art').dragTo(page.locator('.folder-row-wrap').filter({hasText:'Set list'}));
  await page.getByText('Moved Afterglow to Set list.',{exact:true}).waitFor();
  assert((await stored('Afterglow')).folderId);
  await card.locator('.card-art').dragTo(page.getByRole('button',{name:/^Unfiled/}));
  await page.getByText('Moved Afterglow to Unfiled.',{exact:true}).waitFor();
  assert.equal((await stored('Afterglow')).folderId,'');
  await card.hover(); await page.screenshot({path:'test-results/v6-library.png'});
  console.log('PASS: ten named colour swatches, guitar checkboxes, tuning labels, artwork drag-to-folder and Unfiled persist.');

  await button('Guitars').click();
  const collection = page.locator('.collection-card').filter({has:button('Edit guitar 6-string electric')});
  const pencil = await collection.locator('.guitar-profile-edit').boundingBox(), camera = await collection.locator('.collection-camera').boundingBox();
  assert(pencil.x+pencil.width <= camera.x || camera.x+camera.width <= pencil.x, 'Photo and pencil controls must not overlap');
  await button('Add guitar').click();
  await page.getByRole('textbox',{name:'Guitar name',exact:true}).fill('Studio acoustic');
  await button('Add tuning').click();
  assert.equal(await page.getByRole('combobox',{name:'Tuning preset'}).count(),0);
  for (const name of ['DROP','OPEN','STANDARD','CUSTOM']) await button(name).waitFor();
  await button('STANDARD').click();
  await button('Hear string 6').click();
  await page.waitForFunction(() => window.__preview.peak > 0.001 && window.__preview.programs.at(-1) === 25, null, {timeout:8000});
  await button('Use this tuning').click(); await button('Save guitar').click();
  await button('Open Studio acoustic collection').click();
  assert.equal(await page.locator('.tuning-category-card').count(),0);
  assert.equal(await page.locator('.collection-card').count(),1);
  await button('Open E standard collection').waitFor();
  console.log('PASS: guitar camera/pencil do not overlap, tuning submenus collapse, acoustic soundfont preview produces audio.');

  await page.getByRole('button',{name:/^All songs/}).click();
  const score = alphaTab.importer.ScoreLoader.loadAlphaTex('\\title "Selection study" \\instrument 27 . (0.6 0.3 0.1).4 (2.6 2.3 2.1).4 3.2.2 | (4.6 4.3 4.1).1');
  await page.locator('#import-files').setInputFiles({name:'selection.gp',mimeType:'application/octet-stream',buffer:Buffer.from(new alphaTab.exporter.Gp7Exporter().export(score))});
  await page.getByRole('dialog', { name: 'Review import' }).waitFor(); await page.getByRole('button', { name: /^Import [0-9]+ songs?$/ }).click();
  await button('Open Selection study').click();
  await page.waitForFunction(() => document.querySelectorAll('.note-hit').length === 10 && !document.querySelector('[aria-label=Play]').disabled);
  const notes = page.locator('.note-hit');
  const first = await notes.nth(0).boundingBox(), third = await notes.nth(2).boundingBox();
  assert(first.y < third.y, 'Chord hit targets follow top-to-bottom order');
  await notes.nth(0).click(); await notes.nth(2).click({modifiers:['Shift']});
  assert.equal(await page.locator('.note-hit.selected').count(),3);
  await notes.nth(1).click({modifiers:['Control']});
  assert.equal(await page.locator('.note-hit.selected').count(),2);
  // Draw from blank sheet space across two chords, ending before the half note.
  const last = await notes.nth(5).boundingBox();
  await page.mouse.move(first.x-6,first.y-5); await page.mouse.down();
  await page.mouse.move(last.x+last.width+4,last.y+last.height+4,{steps:10}); await page.mouse.up();
  assert.equal(await page.locator('.note-hit.selected').count(),6);
  await page.evaluate(() => { window.__preview.peak = 0; });
  await page.keyboard.press('8');
  await page.waitForFunction(() => [...document.querySelectorAll('.note-hit')].slice(0,6).every(n => n.getAttribute('aria-label').includes('fret 8')));
  await page.waitForFunction(() => window.__preview.programs.at(-1) === 27 && window.__preview.peak > 0.001);
  assert.equal(Object.keys((await stored('Selection study')).noteEdits).length,6);
  const from = await notes.nth(0).boundingBox(), to = await notes.nth(5).boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2); await page.mouse.down(); await page.mouse.move(to.x+to.width,to.y+to.height,{steps:8}); await page.mouse.up();
  assert.equal(await page.locator('.note-hit.selected').count(),6, 'Drag starting on a note includes that note');
  await notes.nth(0).click(); await notes.nth(9).click({modifiers:['Shift']});
  assert.equal(await page.locator('.note-hit.selected').count(),10);
  await button('Loop selected bars').click();
  assert.equal(await page.getByRole('spinbutton',{name:'Loop start bar'}).inputValue(),'1');
  assert.equal(await page.getByRole('spinbutton',{name:'Loop end bar'}).inputValue(),'2');
  await page.screenshot({path:'test-results/v6-note-selection.png'});
  await button('Your library').click(); await button('Open Afterglow').click();
  await button('Select bar 24').waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-label=Play]').disabled);
  await button('Select bar 7').click({position:{x:8,y:10}});
  await page.waitForFunction(() => document.querySelector('.section-card[aria-current=true]')?.textContent.includes('Verse'));
  await page.waitForTimeout(250); await page.mouse.move(10,10); await page.screenshot({path:'test-results/v6-player.png'});
  await page.setViewportSize({width:1100,height:760});
  await page.waitForTimeout(600); await button('Select bar 24').waitFor(); await page.screenshot({path:'test-results/v6-small-window.png'});
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  assert.deepEqual(errors,[]);
  console.log('PASS: chord Shift-selection, Ctrl-toggle, marquee from blank sheet, six-note fret edit with assigned GP sound, multibar loop and current-section highlight. No page errors.');
} catch(error) { await page.screenshot({path:'test-results/v6-failure.png'}); console.error('Page errors:',errors); console.error('Preview:',await page.evaluate(() => { const s=window.__previewSynth; return {...window.__preview,state:s?.state,ready:s?.isReadyForPlayback,context:s?.output.context?.state,worklet:!!s?.output._worklet,frames:s?._notPlayedSamples,presets:s?.synthesizer.presets?.length,events:s?.sequencer?.instrumentPrograms && [...s.sequencer.instrumentPrograms]}; })); console.error((await page.locator('body').innerText()).slice(-2200)); throw error; }
finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
