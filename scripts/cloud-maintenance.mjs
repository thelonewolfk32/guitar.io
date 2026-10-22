try{process.loadEnvFile('.env.ops.local');}catch(e){if(e.code!=='ENOENT')throw e;}
const url=new URL(process.env.SUPABASE_URL||'');if(url.protocol!=='https:'||!/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)||!process.env.MAINTENANCE_SECRET)throw Error('Configure the exact project URL and maintenance credential.');
const response=await fetch(url.origin+'/functions/v1/guitario?route=maintenance',{method:'POST',headers:{Authorization:'Bearer '+process.env.MAINTENANCE_SECRET},signal:AbortSignal.timeout(120000)});
if(!response.ok)throw Error('Managed maintenance failed ('+response.status+').');const result=await response.json();console.log(JSON.stringify(result));
