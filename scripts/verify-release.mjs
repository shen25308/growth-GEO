import {fixtureAuth,fixtureCookie} from './auth-fixture.mjs';
// Run against the actual compiled Worker, using isolated fixture data.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {fixture,root} from './sqlite-fixture.mjs';

function run(args){const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(result.status!==0)throw new Error('Release verification stopped: '+args.join(' '));}
const tests=(await fs.readdir(root+'tests')).filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f);
run(['--test','--test-reporter=dot',...tests]);
for(const dir of ['public','worker','scripts'])for(const name of await fs.readdir(root+dir))if(/\.m?js$/.test(name))run(['--check',dir+'/'+name]);
run(['scripts/build.mjs']);
const worker=(await import(pathToFileURL(root+'dist/server/index.js'))).default;
assert.equal(typeof worker.fetch,'function');
const {sqlite,DB}=await fixture();
let count=0;
const check=async(name,task)=>{await task();count++;console.log('PASS '+name)};
const request=(path,method='GET',body,identity)=>new Request('https://growthhub.test'+path,{method,headers:{origin:'https://growthhub.test','content-type':'application/json',...(identity?{cookie:fixtureCookie(identity)}:{})},...(body?{body:JSON.stringify(body)}:{})});
const env={...fixtureAuth,DB,INVITE_ONLY:'true',ADMIN_EMAILS:'owner@example.test'};
try{
 await check('entrypoint and response headers',async()=>{const r=await worker.fetch(request('/'),env);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(await r.text(),/GrowthHub/)});
 await check('every built asset is included byte-for-byte',async()=>{for(const name of [...(await fs.readdir(root+'dist/assets')).filter(n=>n!=='assets'),...(await fs.readdir(root+'dist/assets/assets')).map(n=>'assets/'+n)]){if(name.startsWith('.')||name==='_headers')continue;const r=await worker.fetch(request('/'+name),env);assert.equal(r.status,200,name);assert.deepEqual(Buffer.from(await r.arrayBuffer()),await fs.readFile(root+'dist/assets/'+name),name)}});
 await check('HEAD has no body and static writes fail',async()=>{assert.equal((await worker.fetch(request('/','HEAD'),env)).status,200);assert.equal(await (await worker.fetch(request('/','HEAD'),env)).text(),'');assert.equal((await worker.fetch(request('/','POST',{}),env)).status,405)});
 await check('private source and local preview routes are not served',async()=>{for(const path of ['/.env','/.git/config','/worker/auth.js','/scripts/dev.mjs','/__preview/admin','/.sites-runtime/preview.sqlite'])assert.equal((await worker.fetch(request(path),env)).status,404,path)});
 await check('anonymous discovery has no private account state',async()=>{const r=await worker.fetch(request('/api/bootstrap'),env),b=await r.json();assert.equal(r.status,200);assert.equal(b.user,null);assert.deepEqual(b.stars,[]);assert.deepEqual(b.practices,[]);assert.deepEqual(b.resources,[]);assert.equal(r.headers.get('cache-control'),'no-store')});
 await check('unconfigured external sign-in stays unavailable',async()=>{const b=await (await worker.fetch(request('/api/bootstrap'),{...env,SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''})).json();assert.deepEqual(b.auth,{ready:false,providers:[]});const r=await worker.fetch(request('/api/auth/login','POST',{email:'test@example.test',password:'fixture-password'}),{...env,SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:''});assert.equal(r.status,503)});
 await check('guest cannot write or open member/admin data',async()=>{for(const path of ['/api/drafts','/api/admin','/api/notifications','/api/account/export'])assert.equal((await worker.fetch(request(path),env)).status,401,path);assert.equal((await worker.fetch(request('/api/resources','POST',{}),env)).status,401)});
 await check('uninvited account has no contribution privileges',async()=>{const r=await worker.fetch(request('/api/resources','POST',{},'outsider'),env);assert.equal(r.status,403);const b=await (await worker.fetch(request('/api/bootstrap','GET',null,'outsider'),env)).json();assert.equal(b.user.member,false);assert.equal(b.user.admin,false)});
 await check('owner role comes from configured identity',async()=>{const r=await worker.fetch(request('/api/admin','GET',null,'owner'),env);assert.equal(r.status,200);assert.ok(Array.isArray((await r.json()).invitations))});
 await check('verified non-admin cannot access administration',async()=>{const r=await worker.fetch(request('/api/admin','GET',null,'outsider'),env);assert.equal(r.status,403)});
 await check('cross-origin mutation is rejected',async()=>{const req=request('/api/profile','PUT',{name:'Injected',accepted:true},'owner');req.headers.set('origin','https://other.test');assert.equal((await worker.fetch(req,env)).status,403)});
 await check('storage failure is reported, never success',async()=>{const r=await worker.fetch(request('/api/bootstrap'),{});assert.equal(r.status,503)});
 console.log(JSON.stringify({compiledWorkerChecks:count,result:'passed',externalProviderEndToEnd:'pending',productionRecovery:'pending'}));
}finally{sqlite.close()}
