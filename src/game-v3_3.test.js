import test from 'node:test';
import assert from 'node:assert/strict';
import { seed,createMember,createSession,changePlayers,activePlayers,saveRound,sessionStats,closeSession,settlementSummary,togglePayment,isDatabase,monthlyStats,dailyGroupedStats,SAM_LOSS,BURN_LOSS,CATCH_TWO } from './ledger.js';
import {prepareImport,diffSingle} from './cloud-model.js';
import {reconcileChange} from './concurrency.js';

const setup=()=>{const a=createSession(seed(),'2026-11-25',['TV001','TV002','TV003']);return {db:a.db,sid:a.session.id};};
const get=(db,sid)=>db.sessions.find(s=>s.id===sid);
const net=(db,sid,mid)=>sessionStats(get(db,sid)).totals[mid].net;

test('the first five rounds keep original roster when someone leaves or arrives',()=>{
 let {db,sid}=setup();
 db=saveRound(db,sid,null,'TV001',{TV002:10,TV003:20});
 db=changePlayers(db,sid,['TV001','TV003','TV004']);
 assert.deepEqual(activePlayers(get(db,sid)),['TV001','TV003','TV004']);
 assert.deepEqual(get(db,sid).rounds[0].participantIds,['TV001','TV002','TV003']);
 db=saveRound(db,sid,null,'TV004',{TV001:6,TV003:4});
 assert.deepEqual(get(db,sid).rounds[1].participantIds,['TV001','TV003','TV004']);
 assert.deepEqual(get(db,sid).memberIds,['TV001','TV002','TV003','TV004']);
 assert.deepEqual([net(db,sid,'TV001'),net(db,sid,'TV002'),net(db,sid,'TV003'),net(db,sid,'TV004')],[24,-10,-24,10]);
 db=changePlayers(db,sid,['TV002','TV003']);
 assert.deepEqual(get(db,sid).rounds[0].participantIds,['TV001','TV002','TV003']);
 assert.deepEqual(get(db,sid).rounds[1].participantIds,['TV001','TV003','TV004']);
});

test('new round is blocked while fewer than two people are active',()=>{
 let {db,sid}=setup();db=changePlayers(db,sid,['TV001']);
 assert.throws(()=>saveRound(db,sid,null,'TV001',{TV002:10}),/2–10/);
 db=changePlayers(db,sid,['TV001','TV002']);
 assert.equal(get(saveRound(db,sid,null,'TV001',{TV002:5}),sid).rounds.length,1);
});

test('old round can be edited after its former opponents have gone offline',()=>{
 let {db,sid}=setup();db=saveRound(db,sid,null,'TV001',{TV002:10,TV003:20});
 const rid=get(db,sid).rounds[0].id;
 db=changePlayers(db,sid,['TV001','TV004']);
 db=saveRound(db,sid,rid,'TV001',{TV002:15,TV003:25});
 assert.equal(net(db,sid,'TV002'),-15);
 assert.equal(net(db,sid,'TV004'),0);
});

test('báo sâm credits the winner +20 for each other participant',()=>{
 let {db,sid}=setup();
 db=saveRound(db,sid,null,'TV002',{}, {kind:'sam'});
 const s=get(db,sid),st=sessionStats(s);
 assert.equal(s.rounds[0].kind,'sam');
 assert.deepEqual(s.rounds[0].losses,{TV001:SAM_LOSS,TV003:SAM_LOSS});
 assert.deepEqual([st.totals.TV001.net,st.totals.TV002.net,st.totals.TV003.net],[-20,40,-20]);
 assert.equal(st.pot,40);
});

test('cháy +15 is included once and cannot be forged below 15',()=>{
 let {db,sid}=setup();
 db=saveRound(db,sid,null,'TV001',{TV002:25,TV003:5},{burnedIds:['TV002']});
 assert.equal(net(db,sid,'TV002'),-25);
 assert.deepEqual(get(db,sid).rounds[0].burnedIds,['TV002']);
 assert.throws(()=>saveRound(db,sid,null,'TV001',{TV002:10},{burnedIds:['TV002']}),/ít nhất 15/);
 assert.equal(BURN_LOSS,15);
});

test('bắt 2 +20/-20 is between catcher and caught, not the winner',()=>{
 let {db,sid}=setup();
 db=saveRound(db,sid,null,'TV001',{TV002:5,TV003:10},{catches:[{fromId:'TV002',toId:'TV003'}]});
 const st=sessionStats(get(db,sid));
 assert.equal(st.totals.TV001.win,15);
 assert.equal(st.totals.TV002.loss,25);
 assert.equal(st.totals.TV003.win,20);
 assert.deepEqual([st.totals.TV001.net,st.totals.TV002.net,st.totals.TV003.net],[15,-25,10]);
 assert.equal(st.pot,35);
 assert.equal(CATCH_TWO,20);
});

test('bắt 2 rejects same member, offline, and duplicate pair',()=>{
 const {db,sid}=setup();
 assert.throws(()=>saveRound(db,sid,null,'TV001',{TV002:5},{catches:[{fromId:'TV002',toId:'TV002'}]}),/hai người khác nhau/);
 assert.throws(()=>saveRound(db,sid,null,'TV001',{TV002:5},{catches:[{fromId:'TV004',toId:'TV002'}]}),/hai người khác nhau/);
 assert.throws(()=>saveRound(db,sid,null,'TV001',{TV002:5},{catches:[{fromId:'TV002',toId:'TV003'},{fromId:'TV002',toId:'TV003'}]}),/trùng/);
});

