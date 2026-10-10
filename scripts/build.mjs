import fs from 'node:fs/promises';
for(const name of ['index.html','app.js','styles.css','icons.js','THIRD-PARTY-LICENSE.txt'])await fs.rm('dist/'+name,{force:true});
const assets={};
const contentTypes={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',jpg:'image/jpeg',png:'image/png',webp:'image/webp',woff2:'font/woff2'};
for(const name of await fs.readdir('public')){
  if(name.startsWith('.'))continue;
  const ext=name.split('.').pop(),binary=['jpg','png','webp','woff2'].includes(ext);
  assets['/'+name]={body:await fs.readFile('public/'+name,binary?'base64':'utf8'),binary,type:contentTypes[ext]||'text/plain; charset=utf-8'};
}
const data=(await fs.readFile('public/data.js','utf8')).replaceAll('export ','');
const api=(await fs.readFile('worker/api.js','utf8')).replace(/^import .*\n/gm,'').replaceAll('export async function','async function');
const auth=(await fs.readFile('worker/auth.js','utf8')).replaceAll('export async function','async function').replaceAll('export function','function');
const handler=`\nconst assets=${JSON.stringify(assets)};\nexport default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const a=assets[url.pathname==='/'?'/index.html':url.pathname];if(!a)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:a.binary?Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)):a.body,{headers:{'content-type':a.type,'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','cache-control':'no-cache','content-security-policy':\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'\"}})}};`;
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});await fs.writeFile('dist/server/index.js',data+'\n'+auth+'\n'+api+handler);
try{
 await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
}catch(error){
 if(error.code!=='ENOENT')throw error;
 // A source checkout can build and run checks without access to a hosted Site.
 // Remove a previous binding so an unbound build cannot target a stale Site.
 await fs.rm('dist/.openai/hosting.json',{force:true});
 console.log('No Site binding: built for local verification only. See DEPLOYMENT.md.');
}
console.log('GrowthHub Worker built');
