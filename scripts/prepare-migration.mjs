// Offline only: verify native table reads against original-site downloads.
// Never treats a truncated cell as a complete backup or changes production.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixture} from './sqlite-fixture.mjs';

const [partialFile,accountFile,detailFile,outputDir]=process.argv.slice(2);
assert.ok(partialFile&&accountFile&&detailFile&&outputDir,'Usage: node scripts/prepare-migration.mjs partial.json account.json resource.json output-dir');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [partial,account,detail]=await Promise.all([read(partialFile),read(accountFile),read(detailFile)]);
const {sqlite}=await fixture(':memory:');
try {
 const names=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x=>x.name);
 assert.deepEqual(partial.pages.map(x=>x.table_name).sort(),names,'Exactly one complete page for every business table is required');
 const tables={},supplements=[];
 for(const page of partial.pages){
  const name=page.table_name,p=page.model_projection;
  assert.equal(page.has_more,false);assert.equal(p.next_offset,null);assert.equal(page.offset,0);
  assert.equal(p.omitted_columns,0);assert.equal(p.omitted_rows,0);
  const columns=sqlite.prepare('PRAGMA table_info("'+name+'")').all().map(x=>x.name);
  assert.deepEqual(page.columns,columns);
  let repaired=0;
  tables[name]=page.rows.map(original=>{
   const row={...original};assert.deepEqual(Object.keys(row).sort(),[...columns].sort());
   for(const [key,value] of Object.entries(row)){
    if(typeof value==='string'&&value.endsWith('… [truncated for model]')){
     assert.equal(key,'data');assert.ok(['resources','revisions'].includes(name));
     const full=name==='resources'?account.resources.find(x=>x.id===row.id):detail.revisions.find(x=>x.id===row.id);
     assert.ok(full,'No full original-site download found for '+name);
     for(const k of columns.filter(x=>x!=='data')) assert.deepEqual(full[k],row[k],name+'.'+k+' differs from original table');
     const data=name==='resources'?full.data:JSON.stringify(full.data);
     assert.ok(data.startsWith(value.slice(0,-'… [truncated for model]'.length)),'Truncated prefix differs from original download');
     JSON.parse(data);row[key]=data;repaired++;supplements.push({table:name,id:row.id,field:key,source:name==='resources'?'account export':'resource detail API'});
    }
   }
   for(const [key,value] of Object.entries(row)){
    assert.ok(value===null||typeof value==='string'||Number.isSafeInteger(value),'Unsupported cell value');
    if(key==='data')JSON.parse(value);
   }
   return row;
  });
  assert.equal(repaired,p.truncated_values);assert.equal(p.truncated,repaired>0);
  const placeholders=columns.map(()=>'?').join(',');
  const stmt=sqlite.prepare('INSERT INTO "'+name+'" ('+columns.map(c=>'"'+c+'"').join(',')+') VALUES ('+placeholders+')');
  for(const row of tables[name])stmt.run(...columns.map(c=>row[c]));
 }
 assert.equal(sqlite.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM revisions v LEFT JOIN resources r ON v.resource_id=r.id WHERE r.id IS NULL').get().n,0);
 for(const r of tables.resources){
  const revision=tables.revisions.find(x=>x.resource_id===r.id&&x.version===r.version);assert.ok(revision,'Missing latest resource revision');assert.deepEqual(JSON.parse(revision.data),JSON.parse(r.data));
  assert.ok(tables.profiles.some(x=>x.id===r.owner_id),'Resource owner profile missing');
 }
 const canonical=JSON.stringify(tables),checksum=createHash('sha256').update(canonical).digest('hex');
 const sqlLiteral=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+v.replaceAll("'","''")+"'";
 const sql=['-- Import into EMPTY GrowthHub database only. Do not replace or merge users.',
  'CREATE TABLE IF NOT EXISTS gh_import_empty_guard (n INTEGER NOT NULL CHECK(n = 0));',
  'INSERT INTO gh_import_empty_guard(n) SELECT '+names.map(n=>'(SELECT COUNT(*) FROM "'+n+'")').join('+')+';'];
 for(const name of names)for(const row of tables[name])sql.push('INSERT INTO "'+name+'" ('+Object.keys(row).map(c=>'"'+c+'"').join(',')+') VALUES ('+Object.values(row).map(sqlLiteral).join(',')+');');
 sql.push('DROP TABLE gh_import_empty_guard;');
 await fs.mkdir(outputDir,{recursive:true});
 const snapshot={source:partial.source,createdAt:new Date().toISOString(),complete:true,supplements,checksum,tables};
 await fs.writeFile(path.join(outputDir,'verified-snapshot.json'),JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});
 await fs.writeFile(path.join(outputDir,'import.sql'),sql.join('\n')+'\n',{mode:0o600});
 console.log(JSON.stringify({result:'verified locally',checksum,counts:Object.fromEntries(names.map(n=>[n,tables[n].length])),supplements,remoteImport:'not performed'}));
} finally {sqlite.close()}
