import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, createSession, saveRound, closeSession, togglePayment, clearSession, changePlayers, MAX_ROUNDS } from './ledger.js';
import { sameData, reconcileChange } from './concurrency.js';
import { diffSingle } from './cloud-model.js';

function setup() {
  let db=seed();
  const created=createSession(db,'2026-11-09',['TV001','TV002','TV003']);
  return { db:created.db, sid:created.session.id };
}
function change(before, after) { return diffSingle(before, after); }
const round=(db,sid,winner,losses,rid=null)=>saveRound(db,sid,rid,winner,losses);
function onRemote(c,remote) { return reconcileChange(c,remote); }

test('sameData ignores Firestore map key order but still detects changed money',()=>{
 assert.equal(sameData({b:{z:1,a:2},a:[{b:2,a:1}]},{a:[{a:1,b:2}],b:{a:2,z:1}}),true);
 assert.equal(sameData({losses:{TV002:20}},{losses:{TV002:21}}),false);
});

test('two phones add different rounds to same session without dropping either',()=>{
 const {db,sid}=setup();
 const a=round(db,sid,'TV001',{TV002:10});
 const b=round(db,sid,'TV003',{TV001:20});
 const addA=change(db,a), addB=change(db,b);
 const remote=onRemote(addA,db.sessions[0]);
 const merged=onRemote(addB,remote);
 assert.equal(merged.rounds.length,2);
 assert.deepEqual(merged.rounds.map(x=>x.winnerId),['TV001','TV003']);
});

test('different existing rounds edited at once both survive',()=>{
 const {db:initial,sid}=setup();
 let db=round(initial,sid,'TV001',{TV002:10});
 db=round(db,sid,'TV002',{TV003:15});
 const [one,two]=db.sessions[0].rounds.map(x=>x.id);
 const a=round(db,sid,'TV001',{TV002:40},one);
 const b=round(db,sid,'TV002',{TV003:60},two);
 const updated=onRemote(change(db,b),a.sessions[0]);
 assert.equal(updated.rounds[0].losses.TV002,40);
 assert.equal(updated.rounds[1].losses.TV003,60);
});

test('same round edited to different totals is rejected, never last-write-wins',()=>{
 const {db:initial,sid}=setup();
 const db=round(initial,sid,'TV001',{TV002:10});
 const id=db.sessions[0].rounds[0].id;
 const a=round(db,sid,'TV001',{TV002:40},id);
 const b=round(db,sid,'TV001',{TV002:60},id);
 assert.throws(()=>onRemote(change(db,b),a.sessions[0]),/cùng ván/);
});

test('the same round result is idempotent when updatedAt differs',()=>{
 const {db:initial,sid}=setup();
 const db=round(initial,sid,'TV001',{TV002:10});
 const rid=db.sessions[0].rounds[0].id;
 const next=round(db,sid,'TV001',{TV002:50},rid);
 const server={...next.sessions[0],rounds:next.sessions[0].rounds.map(x=>({...x,updatedAt:'other device time'}))};
 const merged=onRemote(change(db,next),server);
 assert.equal(merged.rounds[0].losses.TV002,50);
});

test('late new round fails when another phone closes session',()=>{
 const {db:initial,sid}=setup();
 const db=round(initial,sid,'TV001',{TV002:10});
 const stale=round(db,sid,'TV003',{TV001:15});
 const finalized=closeSession(db,sid);
 assert.throws(()=>onRemote(change(db,stale),finalized.sessions[0]),/đã được chốt/);
});

test('stale Done cannot finalize snapshot if another phone adds round',()=>{
 const {db:initial,sid}=setup();
 const db=round(initial,sid,'TV001',{TV002:10});
 const done=closeSession(db,sid);
 const extra=round(db,sid,'TV002',{TV003:22});
 assert.throws(()=>onRemote(change(db,done),extra.sessions[0]),/được thay đổi/);
});

test('two phones mark different payments, status becomes paid when both done',()=>{
 const {db:initial,sid}=setup();
 let db=round(initial,sid,'TV001',{TV002:10,TV003:20});
 db=closeSession(db,sid);
 const a=togglePayment(db,sid,'TV002->TV001',true);
 const b=togglePayment(db,sid,'TV003->TV001',true);
 const merged=onRemote(change(db,b),a.sessions[0]);
 assert.equal(merged.payments['TV002->TV001'],true);
 assert.equal(merged.payments['TV003->TV001'],true);
 assert.equal(merged.status,'paid');
});

test('marking the same payment already true is idempotent',()=>{
 const {db:initial,sid}=setup();
 let db=round(initial,sid,'TV001',{TV002:10,TV003:20});
 db=closeSession(db,sid);
 const a=togglePayment(db,sid,'TV002->TV001',true);
 const server={...a.sessions[0],updatedBy:'other'};
 const merged=onRemote(change(db,a),server);
 assert.equal(merged.payments['TV002->TV001'],true);
});

test('destructive clear keeps strict conflict checking when another round was added',()=>{
 const {db:initial,sid}=setup();
 const db=round(initial,sid,'TV001',{TV002:10});
 const clearing=clearSession(db,sid,true);
 const server=round(db,sid,'TV003',{TV001:5});
 assert.throws(()=>onRemote(change(db,clearing),server.sessions[0]),/được thay đổi/);
});

test('changes to player roster cannot be applied with stale round form',()=>{
 const {db,sid}=setup();
 const changed=changePlayers(db,sid,['TV001','TV002']);
 const attempted=round(db,sid,'TV003',{TV001:10});
 assert.throws(()=>onRemote(change(db,attempted),changed.sessions[0]),/Danh sách người chơi/);
});

test('same snapshot plus different key insertion order does not cause false conflict',()=>{
 const {db,sid}=setup();
 const updated=round(db,sid,'TV001',{TV002:17});
 const old=db.sessions[0];
 const reordered={status:old.status,rounds:old.rounds,memberIds:old.memberIds,id:old.id,date:old.date,updatedAt:old.updatedAt,createdAt:old.createdAt};
 const result=onRemote(change(db,updated),reordered);
 assert.equal(result.rounds[0].losses.TV002,17);
});

test('initial settings can be created when Firestore doc not yet present',()=>{
 const {db}=setup();
 const next={...db,settings:{...db.settings,archiveDays:9}};
 const c=change(db,next);
 assert.equal(c.kind,'settings');
 assert.deepEqual(onRemote(c,undefined),next.settings);
});

test('edits to unrelated member document do not affect session mutation',()=>{
 const {db,sid}=setup();
 const next=round(db,sid,'TV001',{TV002:3});
 assert.equal(onRemote(change(db,next),db.sessions[0]).rounds.length,1);
});
