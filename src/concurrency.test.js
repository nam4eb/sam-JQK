import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,createSession,saveRound,closeSession,togglePayment,changePlayers,clearSession} from './ledger.js';
import {sameData,reconcileChange} from './concurrency.js';
import {diffSingle} from './cloud-model.js';
const setup=()=>{const a=createSession(seed(),'2026-11-25',['TV001','TV002','TV003']);return {db:a.db,sid:a.session.id};};
const change=(before,after)=>diffSingle(before,after);
test('concurrent snapshots compare Firestore object keys independent of order',()=>{
 assert.equal(sameData({a:1,b:{y:2,x:1}},{b:{x:1,y:2},a:1}),true);
});
test('independent new rounds from two phones merge',()=>{
 const {db,sid}=setup();
 const a=saveRound(db,sid,null,'TV001',{TV002:10}),b=saveRound(db,sid,null,'TV003',{TV001:10});
 const result=reconcileChange(change(db,b),a.sessions[0]);
 assert.equal(result.rounds.length,2);
});
test('edits on different rounds preserve both changes',()=>{
 let {db,sid}=setup();db=saveRound(db,sid,null,'TV001',{TV002:10});db=saveRound(db,sid,null,'TV003',{TV001:8});
 const [r1,r2]=db.sessions[0].rounds;
 const a=saveRound(db,sid,r1.id,'TV001',{TV002:50});
 const b=saveRound(db,sid,r2.id,'TV003',{TV001:40});
 const result=reconcileChange(change(db,b),a.sessions[0]);
 assert.equal(result.rounds[0].losses.TV002,50);
 assert.equal(result.rounds[1].losses.TV001,40);
});
test('same round edited differently is rejected',()=>{
 let {db,sid}=setup();db=saveRound(db,sid,null,'TV001',{TV002:10});const rid=db.sessions[0].rounds[0].id;
 const a=saveRound(db,sid,rid,'TV001',{TV002:20});const b=saveRound(db,sid,rid,'TV001',{TV002:30});
 assert.throws(()=>reconcileChange(change(db,b),a.sessions[0]),/cùng ván/);
});
test('a late round does not re-open a session already closed on another phone',()=>{
 let {db,sid}=setup();db=saveRound(db,sid,null,'TV001',{TV002:10});
 const closed=closeSession(db,sid),late=saveRound(db,sid,null,'TV003',{TV001:10});
 assert.throws(()=>reconcileChange(change(db,late),closed.sessions[0]),/đã được chốt/);
});
test('different transfer checkboxes are combined',()=>{
 let {db,sid}=setup();db=saveRound(db,sid,null,'TV001',{TV002:10,TV003:20});db=closeSession(db,sid);
 const a=togglePayment(db,sid,'TV002->TV001',true),b=togglePayment(db,sid,'TV003->TV001',true);
 const combined=reconcileChange(change(db,b),a.sessions[0]);
 assert.equal(combined.status,'paid');assert.equal(Object.values(combined.payments).filter(Boolean).length,2);
});
test('destructive clear refuses to overwrite a different concurrent round',()=>{
 let {db,sid}=setup();db=saveRound(db,sid,null,'TV001',{TV002:10});
 const deleted=clearSession(db,sid,true),more=saveRound(db,sid,null,'TV003',{TV001:5});
 assert.throws(()=>reconcileChange(change(db,deleted),more.sessions[0]),/được thay đổi/);
});
test('roster changes reject stale newly entered rounds even when total membership is same',()=>{
 const {db,sid}=setup();
 const switched=changePlayers(db,sid,['TV001','TV003']);
 const stale=saveRound(db,sid,null,'TV002',{TV001:7});
 assert.throws(()=>reconcileChange(change(db,stale),switched.sessions[0]),/Danh sách người chơi/);
});

test('identical repeated round edits are idempotent',()=>{
 let {db,sid}=setup();db=saveRound(db,sid,null,'TV001',{TV002:10});const rid=db.sessions[0].rounds[0].id;
 const updated=saveRound(db,sid,rid,'TV001',{TV002:50});
 const server={...updated.sessions[0],rounds:updated.sessions[0].rounds.map(r=>({...r,updatedAt:'other-device'}))};
 const result=reconcileChange(change(db,updated),server);
 assert.equal(result.rounds[0].losses.TV002,50);
});

test('stale Done snapshot must not discard a newly added round',()=>{
 let {db,sid}=setup();db=saveRound(db,sid,null,'TV001',{TV002:10});
 const staleDone=closeSession(db,sid),added=saveRound(db,sid,null,'TV002',{TV003:5});
 assert.throws(()=>reconcileChange(change(db,staleDone),added.sessions[0]),/được thay đổi/);
});

test('the same payment checked true twice remains true',()=>{
 let {db,sid}=setup();db=saveRound(db,sid,null,'TV001',{TV002:10,TV003:15});db=closeSession(db,sid);
 const a=togglePayment(db,sid,'TV002->TV001',true);
 const server={...a.sessions[0],updatedBy:'other'};
 const merged=reconcileChange(change(db,a),server);
 assert.equal(merged.payments['TV002->TV001'],true);
});

test('same snapshots with different key orders do not fail equality check',()=>{
 const {db,sid}=setup();const updated=saveRound(db,sid,null,'TV001',{TV002:17});
 const old=db.sessions[0];
 const reordered={status:old.status,rounds:old.rounds,activeMemberIds:old.activeMemberIds,memberIds:old.memberIds,id:old.id,date:old.date,updatedAt:old.updatedAt,createdAt:old.createdAt};
 const result=reconcileChange(change(db,updated),reordered);
 assert.equal(result.rounds[0].losses.TV002,17);
});

test('initial config may be created when Firestore config document is absent',()=>{
 const {db}=setup();const updated={...db,settings:{...db.settings,archiveDays:14}};
 const c=change(db,updated);
 assert.equal(c.kind,'settings');
 assert.deepEqual(reconcileChange(c,undefined),updated.settings);
});

test('session edit does not conflict with another member document',()=>{
 const {db,sid}=setup();const updated=saveRound(db,sid,null,'TV001',{TV002:6});
 assert.equal(reconcileChange(change(db,updated),db.sessions[0]).rounds.length,1);
});
