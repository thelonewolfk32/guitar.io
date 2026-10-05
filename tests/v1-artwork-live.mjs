/** Optional read-only checks of live artwork providers through the app's CSP. */
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const root=path.resolve('dist'),server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
  const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result=await page.evaluate(async()=>{
    const requests=[['Apple artist','https://itunes.apple.com/search?term=Alexisonfire&media=music&entity=album&limit=30'],['Wikipedia album','https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=600&titles=Crisis%20(Alexisonfire%20album)'],['Wikipedia','https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=600&titles=Alexisonfire']];
    return Promise.all(requests.map(async([provider,url])=>{try{const response=await fetch(url,{signal:AbortSignal.timeout(12000),credentials:'omit'});if(!response.ok)return{provider,status:response.status};const body=await response.json();const image=provider.startsWith('Apple')?body.results?.find(r=>r.artistName==='Alexisonfire' && /Old Crows/i.test(r.collectionName))?.artworkUrl100:Object.values(body.query?.pages || {})[0]?.thumbnail?.source;if(!image)return{provider,status:'no match',sample:body.results?.map(r=>({artist:r.artistName,album:r.collectionName}))};const cover=await fetch(image,{signal:AbortSignal.timeout(12000),credentials:'omit'}),blob=await cover.blob();return{provider,status:cover.status,mime:blob.type,bytes:blob.size};}catch(e){return{provider,error:e.message};}}));
  });
  console.log(JSON.stringify(result));
  if(!result.some(r=>r.provider.startsWith('Apple') && r.status===200 && r.mime.startsWith('image/') && r.bytes>0))process.exitCode=1;
}finally{await browser.close();await new Promise(r=>server.close(r));}
