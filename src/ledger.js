/** Sâm JQK business rules, React-independent. Compatible with legacy localStorage backups. */
export const STORE_KEY = 'so-van/mobile-ledger/v1'; // compatible with previous non-React version
export const MAX_MEMBERS = 100;
export const MAX_PLAYERS = 10;
export const MAX_SESSION_MEMBERS = 100;
export const SAM_LOSS = 20;
export const BURN_LOSS = 15;
export const CATCH_TWO = 20;
export const MAX_ROUNDS = 200;
export const nowIso = () => new Date().toISOString();
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const localMonth = () => localDate().slice(0,7);
export const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const id = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
export const fmt = num => new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(round2(num || 0));
export const moneyText = num => `${num > 0 ? '+' : ''}${fmt(num)}`;
export const dateLabel = date => /^\d{4}-\d\d-\d\d$/.test(date || '') ? `${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(0,4)}` : '—';
export const monthLabel = month => /^\d{4}-\d\d$/.test(month || '') ? `Tháng ${+month.slice(5)}/${month.slice(0,4)}` : '—';
export const seed = () => ({schema:1,createdAt:nowIso(),updatedAt:nowIso(),members:['Na','Đạt','Công','Long','Bách'].map((name,i)=>({id:`TV${String(i+1).padStart(3,'0')}`,name,active:true,createdAt:nowIso()})),sessions:[],settings:{unit:'nghìn đồng',archiveDays:7}});
export const isDatabase = obj => Boolean(obj && obj.schema===1 && Array.isArray(obj.members) && Array.isArray(obj.sessions) && obj.settings && typeof obj.settings==='object' && obj.members.length <= MAX_MEMBERS && obj.members.every(m=>m && typeof m.id==='string' && m.id.length<80 && typeof m.name==='string' && m.name.length<=100 && typeof m.active==='boolean' && (m.qrImage == null || m.qrImage === '' || (typeof m.qrImage==='string' && m.qrImage.length<=700000 && /^data:image\/(?:png|jpeg|webp);base64,/.test(m.qrImage)))) && obj.sessions.length <= 10000 && obj.sessions.every(s=>s && typeof s.id==='string' && typeof s.date==='string' && /^\d{4}-\d\d-\d\d$/.test(s.date) && Array.isArray(s.memberIds) && s.memberIds.length <= MAX_SESSION_MEMBERS && (!('activeMemberIds' in s) || (Array.isArray(s.activeMemberIds) && s.activeMemberIds.length <= MAX_PLAYERS && s.activeMemberIds.every(mid=>s.memberIds.includes(mid)))) && Array.isArray(s.rounds) && s.rounds.length<=MAX_ROUNDS && ['active','done','paid'].includes(s.status)));
export function load(){try {const raw=localStorage.getItem(STORE_KEY); if(!raw) return seed(); const obj=JSON.parse(raw); return isDatabase(obj)?obj:seed();}catch{return seed();}}
export function persist(db){localStorage.setItem(STORE_KEY, JSON.stringify({...db,updatedAt:nowIso()}));}
export function memberName(db,mid){return db.members.find(m=>m.id===mid)?.name || '(Thành viên cũ)';}
/** Historical rounds keep their own participant list; old backups default to the original roster. */
export const activePlayers = s => Array.isArray(s.activeMemberIds) ? s.activeMemberIds : s.memberIds;
export const roundPlayers = (s,r) => Array.isArray(r.participantIds) ? r.participantIds : s.memberIds;
export function amountWon(round){return round2(Object.values(round.losses||{}).reduce((a,n)=>a+Number(n||0),0));}
export function sessionStats(session){
 const totals={};const ensure=mid=>totals[mid]||(totals[mid]={loss:0,win:0,net:0,rounds:0});
 session.memberIds.forEach(ensure);let pot=0;
 for(const r of session.rounds){
  const participants=roundPlayers(session,r);const counted=new Set();
  const take=(mid,value)=>{if(value<=0)return;const t=ensure(mid);t.loss=round2(t.loss+value);counted.add(mid)};
  const give=(mid,value)=>{if(value<=0)return;const t=ensure(mid);t.win=round2(t.win+value);counted.add(mid)};
  const normal=amountWon(r);give(r.winnerId,normal);pot=round2(pot+normal);
  for(const [mid,n] of Object.entries(r.losses||{}))take(mid,Number(n));
  // Bắt 2 is an independent transfer, never added to the round winner's normal payout.
  for(const c of r.catches||[]){take(c.fromId,CATCH_TWO);give(c.toId,CATCH_TWO);pot=round2(pot+CATCH_TWO);}
  if(Array.isArray(r.participantIds))participants.forEach(mid=>counted.add(mid));
  counted.forEach(mid=>ensure(mid).rounds++);
 }
 Object.values(totals).forEach(t=>t.net=round2(t.win-t.loss));
 return {totals,roundCount:session.rounds.length,pot};
}
export const finalStats = s => ['done','paid'].includes(s.status) && s.snapshot ? s.snapshot : sessionStats(s);
export function monthlyStats(db,month){const sessions=db.sessions.filter(s=>['done','paid'].includes(s.status) && s.date.startsWith(month)); const totals={}; let pot=0,rounds=0;
 for(const m of db.members){totals[m.id]={loss:0,win:0,net:0,rounds:0,sessions:0};}
 for(const s of sessions){const st=finalStats(s);pot=round2(pot+st.pot);rounds+=st.roundCount;for(const [mid,x] of Object.entries(st.totals)){if(!totals[mid])totals[mid]={loss:0,win:0,net:0,rounds:0,sessions:0};const t=totals[mid];t.loss=round2(t.loss+x.loss);t.win=round2(t.win+x.win);t.rounds+=x.rounds;if(x.rounds>0)t.sessions++;}}
 Object.values(totals).forEach(t=>t.net=round2(t.win-t.loss));return {sessions,totals,pot,rounds};}
