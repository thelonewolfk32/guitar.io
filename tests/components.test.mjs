/** DOM interaction checks with a fake audio/render host; real parsing and IndexedDB are used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import * as alphaTab from '@coderline/alphatab';
import React, { act } from 'react';

const win = new Window({ url: 'http://localhost:5173', settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });
Object.assign(globalThis, { window: win, document: win.document, HTMLElement: win.HTMLElement, HTMLInputElement: win.HTMLInputElement, HTMLSelectElement: win.HTMLSelectElement, Event: win.Event, MouseEvent: win.MouseEvent, indexedDB, IDBKeyRange, location: win.location, requestAnimationFrame: cb => setTimeout(() => cb(performance.now()), 20), cancelAnimationFrame: clearTimeout, IS_REACT_ACT_ENVIRONMENT: true });
class Emitter { handlers = new Set(); on(f) { this.handlers.add(f); } off(f) { this.handlers.delete(f); } emit(v) { for (const f of [...this.handlers]) f(v); } }
class TestHost {
  static instances = [];
  constructor(element, settings) {
    this.settings = settings; this.masterVolume = .75; this.playbackSpeed = 1; this.isReadyForPlayback = true;
    this.player = { state: alphaTab.synth.PlayerState.Paused };
    for (const e of ['renderStarted', 'postRenderFinished', 'playerReady', 'playerStateChanged', 'playedBeatChanged', 'playerPositionChanged', 'error']) this[e] = new Emitter();
    this.boundsLookup = { findMasterBarByIndex: n => ({ lineAlignedBounds: { x: n % 4 * 130, y: Math.floor(n / 4) * 150, w: 130, h: 80 }, realBounds: { y: Math.floor(n / 4) * 150 } }), findBeat: () => null };
    this._tick = 0; TestHost.instances.push(this);
  }
  renderScore(score) { this.renderScoreCalls = (this.renderScoreCalls || 0) + 1; this.score = score; const file = new alphaTab.midi.MidiFile(); const generator = new alphaTab.midi.MidiFileGenerator(score, this.settings, new alphaTab.midi.AlphaSynthMidiFileHandler(file)); generator.generate(); this.tickCache = generator.tickLookup; queueMicrotask(() => { this.postRenderFinished.emit(); this.playerReady.emit(); }); }
  renderTracks() { this.renderTracksCalls = (this.renderTracksCalls || 0) + 1; queueMicrotask(() => this.postRenderFinished.emit()); }
  render() { this.postRenderFinished.emit(); }
  updateSettings() {}
  get tickPosition() { return this._tick; }
  set tickPosition(v) { this._tick = v; this.playerPositionChanged.emit({ currentTick: v, modifiedTempo: 120 }); }
  pause() { this.player.state = alphaTab.synth.PlayerState.Paused; this.playerStateChanged.emit({ state: this.player.state }); }
  play() { this.player.state = alphaTab.synth.PlayerState.Playing; this.playerStateChanged.emit({ state: this.player.state }); }
  playPause() { this.player.state === alphaTab.synth.PlayerState.Playing ? this.pause() : this.play(); }
  destroy() { for (const e of ['renderStarted', 'postRenderFinished', 'playerReady', 'playerStateChanged', 'playedBeatChanged', 'playerPositionChanged', 'error']) this[e].handlers.clear(); }
}
win.alphaTab = { ...alphaTab, AlphaTabApi: TestHost };
const { createRoot } = await import('react-dom/client');
const { default: App } = await import('../src/App.tsx');
const { readLibrary,saveSongs } = await import('../src/storage.ts');
const { demoSources } = await import('../src/demos.ts');
const { makeSong } = await import('../src/notation.ts');
const { migrateSong } = await import('../src/library-model.ts');
const { sectionsFor } = await import('../src/library-model.ts');
const root = createRoot(document.body.appendChild(document.createElement('div')));
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
async function action(fn) { await act(async () => { fn(); await settle(); }); }
function button(name) { const result = [...document.querySelectorAll('button')].find(e => e.getAttribute('aria-label') === name || e.textContent.trim() === name); assert.ok(result, `button ${name}`); return result; }
async function click(name) {
  const editor=name==='Save section'?document.querySelector('.section-editor'):document.querySelector('[role="dialog"]');
  await action(() => button(name).click());
  if(editor&&['Save section','Save changes','Save folder'].includes(name)){
    // A committed IndexedDB write can precede React's onClose update on slower
    // runners. Sections have an inline editor, rather than a modal dialog.
    // Wait for the completed editor to close before toggling it open again.
    const deadline=performance.now()+5000;
    while(editor.isConnected&&performance.now()<deadline)await action(()=>{});
    assert(!editor.isConnected,`${name} must close its completed editor`);
  }
}
async function value(label, text) {
  const element = document.querySelector(`[aria-label="${label}"]`); assert.ok(element, label);
  await action(() => {
    const prototype = element.tagName === 'SELECT' ? win.HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, text);
    element.dispatchEvent(new win.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}

test('library home, folders, focused practice, progress, popup map and deletion work together', async () => {
  try {
    await saveSongs(await Promise.all(demoSources().map(async d=>migrateSong({...await makeSong(d.source,d.title+'.alphatex'),tuning:d.tuning,guitars:d.guitars,tags:d.tags,demo:true,sections:d.sections}))),true);
    await action(() => root.render(React.createElement(App)));
    for (let i = 0; i < 30 && !document.querySelector('.song-card') && !document.body.textContent.includes('Couldn’t open'); i++) await action(() => {});
    assert.equal(document.querySelectorAll('.song-card').length, 3, document.body.textContent);
    assert.equal(document.querySelector('.workspace'), null, 'home does not auto-open a player');
    await click('Create folder'); await value('Folder name', 'Current set'); await click('Save folder');
    assert.equal((await readLibrary()).folders[0].name, 'Current set');
    await click('Edit Afterglow details'); await action(() => document.querySelector('.guitar-choices input:not(:checked)').click());
    await value('Song folder', (await readLibrary()).folders[0].id); await click('Save changes');
    await click('Open Afterglow');
    for(let i=0;i<10 && document.querySelectorAll('.bar-overlay').length!==24;i++)await action(()=>{});
    assert.ok(document.querySelector('.workspace')); assert.equal(document.querySelector('.library-home'), null);
    assert.equal(document.querySelectorAll('.bar-overlay').length, 24);
    assert.equal(TestHost.instances.at(-1).settings.display.barsPerRow, -1);
    assert.equal(TestHost.instances.at(-1).renderScoreCalls, 1); assert.equal(TestHost.instances.at(-1).renderTracksCalls || 0, 0);
    const workspace = document.querySelector('.workspace');
    const scoreHost = TestHost.instances.at(-1);
    const hostCount = TestHost.instances.length;
    for (const closeAction of ['Close dialog', 'Cancel', 'Save changes', 'Close dialog']) {
      await click('Song details');
      await click(closeAction);
      assert.equal(document.querySelectorAll('.workspace').length, 1, 'Song details must not duplicate the workspace');
      assert.equal(document.querySelector('.workspace'), workspace, 'Song details must preserve the open workspace');
      assert.equal(TestHost.instances.length, hostCount, 'Song details must not create extra score/audio engines');
      assert.equal(TestHost.instances.at(-1), scoreHost);
    }
    await click('Edit Intro'); await value('Percentage learnt', '65'); await click('Save section');
    let saved = (await readLibrary()).songs.find(s => s.title === 'Afterglow');
    assert.equal(sectionsFor(saved).find(s => s.name === 'Intro').learnedPercent, 65);
    assert.match(document.querySelector('.section-list').textContent, /65%/);
    await click('Edit Intro'); await value('Percentage learnt', '95'); await click('Save section');
    assert.ok(document.querySelector('.section-list .status-mark.comfortable'));
    await click('Edit Intro'); await value('Percentage learnt', '100'); await click('Save section');
    assert.ok(document.querySelector('.section-list .status-mark.mastered'));
    const mapButton = button('Song map');
    await action(() => mapButton.click());
    assert.ok(document.querySelector('[role="dialog"][aria-label="Song map"]'));
    assert.equal(document.querySelectorAll('.map-section').length, sectionsFor(saved).length);
    await click('Close dialog');
    await click('Add recording'); assert.ok(document.querySelector('[aria-label="Add recording"][role="dialog"]'));
    await click('Close dialog'); assert.ok(document.querySelector('.integrated-player'));
    await click('Return to library');
    assert.equal(document.querySelectorAll('.workspace').length, 0, 'Leaving practice must remove every workspace');
    assert.equal(document.querySelectorAll('.song-card').length, 3);
    await click('Tunings');
    assert.equal(document.querySelectorAll('.collection-card').length, 3);
    await click('Open Drop D collection'); assert.equal(document.querySelectorAll('.song-card').length, 1);
    const all = [...document.querySelectorAll('.library-tabs button')].find(e => e.textContent.startsWith('All songs'));
    await action(() => all.click());
    await click('Delete Afterglow'); assert.ok(document.querySelector('[aria-label="Delete this song?"]'));
    await click('Keep song'); assert.equal((await readLibrary()).songs.length, 3);
    await click('Delete Afterglow'); await click('Delete song');
    // IndexedDB commits and the resulting React update may outlast one 20 ms turn.
    for (let i = 0; i < 100 && document.querySelectorAll('.song-card').length !== 2; i++) await action(() => {});
    assert.equal(document.querySelectorAll('.song-card').length, 2); assert.equal((await readLibrary()).songs.length, 2);
  } finally { await action(() => root.unmount()); await win.happyDOM.close(); }
});
