import assert from 'node:assert/strict';

/** Exercise real hit testing, focus and clicks over the section sidebar. */
export async function checkRecordingModalLayer(page) {
 const button=name=>page.getByRole('button',{name,exact:true});
 const marker=await page.getByLabel('Scrub through bars').inputValue();
 for(const fullscreen of [false,true]) {
  if(fullscreen){await button('Player settings').click();await button('Fullscreen score').click();await page.waitForFunction(()=>!!document.fullscreenElement);}
  await button('Add recording').click();await button('Backing track').click();await button('YouTube link').click();
  const dialog=page.getByRole('dialog',{name:'Add recording',exact:true});await dialog.waitFor();
  await page.screenshot({path:`test-results/modal-layer-${fullscreen?'fullscreen':'normal'}.png`});
  assert(await page.evaluate(()=>{const r=document.querySelector('.modal-backdrop').getBoundingClientRect();return r.left<=0 && r.top<=0 && r.right>=innerWidth && r.bottom>=innerHeight;}),'backdrop covers the whole viewport');
  for(const target of ['.section-select','.section-progress-button','.section-edit','.bar-overlay']) {
   const box=await page.locator(target).first().boundingBox();assert(box);
   assert(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.modal-backdrop'),{x:box.x+box.width/2,y:box.y+box.height/2}),`${target} remains behind the recording dialog`);
  }
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)),'Tab stays inside the recording dialog');}
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  assert.equal(await page.getByLabel('Scrub through bars').inputValue(),marker);assert.equal(await page.locator('.section-editor').count(),0);
  // A click on the sidebar's position hits the dismissing backdrop, not a section.
  await button('Add recording').click();await button('Backing track').click();
  const target=await page.locator('.section-select').nth(1).boundingBox();await page.mouse.click(target.x+target.width/2,target.y+target.height/2);await dialog.waitFor({state:'detached'});
  assert.equal(await page.getByLabel('Scrub through bars').inputValue(),marker,'backdrop click cannot change the selected bar');assert.equal(await page.locator('.section-editor').count(),0);
  // Sections work normally once the dialog is closed.
  await button('Edit Intro').click();await page.locator('.section-editor').waitFor();await button('Cancel section edit').click();
  if(fullscreen){await button('Fullscreen score').click();await page.waitForFunction(()=>!document.fullscreenElement);await button('Player settings').click();}
 }
 console.log('PASS: recording dialog covers sections/score, blocks sidebar clicks, traps focus and closes correctly in normal and fullscreen player.');
}