/** Read-only aggregate of already closed sessions on the same calendar date.
 * It does NOT change individual Done/Paid snapshots or payment confirmations.
 */
export function dailyGroupedStats(db,month){
 const groups=new Map();
 for(const s of db.sessions){
  if(!['done','paid'].includes(s.status)||!s.date.startsWith(month))continue;
  if(!groups.has(s.date))groups.set(s.date,{date:s.date,sessions:[],totals:{},pot:0,roundCount:0});
  const g=groups.get(s.date);const stats=finalStats(s);g.sessions.push(s);
  g.pot=round2(g.pot+stats.pot);g.roundCount+=stats.roundCount;
  for(const [mid,x] of Object.entries(stats.totals)){
   const t=g.totals[mid]||(g.totals[mid]={loss:0,win:0,net:0});
   t.loss=round2(t.loss+x.loss);t.win=round2(t.win+x.win);t.net=round2(t.net+x.net);
  }
 }
 return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
export function yearSummary(db,year){return Array.from({length:12},(_,i)=>{const month=`${year}-${String(i+1).padStart(2,'0')}`;return {month,...monthlyStats(db,month)}});}
export function checkMember(db,name,exceptId){const v=name.trim();if(!v)throw Error('Nhập tên thành viên.');if(v.length>60)throw Error('Tên tối đa 60 ký tự.');if(db.members.some(m=>m.id!==exceptId && m.name.toLocaleLowerCase('vi-VN')===v.toLocaleLowerCase('vi-VN')))throw Error('Tên đã có trong danh sách.');return v;}
export function createMember(db,name,qrImage=''){const normalized=checkMember(db,name);if(qrImage && (typeof qrImage!=='string' || qrImage.length>700000 || !/^data:image\/(?:png|jpeg|webp);base64,/.test(qrImage)))throw Error('Ảnh QR không hợp lệ.');if(db.members.length>=MAX_MEMBERS) throw Error(`Tối đa ${MAX_MEMBERS} thành viên.`);let n=1;while(db.members.some(m=>m.id===`TV${String(n).padStart(3,'0')}`))n++;return {...db,members:[...db.members,{id:`TV${String(n).padStart(3,'0')}`,name:normalized,active:true,qrImage,createdAt:nowIso()}]};}
export function changeMember(db,mid,{name,active,qrImage}){
 const nm=checkMember(db,name,mid);
 if(qrImage !== undefined && qrImage !== null && qrImage !== '' && (typeof qrImage !== 'string' || qrImage.length>700000 || !/^data:image\/(?:png|jpeg|webp);base64,/.test(qrImage)))throw Error('Ảnh QR không hợp lệ.');
 return {...db,members:db.members.map(m=>m.id===mid?{...m,name:nm,active,...(qrImage!==undefined?{qrImage}:{} )}:m)};
}

export function createSession(db,date,memberIds){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00`).valueOf())) throw Error('Chọn ngày chơi hợp lệ.');
 const arr=[...new Set(memberIds)];if(arr.length<2||arr.length>MAX_PLAYERS)throw Error('Chọn từ 2 đến 10 người chơi.');
 if(arr.some(mid=>!db.members.some(m=>m.id===mid && m.active)))throw Error('Chỉ chọn thành viên đang hoạt động.');
 const t=nowIso();const s={id:id('van'),date,memberIds:arr,activeMemberIds:arr,rounds:[],status:'active',createdAt:t,updatedAt:t};
 return {db:{...db,sessions:[s,...db.sessions]},session:s};
}
/** Stable content equality so an open form cannot silently overwrite a newer mobile edit. */
function stableJSON(value){
 if(Array.isArray(value))return '['+value.map(stableJSON).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableJSON(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
/** Update only future rounds. Everyone ever involved stays in memberIds for settlement. */
export function changePlayers(db,sid,selected,expectedActive){
 const s=db.sessions.find(s=>s.id===sid);if(!s||s.status!=='active')throw Error('Ngày đã chốt.');
 if(expectedActive && stableJSON(activePlayers(s))!==stableJSON(expectedActive))throw Error('Danh sách đang chơi đã đổi từ điện thoại khác. Hãy mở lại danh sách.');
 const arr=[...new Set(selected)];if(arr.length>MAX_PLAYERS)throw Error('Mỗi ván tối đa 10 người đang chơi.');
 if(arr.some(mid=>!db.members.some(m=>m.id===mid && m.active)))throw Error('Thành viên không còn hoạt động trong danh sách nhóm.');
 const union=[...new Set([...s.memberIds,...arr])];if(union.length>MAX_SESSION_MEMBERS)throw Error(`Tối đa ${MAX_SESSION_MEMBERS} người từng tham gia một phiên.`);
 // Freeze the roster for old v3 rounds before making the first roster change.
 const rounds=s.rounds.map(r=>Array.isArray(r.participantIds)?r:{...r,participantIds:[...s.memberIds]});
 return {...db,sessions:db.sessions.map(x=>x.id===sid?{...x,memberIds:union,activeMemberIds:arr,rounds,updatedAt:nowIso()}:x)};
}
export function validateRound(session,winnerId,losses,options={}){
 if(!session||session.status!=='active')throw Error('Ngày đã chốt, không thể sửa.');
 const participants=options.participantIds||activePlayers(session);
 if(participants.length<2||participants.length>MAX_PLAYERS||new Set(participants).size!==participants.length||participants.some(mid=>!session.memberIds.includes(mid)))throw Error('Ván cần có 2–10 người tham gia hợp lệ.');
 if(!participants.includes(winnerId))throw Error('Người thắng không thuộc ván này.');
 const kind=options.kind==='sam'?'sam':'normal';
 const burnedIds=kind==='sam'?[]:[...new Set(options.burnedIds||[])];
 if(burnedIds.some(mid=>!participants.includes(mid)||mid===winnerId))throw Error('Người cháy không thuộc danh sách thua của ván.');
 const good={};
 if(kind==='sam'){
  participants.filter(mid=>mid!==winnerId).forEach(mid=>good[mid]=SAM_LOSS);
 }else{
  for(const [mid,v] of Object.entries(losses||{})){
   if(mid===winnerId||!participants.includes(mid))continue;
   if(v===''||v===null||v===undefined)continue;
   const n=Number(String(v).replace(',','.'));
   if(!Number.isFinite(n)||n<0||n>1e12)throw Error('Tiền thua phải là số hợp lệ không âm.');
   if(n>0)good[mid]=round2(n);
  }
  if(burnedIds.some(mid=>(good[mid]||0)<BURN_LOSS))throw Error('Người cháy phải có ít nhất 15 tiền thua.');
 }
 const catches=kind==='sam'?(options.catches||[]):(options.catches||[]);
 if(!Array.isArray(catches)||catches.length>20)throw Error('Danh sách bắt 2 không hợp lệ.');
 const unique=new Set();const cleanCatches=catches.map(c=>{
  const fromId=c.fromId,toId=c.toId;
  if(!participants.includes(fromId)||!participants.includes(toId)||fromId===toId)throw Error('Bắt 2 phải chọn hai người khác nhau đang chơi trong ván.');
  const key=`${fromId}->${toId}`;if(unique.has(key))throw Error('Không được thêm trùng một cặp bắt 2 trong cùng ván.');unique.add(key);
  return {fromId,toId,amount:CATCH_TWO};
 });
 if(Object.keys(good).length===0&&cleanCatches.length===0)throw Error('Cần ít nhất một người thua hoặc một khoản Bắt 2.');
 return {losses:good,kind,burnedIds,catches:cleanCatches,participantIds:[...participants]};
}
export function saveRound(db,sid,roundId,winnerId,losses,options={}){
 const session=db.sessions.find(s=>s.id===sid);
 if(!session||session.status!=='active')throw Error('Ngày đã chốt, không thể sửa.');
 const old=roundId?session.rounds.find(r=>r.id===roundId):null;
 if(roundId&&!old)throw Error('Không tìm thấy ván cần sửa.');
 if(roundId && options.expectedRound && stableJSON(old)!==stableJSON(options.expectedRound))throw Error('Ván đã thay đổi từ điện thoại khác. Hãy mở lại ván trước khi sửa.');
 if(!roundId && options.expectedRoster && stableJSON(activePlayers(session))!==stableJSON(options.expectedRoster))throw Error('Danh sách người chơi đã thay đổi từ điện thoại khác. Hãy mở lại form nhập ván.');
 if(!roundId&&session.rounds.length>=MAX_ROUNDS)throw Error(`Mỗi ngày tối đa ${MAX_ROUNDS} ván.`);
 const good=validateRound(session,winnerId,losses,{...options,participantIds:old?roundPlayers(session,old):activePlayers(session)});
 const r={id:roundId||id('round'),winnerId,...good,createdAt:old?.createdAt||nowIso(),updatedAt:nowIso()};
 const rounds=roundId?session.rounds.map(x=>x.id===roundId?r:x):[...session.rounds,r];
 return {...db,sessions:db.sessions.map(s=>s.id===sid?{...s,rounds,updatedAt:nowIso()}:s)};
}
export function deleteRound(db,sid,rid){const s=db.sessions.find(x=>x.id===sid);if(!s||s.status!=='active')throw Error('Không thể sửa ngày đã chốt.');return {...db,sessions:db.sessions.map(x=>x.id===sid?{...x,rounds:x.rounds.filter(r=>r.id!==rid),updatedAt:nowIso()}:x)};}
export function clearSession(db,sid,all=false){const s=db.sessions.find(x=>x.id===sid);if(!s||s.status!=='active')throw Error('Không được xóa dữ liệu đã Done.');return {...db,sessions:db.sessions.map(x=>x.id===sid?{...x,rounds:[],memberIds:all?[]:x.memberIds,activeMemberIds:all?[]:activePlayers(x),updatedAt:nowIso()}:x)};}
export function removeEmptySession(db,sid){const s=db.sessions.find(x=>x.id===sid);if(!s||s.status!=='active'||s.rounds.length)throw Error('Chỉ được xóa ngày Active chưa có ván.');return {...db,sessions:db.sessions.filter(x=>x.id!==sid)};}
export function closeSession(db,sid,auto=false){
 const s=db.sessions.find(x=>x.id===sid);
 if(!s||s.status!=='active')throw Error('Ngày đã chốt.');
 if(!s.rounds.length)throw Error('Cần nhập ít nhất một ván trước khi chốt.');
 const snapshot=sessionStats(s);
 const transfers=settlementTransfers({...s,snapshot,status:'done'});
 const completed=transfers.length===0;
 return {...db,sessions:db.sessions.map(x=>x.id===sid?{...x,status:completed?'paid':'done',snapshot,payments:{},transferIds:transfers.map(t=>t.id),paidAt:completed?nowIso():null,closedAt:nowIso(),autoClosed:auto,updatedAt:nowIso()}:x)};
}

/** Split net balances into specific debtor-to-creditor amounts; stable based on session player order. */
export function settlementTransfers(s){
 const totals=finalStats(s).totals;
 const debtors=s.memberIds.map(mid=>({mid,amount:round2(Math.max(0,-(totals[mid]?.net||0)))})).filter(x=>x.amount>0);
 const creditors=s.memberIds.map(mid=>({mid,amount:round2(Math.max(0,totals[mid]?.net||0))})).filter(x=>x.amount>0);
 let i=0,j=0;
 const transfers=[];
 while(i<debtors.length&&j<creditors.length){
  const debtor=debtors[i],creditor=creditors[j];
  const amount=round2(Math.min(debtor.amount,creditor.amount));
  if(amount<=0)break;
  transfers.push({id:`${debtor.mid}->${creditor.mid}`,fromId:debtor.mid,toId:creditor.mid,amount});
  debtor.amount=round2(debtor.amount-amount);creditor.amount=round2(creditor.amount-amount);
  if(debtor.amount<=0)i++; if(creditor.amount<=0)j++;
 }
 return transfers;
}
export function settlementSummary(s){
 const transfers=settlementTransfers(s);
 const completed=transfers.filter(t=>s.payments?.[t.id]===true).length;
 return {transfers,completed,total:transfers.length,allPaid:completed===transfers.length};
}
export function togglePayment(db,sid,transferId,checked){
 const s=db.sessions.find(x=>x.id===sid);
 if(!s||!['done','paid'].includes(s.status))throw Error('Cần chốt Done trước khi xác nhận chuyển tiền.');
 const transfers=settlementTransfers(s);
 if(!transfers.some(x=>x.id===transferId))throw Error('Không tìm thấy khoản chuyển tiền.');
 const payments={...s.payments};if(checked)payments[transferId]=true;else delete payments[transferId];
 const allPaid=transfers.every(t=>payments[t.id]===true);
 return {...db,sessions:db.sessions.map(x=>x.id===sid?{...x,payments,status:allPaid?'paid':'done',paidAt:allPaid?nowIso():null,updatedAt:nowIso()}:x)};
}

export function autoCloseOld(db,now=Date.now()){const n=Math.min(365,Math.max(1,Number(db.settings.archiveDays)||7));let count=0;let copy=db;for(const s of db.sessions){if(s.status==='active'&&s.rounds.length>0&&s.createdAt&&now-new Date(s.createdAt).getTime()>=n*86400000){copy=closeSession(copy,s.id,true);count++;}}return {db:copy,count};}
export function setSettings(db,settings){return {...db,settings:{...db.settings,...settings}};}
export function restoreJSON(text){const data=JSON.parse(text);if(!isDatabase(data))throw Error('File không phải dữ liệu Sâm JQK hợp lệ.');return data;}
export function escapeCSV(value){let t=String(value??'');if(/^[=+@\-\t\r]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';}
export function reportCsv(db,month){const rep=monthlyStats(db,month);const rows=[['Tháng',month],['Tên','Mã TV','Tiền thua','Tiền thắng','Lãi/lỗ ròng','Số ván','Số phiên']];
 for(const m of db.members){const t=rep.totals[m.id];if(!t || !t.sessions)continue;rows.push([m.name,m.id,t.loss,t.win,t.net,t.rounds,t.sessions]);}
 rows.push([],['Ngày chơi','Mã phiên','Người chơi','Thua','Thắng','Ròng','Ván']);
 for(const s of rep.sessions){const st=finalStats(s);for(const [mid,t] of Object.entries(st.totals)){if(!t.rounds)continue;rows.push([s.date,s.id,memberName(db,mid),t.loss,t.win,t.net,t.rounds]);}}
 return '\ufeff'+rows.map(row=>row.map(escapeCSV).join(',')).join('\r\n');}
