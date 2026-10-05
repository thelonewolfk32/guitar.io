import test from 'node:test';
import assert from 'node:assert/strict';
import * as alphaTab from '@coderline/alphatab';
import { demoSources } from '../src/demos.ts';

test('notation layouts expose selectable bounds for every bar in all display modes', async () => {
  for (const width of [530, 730]) {
    for (const staveProfile of [alphaTab.StaveProfile.Tab, alphaTab.StaveProfile.ScoreTab, alphaTab.StaveProfile.Score]) {
      const settings = new alphaTab.Settings();
      settings.core.engine = 'svg';
      settings.display.staveProfile = staveProfile;
      settings.display.scale = 0.95;
      settings.display.barsPerRow = -1;
      settings.display.systemsLayoutMode = alphaTab.SystemsLayoutMode.Automatic;
      settings.display.stretchForce = 1.25;
      settings.display.padding = [28, 44, 28, 36];
      const renderer = new alphaTab.rendering.ScoreRenderer(settings);
      renderer.width = width;
      const score = alphaTab.importer.ScoreLoader.loadAlphaTex(new TextDecoder().decode(demoSources()[0].source));
      let svgChunks = 0;
      renderer.partialLayoutFinished.on(e => renderer.renderResult(e.id));
      renderer.partialRenderFinished.on(e => { assert.match(String(e.renderResult), /<svg/); svgChunks++; });
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Render timeout')), 3000);
        renderer.error.on(reject);
        renderer.renderFinished.on(() => { clearTimeout(timeout); resolve(); });
        renderer.renderScore(score, [0]);
      });
      assert.ok(svgChunks > 0);
      for (let i = 0; i < 24; i++) {
        const box = renderer.boundsLookup.findMasterBarByIndex(i);
        assert.ok(box, `bar ${i + 1} at ${width}px / profile ${staveProfile}`);
        assert.ok(box.lineAlignedBounds.w > 0); assert.ok(box.lineAlignedBounds.h > 0);
        assert.ok(Number.isFinite(box.lineAlignedBounds.x)); assert.ok(Number.isFinite(box.lineAlignedBounds.y));
      }
      renderer.destroy();
    }
  }
});

test('115-bar dense scores use content-aware widths instead of forcing four crowded bars per row', async () => {
  const dense = Array(16).fill('(10.6 12.5 12.4).16').join(' ');
  const source = '\\title "Dense layout study" \\tempo 86 . ' + Array.from({ length: 115 }, (_, i) => i % 3 ? dense : '0.6.1').join(' | ');
  async function layout(barsPerRow) {
    const settings = new alphaTab.Settings(); settings.core.engine = 'svg'; settings.display.staveProfile = alphaTab.StaveProfile.Tab;
    settings.display.scale = .95; settings.display.barsPerRow = barsPerRow; settings.display.stretchForce = 1.25;
    settings.display.systemsLayoutMode = alphaTab.SystemsLayoutMode.Automatic; settings.display.padding = [28, 44, 28, 36];
    const renderer = new alphaTab.rendering.ScoreRenderer(settings); renderer.width = 700;
    const score = alphaTab.importer.ScoreLoader.loadAlphaTex(source);
    await new Promise((resolve, reject) => { renderer.error.on(reject); renderer.renderFinished.on(resolve); renderer.renderScore(score, [0]); });
    const bounds = Array.from({ length: 115 }, (_, i) => renderer.boundsLookup.findMasterBarByIndex(i).lineAlignedBounds);
    renderer.destroy(); return bounds;
  }
  const natural = await layout(-1), forced = await layout(4);
  assert.equal(natural.length, 115);
  assert.ok(natural[1].w > forced[1].w * 1.5, 'dense measures receive substantially more horizontal space');
  for (const b of natural) { assert.ok(Number.isFinite(b.y) && b.h > 0 && b.w > 0); assert.ok(b.x + b.w <= 701, 'bars stay inside the score width'); }
});
