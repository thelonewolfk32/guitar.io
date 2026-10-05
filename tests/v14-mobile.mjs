import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {serve,fixtures,seed,capturePlayer} from './library-harness.mjs';
fs.mkdirSync('test-results',{recursive:true});const server=await serve('dist'),browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(server.url);await page.getByRole('button',{name:'Device sync',exact:true}).waitFor();await seed(page,server.url,fixtures(6,8),true);await page.goto(server.url);
  await page.getByRole('button',{name:'Open Synthetic study 000',exact:true}).waitFor();
  const home=await page.locator('.collection-main').boundingBox();assert(home.x>=0&&home.x+home.width<=394,JSON.stringify(home));
  await page.screenshot({path:'test-results/v14-phone-home.png'});
  await capturePlayer(page);await page.getByRole('button',{name:'Open Synthetic study 000',exact:true}).click();await page.getByRole('button',{name:'Select bar 8',exact:true}).waitFor();await page.waitForFunction(()=>window.__testApi?.isReadyForPlayback);
  await page.getByRole('button',{name:'Player settings',exact:true}).click();await page.getByRole('button',{name:'Count in',exact:true}).waitFor();
  await page.screenshot({path:'test-results/v14-phone-player.png'});assert.deepEqual(errors,[]);console.log('PASS phone browser viewport: library within 393px, file opens, MIDI ready and player settings accessible. Native iOS remains untested.');
}finally{await context.close();await browser.close();await server.close();}
