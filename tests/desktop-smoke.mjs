/** Smoke-test the packaged app in an isolated profile, never the real library. */
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { checkSongDetails } from './song-details-check.mjs';

const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
const executablePath = path.resolve(`../../Guitar-io-${version}-Windows-x64/Guitar.io.exe`);
const profile = await fs.mkdtemp(path.resolve('test-results/desktop-profile-'));
const app = await electron.launch({ executablePath, env: { ...process.env, GUITARIO_TEST_PROFILE: profile } });
try {
  const details = await app.evaluate(({ app }) => ({ name: app.getName(), version: app.getVersion(), profile: app.getPath('userData'), appData: app.getPath('appData') }));
  details.normalProfile = path.join(details.appData, details.name);
  assert.equal(details.name, 'Guitar.io');
  assert.equal(details.version, version);
  assert.equal(details.profile, profile);
  assert.notEqual(details.profile, details.normalProfile);
  const page = await app.firstWindow();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('button', { name: 'Open Afterglow', exact: true }).waitFor();
  assert.equal(page.url(), 'guitario://app/');
  assert.equal(await page.locator('.song-card').count(), 3);
  await page.getByRole('button', { name: 'Open Afterglow', exact: true }).click();
  await page.getByRole('button', { name: 'Select bar 24', exact: true }).waitFor();
  await checkSongDetails(page);
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Play"]').disabled);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.screenshot({ path: 'test-results/v3-desktop.png' });
  assert.deepEqual(errors, []);
  console.log(`PASS: packaged v${version} Windows app launches, preserves one score through Song details cycles and starts/stops synth without page errors. Isolated profile:`, details.profile, 'Normal profile:', details.normalProfile);
} finally { await app.close(); }