test('after rotating lineup, Done/Paid netting includes all people who played and catches',()=>{
 let {db,sid}=setup();
 db=saveRound(db,sid,null,'TV001',{TV002:10});
 db=changePlayers(db,sid,['TV003','TV004']);
 db=saveRound(db,sid,null,'TV004',{}, {kind:'sam',catches:[{fromId:'TV003',toId:'TV004'}]});
 assert.deepEqual([net(db,sid,'TV001'),net(db,sid,'TV002'),net(db,sid,'TV003'),net(db,sid,'TV004')],[10,-10,-40,40]);
 db=closeSession(db,sid);
 assert.equal(get(db,sid).status,'done');
 const transfers=settlementSummary(get(db,sid)).transfers;
 assert.equal(transfers.reduce((sum,t)=>sum+t.amount,0),50);
 assert.equal(transfers.some(t=>t.fromId==='TV003'),true);
 for(const t of transfers)db=togglePayment(db,sid,t.id,true);
 assert.equal(get(db,sid).status,'paid');
 assert.equal(monthlyStats(db,'2026-11').pot,50);
});

test('new backup survives prepareImport with frozen roster, báo sâm, cháy and bắt 2',()=>{
 let {db,sid}=setup();
 db=saveRound(db,sid,null,'TV001',{TV002:15},{burnedIds:['TV002'],catches:[{fromId:'TV002',toId:'TV003'}]});
 db=changePlayers(db,sid,['TV002','TV003']);
 db=saveRound(db,sid,null,'TV003',{}, {kind:'sam'});
 assert.equal(isDatabase(db),true);
 const plan=prepareImport(JSON.parse(JSON.stringify(db)));
 assert.deepEqual(plan.sessions[0].activeMemberIds,['TV002','TV003']);
 assert.equal(plan.sessions[0].rounds[0].burnedIds[0],'TV002');
 assert.equal(plan.sessions[0].rounds[0].catches[0].toId,'TV003');
 assert.equal(plan.sessions[0].rounds[1].kind,'sam');
});

test('one session can have 12 people over time but no more than 10 in a round',()=>{
 let db=seed();for(let i=0;i<7;i++)db=createMember(db,`Khách ${i}`);
 const arr=db.members.map(m=>m.id);
 const cr=createSession(db,'2026-11-25',arr.slice(0,10));db=cr.db;
 db=changePlayers(db,cr.session.id,arr.slice(10).concat(arr.slice(0,3)));
 assert.equal(get(db,cr.session.id).memberIds.length,12);
 assert.equal(activePlayers(get(db,cr.session.id)).length,5);
});

test('two phones can append rounds, but stale roster must reject a new round',()=>{
 const {db,sid}=setup();
 const a=saveRound(db,sid,null,'TV001',{TV002:5});
 const b=saveRound(db,sid,null,'TV002',{TV001:8});
 const merged=reconcileChange(diffSingle(db,b),a.sessions[0]);
 assert.equal(merged.rounds.length,2);
 const changed=changePlayers(db,sid,['TV001','TV003']);
 assert.throws(()=>reconcileChange(diffSingle(db,b),get(changed,sid)),/Danh sách người chơi/);
});

test('after the session is Done roster and rounds remain locked',()=>{
 let {db,sid}=setup();db=saveRound(db,sid,null,'TV001',{TV002:5});db=closeSession(db,sid);
 assert.throws(()=>changePlayers(db,sid,['TV002','TV003']),/đã chốt/);
 assert.throws(()=>saveRound(db,sid,null,'TV001',{TV002:5}),/đã chốt/);
});

test('opening a form before roster changed cannot silently charge an offline player',()=>{
 const {db,sid}=setup();
 const original=[...activePlayers(get(db,sid))];
 const updated=changePlayers(db,sid,['TV001','TV003','TV004']);
 assert.throws(()=>saveRound(updated,sid,null,'TV001',{TV002:15,TV003:10},{expectedRoster:original}),/Danh sách người chơi đã thay đổi/);
});

test('roster picker refuses to overwrite a newer lineup from another phone',()=>{
 const {db,sid}=setup();
 const original=[...activePlayers(get(db,sid))];
 const updated=changePlayers(db,sid,['TV001','TV003','TV004']);
 assert.throws(()=>changePlayers(updated,sid,['TV001','TV002'],original),/Danh sách đang chơi đã đổi/);
});

test('editing an already updated round using an old open form is blocked',()=>{
 let {db,sid}=setup();
 db=saveRound(db,sid,null,'TV001',{TV002:10});
 const original=get(db,sid).rounds[0];
 const updated=saveRound(db,sid,original.id,'TV001',{TV002:50});
 assert.throws(()=>saveRound(updated,sid,original.id,'TV001',{TV002:25},{expectedRound:original}),/Ván đã thay đổi/);
});


test('multiple Done sessions on the same day show one read-only aggregate without merging payments',()=>{
 let db=seed();
 const first=createSession(db,'2026-11-25',['TV001','TV002']);db=first.db;
 db=saveRound(db,first.session.id,null,'TV001',{TV002:10});db=closeSession(db,first.session.id);
 const second=createSession(db,'2026-11-25',['TV002','TV003']);db=second.db;
 db=saveRound(db,second.session.id,null,'TV003',{TV002:20});db=closeSession(db,second.session.id);
 const grouped=dailyGroupedStats(db,'2026-11').find(g=>g.date==='2026-11-25');
 assert.equal(grouped.sessions.length,2);assert.equal(grouped.roundCount,2);assert.equal(grouped.pot,30);
 assert.deepEqual([grouped.totals.TV001.net,grouped.totals.TV002.net,grouped.totals.TV003.net],[10,-30,20]);
 assert.equal(db.sessions.length,2);
 assert.deepEqual(db.sessions.map(s=>s.status),['done','done']);
});
