import assert from 'node:assert/strict';

/** Exercise every dismissal path while a score is open, including real saves. */
export async function checkSongDetails(page) {
  const button = name => page.getByRole('button', { name, exact: true });
  await page.waitForFunction(()=>!document.querySelector('[aria-label=Play]')?.disabled && !document.querySelector('.loading-score'));
  await button('Select bar 7').click({position:{x:8,y:10}});
  await page.getByLabel('Playback speed',{exact:true}).fill('75');await page.getByLabel('Playback speed',{exact:true}).press('Enter');
  const workspace = await page.locator('.workspace').elementHandle();
  const score = await page.locator('.alpha-score').elementHandle();
  const barCount = await page.locator('.bar-overlay').count();
  const sectionCount = await page.locator('.section-card').count();
  let album;
  try {
    for (let cycle = 0; cycle < 10; cycle++) {
      await button('Song details').click();
      const dialog = page.getByRole('dialog', { name: 'Song details', exact: true });
      await dialog.waitFor();
      assert.equal(await page.locator('.workspace').count(), 1, 'Opening details must not duplicate the workspace');
      if (album === undefined) album = await page.getByRole('textbox', { name: 'Album', exact: true }).inputValue();
      else assert.equal(await page.getByRole('textbox', { name: 'Album', exact: true }).inputValue(), album, 'Only Save changes should persist edits');
      await page.getByRole('textbox', { name: 'Album', exact: true }).fill(`Details regression ${cycle}`);
      switch (cycle % 5) {
        case 0: await button('Close dialog').click(); break;
        case 1: await button('Cancel').click(); break;
        case 2: await page.keyboard.press('Escape'); break;
        case 3: await page.locator('.modal-backdrop').click({ position: { x: 4, y: 4 } }); break;
        case 4: album = `Details regression ${cycle}`; await button('Save changes').click(); break;
      }
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await page.locator('.workspace').count(), 1, 'Closing details must leave one workspace');
      assert.equal(await page.locator('.alpha-score').count(), 1, 'Closing details must leave one notation host');
      assert(await workspace.evaluate(node => node === document.querySelector('.workspace')), 'Keep the current workspace mounted');
      assert(await score.evaluate(node => node === document.querySelector('.alpha-score')), 'Keep the same notation host');
      assert.equal(await page.locator('.bar-overlay').count(), barCount);
      assert.equal(await page.locator('.section-card').count(), sectionCount);
      assert.equal(await page.getByRole('slider', { name: 'Scrub through bars' }).inputValue(), '7', 'Keep the playback position');
      assert.equal(await page.getByLabel('Playback speed',{exact:true}).inputValue(), '75', 'Keep the playback speed');
    }
    await button('Select bar 1').click({position:{x:8,y:10}});
    await page.getByLabel('Playback speed',{exact:true}).fill('100');await page.getByLabel('Playback speed',{exact:true}).press('Enter');
    console.log('PASS: ten Song details cycles (X, Cancel, Escape, backdrop, Save) keep one workspace, notation host, bar position, speed and saved metadata.');
  } finally { await workspace.dispose(); await score.dispose(); }
}
