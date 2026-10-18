const http=require('node:http');
const callback='http://127.0.0.1:43871/auth/callback';
function validProviderURL(value){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.hash)throw Error('Invalid authentication URL.');
 const hosted=/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)&&url.pathname==='/auth/v1/authorize';
 const provider=(url.hostname==='accounts.google.com'&&url.pathname.startsWith('/o/oauth2/'))||(url.hostname==='appleid.apple.com'&&url.pathname==='/auth/authorize');
 if(!hosted&&!provider)throw Error('Unrecognised authentication provider.');
 if(hosted){const destination=new URL(url.searchParams.get('redirect_to'));if(destination.origin+destination.pathname!==callback||destination.hash||[...destination.searchParams].some(([key,value])=>key!=='sb_flow_id'||!/^[a-zA-Z0-9_-]{8,64}$/.test(value))||url.searchParams.get('code_challenge_method')!=='s256'||!url.searchParams.get('code_challenge'))throw Error('PKCE and the exact local callback are required.');}
 if(provider){const redirect=new URL(url.searchParams.get('redirect_uri'));if(redirect.protocol!=='https:'||!/^[a-z0-9]{20}\.supabase\.co$/.test(redirect.hostname)||redirect.pathname!=='/auth/v1/callback')throw Error('Invalid provider redirect.');}
 return url.href;
}
function createAccountOAuth(openExternal){let pending;
 return {callback,wait(url){if(pending)throw Error('Finish or cancel the current sign-in first.');const target=url?validProviderURL(url):undefined;
  return new Promise((resolve,reject)=>{let timer,done=false;const server=http.createServer((req,res)=>{const received=new URL(req.url,callback);if(req.method!=='GET'||req.headers.host!=='127.0.0.1:43871'||received.pathname!=='/auth/callback'||received.hash){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'",'Referrer-Policy':'no-referrer'});res.end('Return to Guitar.io to finish signing in.');finish(undefined,received.href);
  });
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);server.close();pending=undefined;error?reject(error):resolve(value);};
  pending=()=>finish(Error('Authentication cancelled.'));timer=setTimeout(()=>finish(Error('Sign-in timed out. Request a new link.')),300000);
  server.on('error',()=>finish(Error('The local authentication callback is unavailable. Close other Guitar.io copies and try again.')));
  server.listen(43871,'127.0.0.1',()=>{if(target)Promise.resolve(openExternal(target)).catch(()=>finish(Error('Could not open the system browser.')));});
 });},cancel(){pending?.();}};
}
module.exports={createAccountOAuth,validProviderURL,callback};
