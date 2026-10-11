import {fixtureAuth,fixtureCookie} from './auth-fixture.mjs';
// Local-only rehearsal. Never opens, exports, or overwrites production data.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync,backup} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {fixture} from './sqlite-fixture.mjs';
import {api} from '../worker/api.js';

const directory=await fs.mkdtemp(path.join(os.tmpdir(),'growthhub-recovery-'));
let source,restored;
try{
 const f=await fixture(path.join(directory,'source.sqlite'));source=f.sqlite;
 const call=async(route,method,body,user='author')=>{
  const response=await api(new Request('https://fixture.test/api/'+route,{method,headers:{'content-type':'application/json',origin:'https://fixture.test',cookie:fixtureCookie(user)},...(body?{body:JSON.stringify(body)}:{})}),{DB:f.DB,...fixtureAuth});
  assert.ok(response.ok,'Fixture creation failed: '+route);return response.json();
 };
 await call('profile','PUT',{name:'Recovery Fixture',accepted:true});
 const content={title:'恢复演练夹具',desc:'人工测试记录，不是真实用户数据。',readme:'## 步骤\n- 验证恢复后的数据与隔离权限',type:'skill',topic:'GEO'};
 const resource=await call('resources','POST',content);
 await call('resources/'+resource.id,'PUT',{...content,version:1,readme:content.readme+'\n- 保存版本关系'});
 await call('resources/'+resource.id+'/star','PUT',{active:true},'reader');
 await call('drafts/private-fixture','PUT',{version:0,data:{mode:'new',title:'私有草稿夹具',readme:'不应公开'}});
 await call('resources/'+resource.id+'/practice','PUT',{version:0,stage:'running',visibility:'private',data:{context:'恢复演练',metric:'完整性',baseline:'完整',timeframe:'一次恢复'}});
 const tables=source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
 const snapshot=db=>Object.fromEntries(tables.map(name=>[name,db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()]));
 const original=snapshot(source),backupFile=path.join(directory,'snapshot.sqlite');
 await backup(source,backupFile);
 const originalBytes=await fs.readFile(backupFile),checksum=createHash('sha256').update(originalBytes).digest('hex');
 source.prepare("UPDATE resources SET data='{}'").run();source.prepare('DELETE FROM drafts').run();
 assert.notDeepEqual(snapshot(source),original);
 const restoreFile=path.join(directory,'restored.sqlite');await fs.copyFile(backupFile,restoreFile);
 assert.equal(createHash('sha256').update(await fs.readFile(restoreFile)).digest('hex'),checksum);
 restored=new DatabaseSync(restoreFile);
 assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 assert.deepEqual(snapshot(restored),original);
 assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM revisions WHERE resource_id=?').get(resource.id).n,2);
 assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM drafts WHERE user_id=?').get('sb:reader').n,0);
 assert.equal(restored.prepare("SELECT COUNT(*) AS n FROM practices WHERE visibility='community'").get().n,0);
 console.log(JSON.stringify({result:'passed',scope:'synthetic local SQLite fixture only',tables:tables.length,checks:['checksum','integrity','all-table roundtrip','versions','draft ownership','practice privacy'],productionBackup:'not performed',productionRestore:'not performed'}));
}finally{restored?.close();source?.close();await fs.rm(directory,{recursive:true,force:true})}
