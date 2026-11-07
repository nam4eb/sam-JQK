import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,createSession,saveRound,sessionStats,closeSession,monthlyStats,clearSession,createMember,changeMember,autoCloseOld,reportCsv} from './ledger.js';

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
