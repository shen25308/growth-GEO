import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {fixture} from '../scripts/sqlite-fixture.mjs';
import {fixtureAuth,fixtureCookie} from '../scripts/auth-fixture.mjs';
import {api} from '../worker/api.js';

test('independent runtime ignores forged Sites identity headers, including admin email',async()=>{
 const {DB,sqlite}=await fixture();
 try{
  const headers={'oai-authenticated-user-id':'administrator','oai-authenticated-user-email':'admin@example.test'};
  const env={DB,...fixtureAuth,ADMIN_EMAILS:'admin@example.test',INVITE_ONLY:'true'};
  const response=await api(new Request('https://growthhub.test/api/bootstrap',{headers}),env);
  assert.equal((await response.json()).user,null);
  assert.equal((await api(new Request('https://growthhub.test/api/admin',{headers}),env)).status,401);
  const verified=await api(new Request('https://growthhub.test/api/bootstrap',{headers:{...headers,cookie:fixtureCookie('reader')}}),env);
  const {user}=await verified.json();
  assert.equal(user.id,'sb:reader');assert.equal(user.admin,false);
 }finally{sqlite.close()}
});

test('Cloudflare entrypoint fails closed for aliases, missing origin, and migration mode',async()=>{
 const request=new Request('https://growthhub.test/api/auth/oauth?provider=google');
 assert.equal((await worker.fetch(request,{})).status,421);
 assert.equal((await worker.fetch(request,{PUBLIC_ORIGIN:'https://different.test'})).status,421);
 const response=await worker.fetch(request,{PUBLIC_ORIGIN:'https://growthhub.test',MAINTENANCE:'true'});
 assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'60');
});

test('Cloudflare entrypoint preserves separate cookies and ignores forwarded host',async()=>{
 const {DB,sqlite}=await fixture();
 try{
  const env={DB,...fixtureAuth,PUBLIC_ORIGIN:'https://growthhub.test',AUTH_FETCH:async()=>Response.json({access_token:'test-access',refresh_token:'test-refresh'})};
  const login=await worker.fetch(new Request('https://growthhub.test/api/auth/login',{method:'POST',headers:{origin:'https://growthhub.test','content-type':'application/json','cf-connecting-ip':'192.0.2.33'},body:JSON.stringify({email:'member@example.test',password:'abc123'})}),env);
  assert.equal(login.status,200);assert.equal(login.headers.getSetCookie().length,2);
  assert.ok(login.headers.getSetCookie().every(c=>c.includes('HttpOnly; Secure; SameSite=Lax')));
  assert.equal(login.headers.get('cache-control'),'no-store');
  const oauth=await worker.fetch(new Request('https://growthhub.test/api/auth/oauth?provider=google',{headers:{'x-forwarded-host':'evil.test','x-forwarded-proto':'http'}}),env);
  assert.equal(new URL(oauth.headers.get('location')).searchParams.get('redirect_to'),'https://growthhub.test/api/auth/callback');
 }finally{sqlite.close()}
});
