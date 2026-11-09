import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,createSession,saveRound,closeSession,togglePayment} from './ledger.js';
import {emptyCloudDb,canWrite,diffSingle,normalizeSession,prepareImport,matchSnapshot} from './cloud-model.js';

test('cloud starts empty without seeding sample members for every phone',()=>{
 const c=emptyCloudDb();assert.deepEqual(c.members,[]);assert.deepEqual(c.sessions,[]);assert.equal(c.schema,1);
 assert.equal(canWrite('admin'),true);assert.equal(canWrite('editor'),true);assert.equal(canWrite('viewer'),false);
});
test('one-document diff isolates member edits and one session without overwriting other entries',()=>{
 let a=seed();let b={...a,members:a.members.map((m,i)=>i===0?{...m,name:'Người A'}:m)};
 const diff=diffSingle(a,b);assert.equal(diff.kind,'members');assert.equal(diff.id,'TV001');assert.equal(diff.next.name,'Người A');
 assert.equal(matchSnapshot(diff.previous,a.members[0]),true);
 assert.equal(matchSnapshot(diff.previous,b.members[0]),false);
 assert.throws(()=>diffSingle(a,{...b,settings:{...b.settings,archiveDays:11}}),/đúng một mục/);
});
test('migration normalizes Done/Paid payments and keeps QR and history',()=>{
 let a=seed();const result=createSession(a,'2026-11-07',['TV001','TV002']);a=result.db;
 a=saveRound(a,result.session.id,null,'TV001',{TV002:25});a=closeSession(a,result.session.id);
 a=togglePayment(a,result.session.id,'TV002->TV001',true);
 a.members[0].qrImage='data:image/png;base64,iVBORw0KGgo=';
 const x=prepareImport(a);
 assert.equal(x.members.length,5);assert.match(x.members[0].qrImage,/image\/png/);
 assert.equal(x.sessions[0].status,'paid');assert.deepEqual(x.sessions[0].transferIds,['TV002->TV001']);
 assert.equal(x.sessions[0].rounds.length,1);
 const cleared=normalizeSession({...x.sessions[0],payments:{'TV002->TV001':false}});
 assert.equal(cleared.status,'done');assert.equal(cleared.paidAt,null);
});
test('migration rejects duplicate member IDs and malformed round money',()=>{
 let a=seed();a.members.push({...a.members[0]});assert.throws(()=>prepareImport(a),/Trùng mã/);
 let b=seed();const s=createSession(b,'2026-11-08',['TV001','TV002']);b=s.db;
 b=saveRound(b,s.session.id,null,'TV001',{TV002:20});
 b.sessions[0].rounds[0].losses.TV002=-5;
 assert.throws(()=>prepareImport(b),/không hợp lệ/);
});
