/** Runs the production app in a fresh browser profile; never opens the desktop library. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { checkSongDetails } from './song-details-check.mjs';

const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + (new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mjs': 'text/javascript', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
fs.mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1512, height: 960 } });
await context.addInitScript(() => {
  localStorage.setItem('guitario-auto-artwork', 'off');
  window.YT = { Player: function(host, options) {
    let state = 2, time = 0, rate = 1, volume = 75;
    const player = this;
    Object.assign(player, {
      getCurrentTime: () => time, getPlayerState: () => state, getPlaybackRate: () => rate,
      setPlaybackRate: value => { rate = value; }, getVolume: () => volume,
      setVolume: value => { volume = value; }, seekTo: value => { time = value; },
      playVideo: () => { state = 1; }, pauseVideo: () => { state = 2; },
      destroy: () => { for (const key of Object.keys(player)) delete player[key]; host.remove(); setTimeout(() => options.events.onPlaybackRateChange({ data: 0.5 }), 0); },
    });
    host.textContent = 'YouTube test player ' + options.videoId;
    setTimeout(() => options.events.onReady({ target: player }), 0);
  }};
});
const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const button = name => page.getByRole('button', { name, exact: true });
async function synthReady() { await page.waitForFunction(() => document.querySelector('[aria-label="Play"]')?.disabled === false); }
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await button('Open Afterglow').waitFor();
  assert.equal(await page.getByRole('combobox', { name: 'Sort library' }).count(), 0);
  await button('Filters & sort').click();
  await page.getByRole('combobox', { name: 'Filter tunings' }).selectOption('Drop D');
  assert.equal(await page.locator('.song-card').count(), 1);
  await button('Reset filters & sort').click();
  await button('Filters & sort').click();
  await button('Artists').click();
  assert.equal(await page.locator('.collection-card').count(), 1);
  await page.getByLabel('Artwork for Guitar.io Originals', { exact: true }).setInputFiles({ name: 'test-picture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
  await page.locator('.collection-card img').waitFor();
  await page.screenshot({ path: 'test-results/v3-artists.png' });
  await button('Open Guitar.io Originals collection').click();
  assert.equal(await page.locator('.song-card').count(), 3);
  await button('Tunings').click();
  assert.equal(await page.locator('.collection-card').count(), 3);
  await page.screenshot({ path: 'test-results/v3-tunings.png' });
  await button('Open Drop D collection').click();
  await button('Open Afterglow').click();
  await button('Select bar 24').waitFor();
  await checkSongDetails(page);
  await button('Select bar 3').click({ button: 'right', position:{x:8,y:12} });
  await page.getByRole('menuitem', { name: 'Split before bar 3', exact: true }).click();
  await button('Edit Intro (2)').waitFor();
  await button('Undo section change').click();
  await page.waitForFunction(() => document.querySelectorAll('.section-card').length === 4);
  await button('Select bar 3').click({ button: 'right', position:{x:8,y:12} });
  await page.screenshot({ path: 'test-results/v3-section-menu.png' });
  await page.getByRole('menuitem', { name: 'Merge into next section', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.section-card').length === 3);
  await button('Undo section change').click();
  await page.waitForFunction(() => document.querySelectorAll('.section-card').length === 4);
  await button('Add recording').click();
  await page.getByRole('textbox', { name: 'New recording name', exact: true }).fill('Original studio');
  await page.getByRole('textbox', { name: 'New recording tags', exact: true }).fill('Original, Studio');
  await page.getByRole('textbox', { name: 'YouTube video link' }).fill('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  await button('Attach & open').click();
  await page.getByText('YouTube test player M7lc1UVf-VE').waitFor();
  await synthReady();
  await button('Edit recording Original studio').click();
  await page.getByRole('spinbutton', { name: 'Recording start offset' }).fill('12.5');
  await button('Save recording').click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('tab',{name:'MIDI',exact:true}).click();
    await synthReady();
    await button('Play').click(); await button('Pause').waitFor(); await button('Pause').click();
    await page.getByRole('tab',{name:'Original studio',exact:true}).click();
    await page.getByText('YouTube test player M7lc1UVf-VE').waitFor(); await synthReady();
  }
  await button('Add recording').click();
  await page.getByRole('textbox', { name: 'New recording name', exact: true }).fill('Guitar removed');
  await page.getByRole('textbox', { name: 'New recording tags', exact: true }).fill('Backing track');
  await page.getByRole('textbox', { name: 'YouTube video link' }).fill('https://youtu.be/abcdefghijk');
  await button('Attach & open').click();
  await page.getByText('YouTube test player abcdefghijk').waitFor(); await synthReady();
  assert.equal(await page.getByRole('tab').count(),3);
  await button('Edit recording Guitar removed').click();
  await page.getByRole('spinbutton', { name: 'Recording start offset' }).fill('4');
  await button('Save recording').click();
  await page.getByRole('tab',{name:'Original studio',exact:true}).click();
  await button('Edit recording Original studio').click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Recording start offset"]')?.value === '12.5');
  await button('Close dialog').click();
  await page.getByRole('tab',{name:'Guitar removed',exact:true}).click();
  await button('Edit recording Guitar removed').click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Recording start offset"]')?.value === '4');
  await page.screenshot({ path: 'test-results/v3-recordings.png' });
  await button('Close dialog').click();
  await page.getByRole('tab',{name:'MIDI',exact:true}).click(); await synthReady();
  await page.getByRole('tab',{name:'Guitar removed',exact:true}).click();
  await synthReady();
  await button('Your library').click();
  assert.equal(await page.locator('.workspace').count(), 0, 'Returning to the library must remove the workspace');
  await button('Backups').click();
  const backupDownload = page.waitForEvent('download');
  await button('Export').click();
  await (await backupDownload).saveAs('test-results/v3-library-backup.json');
  const before = JSON.parse(fs.readFileSync('test-results/v3-library-backup.json', 'utf8'));
  await page.locator('#restore-file').setInputFiles('test-results/v3-library-backup.json');
  await button('Restore & replace matches').click();
  await page.getByText('3 songs restored.', { exact: true }).waitFor();
  const restoredDownload = page.waitForEvent('download');
  await button('Export').click();
  await (await restoredDownload).saveAs('test-results/v3-library-restored.json');
  const after = JSON.parse(fs.readFileSync('test-results/v3-library-restored.json', 'utf8'));
  const originalSong = before.songs.find(s => s.title === 'Afterglow');
  const restoredSong = after.songs.find(s => s.title === 'Afterglow');
  assert.deepEqual(restoredSong.media.recordings, originalSong.media.recordings);
  assert.notEqual(restoredSong.collectionArt['Artists:Guitar.io Originals'], originalSong.collectionArt['Artists:Guitar.io Originals']);
  assert(after.assets.some(a => a.id === restoredSong.collectionArt['Artists:Guitar.io Originals']));
  await button('Close dialog').click();
  await button('Artists').click();
  await page.locator('.collection-card img').waitFor();
  await page.getByRole('button', { name: /^All songs/ }).click();
  await page.reload();
  await button('Open Afterglow').click();
  const options = await page.getByRole('tab').allTextContents();
  assert(options.some(t => t.includes('Guitar removed')));
  assert(options.some(t => t.includes('Original studio')));
  assert.match(await page.getByRole('tab',{name:'Guitar removed',exact:true}).getAttribute('title'), /Backing track/);
  await page.getByRole('tab',{name:'Guitar removed',exact:true}).click();
  await button('Edit recording Guitar removed').click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Recording start offset"]')?.value === '4');
  await synthReady();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await button('Remove recording').click();
  await synthReady();
  assert.equal(await page.getByRole('tab').count(), 2);
  await button('Your library').click();
  await page.setViewportSize({ width: 1100, height: 760 });
  await button('Tunings').click();
  await page.screenshot({ path: 'test-results/v3-small-window.png' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  if (process.argv.includes('--live-artwork')) {
    const network = [];
    page.on('requestfailed', request => network.push({ failed: request.url(), error: request.failure()?.errorText }));
    page.on('response', response => { if (/musicbrainz|wikipedia|coverartarchive|wikimedia|archive\.org/.test(response.url())) network.push({ url: response.url(), status: response.status() }); });
    await button('Add songs').click();
    await page.getByLabel('Import options').click(); await page.getByRole('checkbox', { name: 'Automatic artwork' }).check();
    await page.locator('#import-files').setInputFiles({ name: 'artwork-check.alphatex', mimeType: 'text/plain', buffer: Buffer.from('\\title ".44 Caliber Love Letter" \\artist "Alexisonfire" . 0.6.1') });
  await page.getByRole('dialog', { name: 'Review import' }).waitFor(); await page.getByRole('button', { name: /^Import [0-9]+ songs?$/ }).click();
    await button('Open .44 Caliber Love Letter').waitFor({ timeout: 45000 });
    console.log('Live artwork network:', JSON.stringify(network));
    await button('Artists').click();
    await button('Open Alexisonfire collection').waitFor();
    await page.screenshot({ path: 'test-results/v3-live-artwork.png' });
    assert(await page.locator('.collection-card').filter({ hasText: 'Alexisonfire' }).locator('img').count(), 'Expected a downloaded artist picture or album cover');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: collections, optional filters, section menu/undo, repeated YouTube/MIDI switching, two tagged recordings, independent offsets, backup/restore with image remapping, reload, removal, and 1100px layout. No page errors.');
} catch (error) {
  await page.screenshot({ path: 'test-results/v3-failure.png' });
  console.error('Page errors:', errors);
  console.error((await page.locator('body').innerText()).slice(-4500));
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
