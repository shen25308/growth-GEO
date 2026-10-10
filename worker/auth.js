// Supabase Auth is the identity authority. Tokens stay in HttpOnly cookies;
// the browser never supplies a trusted user ID or stores credentials in localStorage.
const authError=(status,message)=>{throw Object.assign(new Error(message),{status})};
const validateNewPassword=password=>{if(typeof password!=='string'||password.length<6||password.length>128||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))authError(400,'密码需为 6–128 位，包含字母和数字')};
const authJSON=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
const authCookie=(name,value,age=2592000)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const cookieJar=request=>Object.fromEntries((request.headers.get('cookie')||'').split(';').map(p=>{const i=p.indexOf('=');try{return [p.slice(0,i).trim(),decodeURIComponent(p.slice(i+1))]}catch{return ['', '']}}));
const tokenCookies=t=>[authCookie('__Host-gh-access',t.access_token),authCookie('__Host-gh-refresh',t.refresh_token)];
const clearTokens=()=>[authCookie('__Host-gh-access','',0),authCookie('__Host-gh-refresh','',0),authCookie('__Host-gh-pkce','',0)];
const withCookies=(response,cookies)=>{for(const c of cookies)response.headers.append('set-cookie',c);return response};
const authRedirect=(path,cookies=[])=>withCookies(new Response(null,{status:303,headers:{location:path,'cache-control':'no-store','referrer-policy':'no-referrer'}}),cookies);
const authReady=env=>!!(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY);
const allowedNext=v=>typeof v==='string'&&/^#(?:explore|repo|profile|stars|practice|settings|drafts|inbox)(?:[/?].*)?$/.test(v)&&v.length<1000?v:'#explore';
const base64URL=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function provider(env,path,body,access,method=body?'POST':'GET'){
 if(!authReady(env))authError(503,'登录服务尚未开通，请稍后再试。你可以先浏览公开资源。');
 const base=new URL(env.SUPABASE_URL);if(base.protocol!=='https:'||base.username||base.password)authError(503,'登录服务配置需要检查');
 let response;try{response=await (env.AUTH_FETCH||fetch)(base.origin+'/auth/v1/'+path,{method,headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json',...(access?{authorization:'Bearer '+access}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)})}catch{authError(503,'登录服务暂时无法连接，请稍后重试')}
 const data=response.status===204?{}:await response.json().catch(()=>({}));
 if(!response.ok){const message=response.status===429?'尝试次数过多，请稍后再试':data.error_code==='email_not_confirmed'?'请先验证邮箱，再登录':data.error_code==='weak_password'?'密码强度不足，请使用更长的不同字符组合':data.error_code==='same_password'?'新密码不能与原密码相同':response.status>=500?'登录服务暂时不可用，请稍后重试':'邮箱、密码或验证信息无效，请检查后重试';authError(response.status>=500?503:response.status===429?429:400,message)}
 return data;
}
function platformUser(request){const id=request.headers.get('oai-authenticated-user-id');if(!id)return null;let name=request.headers.get('oai-authenticated-user-full-name')||'';try{if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8')name=decodeURIComponent(name)}catch{}const email=(request.headers.get('oai-authenticated-user-email')||'').toLowerCase();return {id,email,name:(name||email.split('@')[0]||'增长实践者').slice(0,50),provider:'chatgpt'}}
export async function resolveIdentity(request,env){
 const cookies=cookieJar(request),access=cookies['__Host-gh-access'],refresh=cookies['__Host-gh-refresh'];
 if(authReady(env)&&(access||refresh)){
  let tokens,verified;
  if(access){try{verified=await provider(env,'user',null,access)}catch(e){if(e.status>=500||e.status===429)throw e}}
  if(!verified&&refresh){try{tokens=await provider(env,'token?grant_type=refresh_token',{refresh_token:refresh});verified=await provider(env,'user',null,tokens.access_token)}catch(e){if(e.status>=500||e.status===429)throw e}}
  if(verified?.id&&verified.email_confirmed_at&&typeof verified.email==='string')return {user:{id:'sb:'+verified.id,email:verified.email.toLowerCase(),name:String(verified.user_metadata?.full_name||verified.email.split('@')[0]).slice(0,50),provider:'supabase'},cookies:tokens?tokenCookies(tokens):[]};
  return {user:null,cookies:clearTokens()};
 }
 return {user:platformUser(request),cookies:[]};
}
export async function authAPI(request,env){
 const url=new URL(request.url),action=url.pathname.split('/')[3],jar=cookieJar(request);
 if(action==='callback'&&request.method==='GET'){
  let saved;try{saved=JSON.parse(jar['__Host-gh-pkce']||'{}')}catch{saved={}}
  if(url.searchParams.get('error')||!saved.verifier||!url.searchParams.get('code'))return authRedirect('/#login?error=callback',[authCookie('__Host-gh-pkce','',0)]);
  try{const tokens=await provider(env,'token?grant_type=pkce',{auth_code:url.searchParams.get('code'),code_verifier:saved.verifier});return authRedirect('/'+(saved.mode==='recovery'?'#reset-password':allowedNext(saved.next)),[...tokenCookies(tokens),authCookie('__Host-gh-pkce','',0)])}catch{return authRedirect('/#login?error=callback',[authCookie('__Host-gh-pkce','',0)])}
 }
 if(action==='oauth'&&request.method==='GET'){
  const p=url.searchParams.get('provider');if(!['google','apple'].includes(p)||(env.AUTH_PROVIDERS||'').split(',').indexOf(p)<0)authError(503,'此登录方式尚未开通');if(!authReady(env))authError(503,'登录服务尚未开通');
  const verifier=base64URL(crypto.getRandomValues(new Uint8Array(48))),challenge=base64URL(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  const target=new URL('/auth/v1/authorize',env.SUPABASE_URL);target.search=new URLSearchParams({provider:p,redirect_to:url.origin+'/api/auth/callback',code_challenge:challenge,code_challenge_method:'s256'}).toString();
  return authRedirect(target.href,[authCookie('__Host-gh-pkce',JSON.stringify({verifier,next:allowedNext(url.searchParams.get('next'))}),3600)]);
 }
 if(request.method!=='POST')authError(405,'操作方式无效');
 if(request.headers.get('origin')!==url.origin)authError(403,'请求来源无效');
 if(!request.headers.get('content-type')?.includes('application/json'))authError(415,'请使用 JSON 请求');
 const raw=await request.text();if(raw.length>5000)authError(413,'输入过长');let b;try{b=JSON.parse(raw)}catch{authError(400,'内容格式无效')}if(!b||Array.isArray(b)||typeof b!=='object')authError(400,'内容格式无效');
 if(action==='logout'){try{if(jar['__Host-gh-access'])await provider(env,'logout?scope=local',{},jar['__Host-gh-access'])}catch(e){if(e.status>=500)throw e}return withCookies(authJSON({ok:true}),clearTokens())}
 // Auth rate limits live in D1 so parallel workers cannot bypass them.
 const fingerprint=base64URL(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.headers.get('cf-connecting-ip')||'unknown')));
 const now=Date.now(),key='auth:'+fingerprint+':'+Math.floor(now/600000);
 const limit=await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+600000).first();
 await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now-600000).run();
 if(limit.count>30)authError(429,'尝试次数过多，请十分钟后再试');
 if(action==='password'){
  validateNewPassword(b.password);
  const identity=await resolveIdentity(request,env);if(!identity.user||identity.user.provider!=='supabase')authError(401,'请重新打开邮件中的验证链接');
  const fresh=identity.cookies.find(c=>c.startsWith('__Host-gh-access='));const access=fresh?decodeURIComponent(fresh.split(';')[0].split('=')[1]):jar['__Host-gh-access'];
  await provider(env,'user',{password:b.password},access,'PUT');return withCookies(authJSON({ok:true}),identity.cookies);
 }
 if(!['login','signup','recover','resend'].includes(action))authError(404,'未找到接口');
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)authError(400,'请输入有效邮箱');
 if(action==='signup')validateNewPassword(b.password);
 if(action==='login'&&(typeof b.password!=='string'||!b.password.length||b.password.length>128))authError(400,'请输入有效密码');
 if(action==='login'){const t=await provider(env,'token?grant_type=password',{email,password:b.password});return withCookies(authJSON({ok:true}),tokenCookies(t))}
 if(action==='signup'){
  if(b.accepted!==true)authError(400,'请阅读并同意社区约定和隐私说明');
  const invited=await env.DB.prepare('SELECT active FROM invitations WHERE email=?').bind(email).first();
  const admin=(env.ADMIN_EMAILS||'').toLowerCase().split(',').map(s=>s.trim()).includes(email);
  if(!invited?.active&&!admin)authError(403,'此邮箱尚未获得试用邀请，请联系邀请你的管理员');
 }
 const verifier=base64URL(crypto.getRandomValues(new Uint8Array(48))),challenge=base64URL(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
 const callback=url.origin+'/api/auth/callback',pkce=authCookie('__Host-gh-pkce',JSON.stringify({verifier,mode:action==='recover'?'recovery':'signup',next:allowedNext(b.next)}),3600);
 if(action==='resend'){
  if(!jar['__Host-gh-pkce'])authError(400,'请回到创建账户页重新发起注册，再在同一浏览器完成验证');
  // A fresh signup request carries a fresh PKCE challenge; resend keeps the
  // existing verifier from the original request, rather than replacing it.
  await provider(env,'resend',{email,type:'signup',email_redirect_to:callback});return authJSON({sent:true});
 }
 const t=await provider(env,(action==='signup'?'signup':'recover')+'?redirect_to='+encodeURIComponent(callback),{email,...(action==='signup'?{password:b.password}:{}),code_challenge:challenge,code_challenge_method:'s256'});
 if(t.access_token)return withCookies(authJSON({ok:true}),tokenCookies(t));
 return withCookies(authJSON({sent:true}),[pkce]);
}
export function authConfiguration(env){return {ready:authReady(env),providers:authReady(env)?(env.AUTH_PROVIDERS||'').split(',').filter(p=>['google','apple'].includes(p)):[]}}
