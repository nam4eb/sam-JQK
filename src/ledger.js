/** Sâm JQK business rules, React-independent. Compatible with legacy localStorage backups. */
export const STORE_KEY = 'so-van/mobile-ledger/v1'; // compatible with previous non-React version
export const MAX_MEMBERS = 100;
export const MAX_PLAYERS = 10;
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
export const isDatabase = obj => Boolean(obj && obj.schema===1 && Array.isArray(obj.members) && Array.isArray(obj.sessions) && obj.settings && typeof obj.settings==='object' && obj.members.length <= MAX_MEMBERS && obj.members.every(m=>m && typeof m.id==='string' && m.id.length<80 && typeof m.name==='string' && m.name.length<=100 && typeof m.active==='boolean' && (m.qrImage == null || m.qrImage === '' || (typeof m.qrImage==='string' && m.qrImage.length<=700000 && /^data:image\/(?:png|jpeg|webp);base64,/.test(m.qrImage)))) && obj.sessions.length <= 10000 && obj.sessions.every(s=>s && typeof s.id==='string' && typeof s.date==='string' && /^\d{4}-\d\d-\d\d$/.test(s.date) && Array.isArray(s.memberIds) && s.memberIds.length <= MAX_PLAYERS && Array.isArray(s.rounds) && s.rounds.length<=MAX_ROUNDS && ['active','done','paid'].includes(s.status)));
export function load(){try {const raw=localStorage.getItem(STORE_KEY); if(!raw) return seed(); const obj=JSON.parse(raw); return isDatabase(obj)?obj:seed();}catch{return seed();}}
export function persist(db){localStorage.setItem(STORE_KEY, JSON.stringify({...db,updatedAt:nowIso()}));}
export function memberName(db,mid){return db.members.find(m=>m.id===mid)?.name || '(Thành viên cũ)';}
export function amountWon(round){return round2(Object.values(round.losses||{}).reduce((a,n)=>a+Number(n||0),0));}
export function sessionStats(session){
 const totals={}; session.memberIds.forEach(mid=>totals[mid]={loss:0,win:0,net:0,rounds:0}); let pot=0;
 session.rounds.forEach(r=>{const win=amountWon(r); pot=round2(pot+win);if(!totals[r.winnerId])totals[r.winnerId]={loss:0,win:0,net:0,rounds:0};totals[r.winnerId].win=round2(totals[r.winnerId].win+win); totals[r.winnerId].rounds++;
  Object.entries(r.losses||{}).forEach(([mid,n])=>{if(+n>0){if(!totals[mid])totals[mid]={loss:0,win:0,net:0,rounds:0};totals[mid].loss=round2(totals[mid].loss+Number(n));totals[mid].rounds++;}});
 }); Object.values(totals).forEach(t=>t.net=round2(t.win-t.loss));return {totals,roundCount:session.rounds.length,pot};
}
export const finalStats = s => ['done','paid'].includes(s.status) && s.snapshot ? s.snapshot : sessionStats(s);
export function monthlyStats(db,month){const sessions=db.sessions.filter(s=>['done','paid'].includes(s.status) && s.date.startsWith(month)); const totals={}; let pot=0,rounds=0;
 for(const m of db.members){totals[m.id]={loss:0,win:0,net:0,rounds:0,sessions:0};}
 for(const s of sessions){const st=finalStats(s);pot=round2(pot+st.pot);rounds+=st.roundCount;for(const [mid,x] of Object.entries(st.totals)){if(!totals[mid])totals[mid]={loss:0,win:0,net:0,rounds:0,sessions:0};const t=totals[mid];t.loss=round2(t.loss+x.loss);t.win=round2(t.win+x.win);t.rounds+=x.rounds;if(x.rounds>0)t.sessions++;}}
 Object.values(totals).forEach(t=>t.net=round2(t.win-t.loss));return {sessions,totals,pot,rounds};}
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
 const arr=[...new Set(memberIds)];if(arr.length<2||arr.length>MAX_PLAYERS)throw Error('Chọn từ 2 đến 10 người chơi.');if(arr.some(mid=>!db.members.some(m=>m.id===mid && m.active)))throw Error('Chỉ chọn thành viên đang hoạt động.');
 const t=nowIso();const s={id:id('van'),date,memberIds:arr,rounds:[],status:'active',createdAt:t,updatedAt:t};return {db:{...db,sessions:[s,...db.sessions]},session:s};
}
export function changePlayers(db,sid,memberIds){const s=db.sessions.find(s=>s.id===sid);if(!s||s.status!=='active')throw Error('Ngày đã chốt.');if(s.rounds.length)throw Error('Xóa các ván trước khi đổi danh sách người chơi.');const arr=[...new Set(memberIds)];if(arr.length>MAX_PLAYERS)throw Error('Tối đa 10 người.');if(arr.some(mid=>!db.members.some(m=>m.id===mid && m.active)))throw Error('Thành viên không còn hoạt động.');return {...db,sessions:db.sessions.map(x=>x.id===sid?{...x,memberIds:arr,updatedAt:nowIso()}:x)};}
export function validateRound(session,winnerId,losses){if(!session||session.status!=='active')throw Error('Ngày đã chốt, không thể sửa.');if(!session.memberIds.includes(winnerId))throw Error('Chọn người thắng.');const good={};for(const [mid,v] of Object.entries(losses||{})){
  if(mid===winnerId || !session.memberIds.includes(mid))continue;
  if(v===''||v===null||v===undefined)continue;
  const n=Number(String(v).replace(',','.'));
  if(!Number.isFinite(n)||n<0)throw Error('Tiền thua phải là số không âm.');
  if(n>0){if(n>1e12)throw Error('Giá trị tiền quá lớn.');good[mid]=round2(n);}
 }
 if(Object.keys(good).length<1)throw Error('Cần ít nhất một người thua với số tiền lớn hơn 0.');return good;}
export function saveRound(db,sid,roundId,winnerId,losses){const session=db.sessions.find(s=>s.id===sid);const good=validateRound(session,winnerId,losses);if(!roundId && session.rounds.length>=MAX_ROUNDS)throw Error(`Mỗi ngày tối đa ${MAX_ROUNDS} ván.`);
 if(roundId && !session.rounds.some(r=>r.id===roundId))throw Error('Không tìm thấy ván cần sửa.');const r={id:roundId||id('round'),winnerId,losses:good,createdAt:roundId?(session.rounds.find(x=>x.id===roundId)?.createdAt||nowIso()):nowIso(),updatedAt:nowIso()};
 const rounds=roundId?session.rounds.map(x=>x.id===roundId?r:x):[...session.rounds,r];return {...db,sessions:db.sessions.map(s=>s.id===sid?{...s,rounds,updatedAt:nowIso()}:s)};}
export function deleteRound(db,sid,rid){const s=db.sessions.find(x=>x.id===sid);if(!s||s.status!=='active')throw Error('Không thể sửa ngày đã chốt.');return {...db,sessions:db.sessions.map(x=>x.id===sid?{...x,rounds:x.rounds.filter(r=>r.id!==rid),updatedAt:nowIso()}:x)};}
export function clearSession(db,sid,all=false){const s=db.sessions.find(x=>x.id===sid);if(!s||s.status!=='active')throw Error('Không được xóa dữ liệu đã Done.');return {...db,sessions:db.sessions.map(x=>x.id===sid?{...x,rounds:[],memberIds:all?[]:x.memberIds,updatedAt:nowIso()}:x)};}
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
