import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';

export const root=fileURLToPath(new URL('../',import.meta.url));
export async function fixture(path=':memory:'){
 const sqlite=new DatabaseSync(path);
 const migrations=(await fs.readdir(root+'drizzle')).filter(f=>f.endsWith('.sql')).sort();
 for(const name of migrations)sqlite.exec(await fs.readFile(root+'drizzle/'+name,'utf8'));
 return {sqlite,migrations,DB:{prepare(sql){return {bind(...values){return {sql,values,async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}}}}}}},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>({meta:{changes:Number(sqlite.prepare(s.sql).run(...s.values).changes)}}));sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}}};
}
