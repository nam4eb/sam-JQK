/** Pure Firestore model helpers; tested without Firebase or browser APIs. */
import {isDatabase,settlementTransfers,nowIso} from './ledger.js';

export const emptyCloudDb = () => ({schema:1,createdAt:nowIso(),updatedAt:nowIso(),members:[],sessions:[],settings:{unit:'nghìn đồng',archiveDays:7}});

export const canWrite = role => role==='admin'||role==='editor';

function eq(a,b){return JSON.stringify(a)===JSON.stringify(b)}
export function diffSingle(before,after){
 const changes=[];
 for(const kind of ['members','sessions']){
  const prev=new Map(before[kind].map(x=>[x.id,x])),next=new Map(after[kind].map(x=>[x.id,x]));
  for(const [id,val] of next)if(!eq(prev.get(id),val))changes.push({kind,id,previous:prev.get(id),next:val});
  for(const [id,val] of prev)if(!next.has(id))changes.push({kind,id,previous:val,next:null});
 }
 if(!eq(before.settings,after.settings))changes.push({kind:'settings',id:'main',previous:before.settings,next:after.settings});
 if(changes.length!==1)throw new Error('Thao tác phải thay đổi đúng một mục; hãy thử lại.');
 return changes[0];
}
export function normalizeSession(s){
 const payments=Object.fromEntries(Object.entries(s.payments||{}).filter(([,v])=>v===true));
 const transfers=['done','paid'].includes(s.status)?settlementTransfers(s):[];
 const fullyPaid=transfers.every(t=>payments[t.id]===true);
 return {...s,payments,transferIds:transfers.map(t=>t.id),status:s.status==='active'?'active':(fullyPaid?'paid':'done'),paidAt:s.status==='active'||!fullyPaid?null:(s.paidAt||nowIso())};
}
export function matchSnapshot(oldEntity,serverEntity){
 // For preexisting documents, only compare the fields known to the UI. Race detection is explicit.
 return eq(oldEntity,serverEntity);
}

export function legacyFromDevice(key){
 const raw=localStorage.getItem(key);if(!raw)return null;
 try{const data=JSON.parse(raw);return isDatabase(data)?data:null;}catch{return null;}
}
function validDocId(value){return typeof value==='string'&&value.length>0&&value.length<140&&!/[\/]/.test(value)&&value!=='.'&&value!=='..';}
/** Reject malicious / malformed backups before writing any remote documents. */
export function prepareImport(data){
 if(!isDatabase(data))throw Error('File không đúng định dạng backup Sâm JQK.');
 if(data.sessions.length>3000)throw Error('Bản nhập quá lớn (>3000 phiên), cần chuyển đổi theo đợt.');
 const members=data.members.map(m=>{
  if(!validDocId(m.id))throw Error('Mã thành viên không hợp lệ.');
  return {id:m.id,name:m.name,active:m.active,createdAt:m.createdAt||nowIso(),qrImage:m.qrImage||'',updatedAt:nowIso()};
 });
 const known=new Set(members.map(m=>m.id));
 if(known.size!==members.length)throw Error('Trùng mã thành viên.');
 const sessions=data.sessions.map(s=>{
  if(!validDocId(s.id)||s.memberIds.some(mid=>!known.has(mid))||s.memberIds.length<2&&s.rounds.length>0)throw Error('Dữ liệu phiên có thành viên hoặc mã không hợp lệ.');
  for(const r of s.rounds){if(!validDocId(r.id)||!s.memberIds.includes(r.winnerId)||Object.keys(r.losses||{}).some(k=>!s.memberIds.includes(k)||k===r.winnerId||!Number.isFinite(+r.losses[k])||+r.losses[k]<0))throw Error('Có ván không hợp lệ.');}
  const normalized=normalizeSession({...s,createdAt:s.createdAt||nowIso(),updatedAt:s.updatedAt||nowIso()});
  const bytes=new TextEncoder().encode(JSON.stringify(normalized)).byteLength;
  if(bytes>850000)throw Error('Phiên '+s.id+' quá lớn để lưu một document.');
  return normalized;
 });
 if(new Set(sessions.map(s=>s.id)).size!==sessions.length)throw Error('Trùng mã phiên.');
 return {members,sessions,settings:{unit:String(data.settings.unit||'nghìn đồng').slice(0,24),archiveDays:Math.floor(Math.min(365,Math.max(1,Number(data.settings.archiveDays)||7)))}};
}
