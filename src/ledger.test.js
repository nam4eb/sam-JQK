import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,createSession,saveRound,sessionStats,closeSession,monthlyStats,clearSession,createMember,changeMember,autoCloseOld,reportCsv,settlementSummary,togglePayment,isDatabase} from './ledger.js';

test('round is zero sum, winner takes losses and report updates only after Done',()=>{
 let db=seed();const {db:b,session}=createSession(db,'2026-11-07',['TV001','TV002','TV003']);db=b;
 db=saveRound(db,session.id,null,'TV001',{TV002:10,TV003:20});
 const s=db.sessions[0];assert.equal(sessionStats(s).pot,30);assert.equal(sessionStats(s).totals.TV001.net,30);assert.equal(sessionStats(s).totals.TV002.net,-10);
 assert.equal(monthlyStats(db,'2026-11').pot,0);
 db=closeSession(db,session.id);assert.equal(monthlyStats(db,'2026-11').pot,30);assert.equal(monthlyStats(db,'2026-11').totals.TV003.loss,20);
 assert.throws(()=>clearSession(db,session.id),/Done/);
 db=changeMember(db,'TV001',{name:'Na mới',active:false});assert.equal(monthlyStats(db,'2026-11').totals.TV001.net,30);
 assert.match(reportCsv(db,'2026-11'),/Na mới/);
});
test('editing a round replaces totals, not duplicates',()=>{
 let db=seed();const x=createSession(db,'2026-10-28',['TV001','TV002']);db=x.db;db=saveRound(db,x.session.id,null,'TV001',{TV002:10});const r=db.sessions[0].rounds[0];db=saveRound(db,x.session.id,r.id,'TV002',{TV001:12});assert.equal(sessionStats(db.sessions[0]).pot,12);assert.equal(sessionStats(db.sessions[0]).totals.TV001.net,-12);
});
test('autoclose preserves history and leaves empty sessions active',()=>{
 let db=seed();const a=createSession(db,'2026-10-10',['TV001','TV002']);db=a.db;const b=createSession(db,'2026-10-10',['TV001','TV002']);db=b.db;db=saveRound(db,a.session.id,null,'TV001',{TV002:5});db.sessions.find(s=>s.id===a.session.id).createdAt='2026-10-20T00:00:00Z';db.sessions.find(s=>s.id===b.session.id).createdAt='2026-10-20T00:00:00Z';const result=autoCloseOld(db,Date.parse('2026-11-07T00:00:00Z'));assert.equal(result.count,1);assert.equal(result.db.sessions.find(s=>s.id===a.session.id).status,'done');assert.equal(result.db.sessions.find(s=>s.id===b.session.id).status,'active');
});
test('limits and unique roster member names',()=>{
 let db=seed();assert.throws(()=>createMember(db,'Na'),/đã có/);db=createMember(db,'Người mới');assert.equal(db.members.length,6);
 assert.throws(()=>createSession(db,'2026-11-07',['TV001']),/2 đến 10/);
});

test('Done creates debtor-to-winner transfers and Paid only after every confirmation',()=>{
 let db=seed();const a=createSession(db,'2026-11-07',['TV001','TV002','TV003']);db=a.db;
 db=saveRound(db,a.session.id,null,'TV001',{TV002:10,TV003:20});
 db=closeSession(db,a.session.id);
 let s=db.sessions[0];assert.equal(s.status,'done');
 assert.deepEqual(settlementSummary(s).transfers.map(t=>[t.fromId,t.toId,t.amount]),[['TV002','TV001',10],['TV003','TV001',20]]);
 assert.equal(settlementSummary(s).total,2);
 db=togglePayment(db,a.session.id,'TV002->TV001',true);
 assert.equal(db.sessions[0].status,'done');assert.equal(settlementSummary(db.sessions[0]).completed,1);
 db=togglePayment(db,a.session.id,'TV003->TV001',true);
 assert.equal(db.sessions[0].status,'paid');assert.ok(db.sessions[0].paidAt);
 assert.equal(monthlyStats(db,'2026-11').pot,30);
 db=togglePayment(db,a.session.id,'TV002->TV001',false);
 assert.equal(db.sessions[0].status,'done');assert.equal(db.sessions[0].paidAt,null);
 assert.equal(monthlyStats(db,'2026-11').pot,30);
 assert.throws(()=>togglePayment(db,a.session.id,'not-a-transfer',true),/không tìm thấy/i);
});

test('netting multiple winners creates exact individual transfers without duplication',()=>{
 let db=seed();const a=createSession(db,'2026-11-07',['TV001','TV002','TV003','TV004']);db=a.db;
 db=saveRound(db,a.session.id,null,'TV001',{TV003:20,TV004:20});
 db=saveRound(db,a.session.id,null,'TV002',{TV001:5,TV003:5,TV004:10});
 db=closeSession(db,a.session.id);
 const transfers=settlementSummary(db.sessions[0]).transfers;
 const stats=sessionStats(db.sessions[0]).totals;
 assert.equal(stats.TV001.net,35);assert.equal(stats.TV002.net,20);
 assert.equal(stats.TV003.net,-25);assert.equal(stats.TV004.net,-30);
 assert.deepEqual(transfers.map(t=>[t.fromId,t.toId,t.amount]),[['TV003','TV001',25],['TV004','TV001',10],['TV004','TV002',20]]);
 assert.equal(transfers.reduce((a,t)=>a+t.amount,0),55);
});

test('old Done backups are accepted; rename and member QR remain available in paid sessions',()=>{
 let db=seed();const a=createSession(db,'2026-11-07',['TV001','TV002']);db=a.db;
 db=saveRound(db,a.session.id,null,'TV001',{TV002:12});db=closeSession(db,a.session.id);
 const old=structuredClone(db);delete old.sessions[0].payments;delete old.members[0].qrImage;
 assert.equal(isDatabase(old),true);
 const qr='data:image/png;base64,iVBORw0KGgo=';
 db=changeMember(db,'TV001',{name:'Na new',active:true,qrImage:qr});
 assert.equal(db.members[0].qrImage,qr);
 db=togglePayment(db,a.session.id,'TV002->TV001',true);
 assert.equal(isDatabase(db),true);
 assert.equal(db.members[0].name,'Na new');assert.equal(monthlyStats(db,'2026-11').totals.TV001.net,12);
 db=changeMember(db,'TV001',{name:'Na new',active:true,qrImage:''});assert.equal(db.members[0].qrImage,'');
});

test('net-zero session immediately becomes Paid with no debt and active sessions cannot receive payments',()=>{
 let db=seed();const a=createSession(db,'2026-11-07',['TV001','TV002']);db=a.db;
 assert.throws(()=>togglePayment(db,a.session.id,'TV002->TV001',true),/Cần chốt Done/);
 db=saveRound(db,a.session.id,null,'TV001',{TV002:10});
 db=saveRound(db,a.session.id,null,'TV002',{TV001:10});
 db=closeSession(db,a.session.id);
 assert.equal(db.sessions[0].status,'paid');assert.equal(settlementSummary(db.sessions[0]).total,0);
 assert.equal(monthlyStats(db,'2026-11').rounds,2);
 assert.throws(()=>closeSession(db,a.session.id),/đã chốt/);
});
