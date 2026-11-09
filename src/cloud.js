/** Firestore gateway: one document per player and per session; transactions prevent lost writes. */
import { doc, collection, onSnapshot, runTransaction, writeBatch, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { nowIso } from './ledger.js';
import { emptyCloudDb, canWrite, diffSingle, normalizeSession, prepareImport } from './cloud-model.js';
import { generateInviteToken, INVITE_RE, INVITE_TTL_DAYS } from './invites.js';
import { reconcileChange } from './concurrency.js';
export { emptyCloudDb, canWrite, legacyFromDevice } from './cloud-model.js';

export const GROUP_ID = 'sam-jqk';
const ROOT = ['groups', GROUP_ID];
const mainRef = db => doc(db,...ROOT,'meta','main');
const settingsRef = db => doc(db,...ROOT,'config','main');
export const accessRef = (db,uid) => doc(db,...ROOT,'access',uid);
export const playerRef = (db,id) => doc(db,...ROOT,'members',id);
export const sessionRef = (db,id) => doc(db,...ROOT,'sessions',id);
export const inviteRef = (db,token) => doc(db,...ROOT,'invites',token);

/** Admin creates a random one-time link. The token is never used as a Firebase login secret. */
export async function createInvite(db,adminUid) {
 const token=generateInviteToken();
 await setDoc(inviteRef(db,token),{
  createdAt:serverTimestamp(), createdBy:adminUid,
  expiresAt:Timestamp.fromMillis(Date.now()+INVITE_TTL_DAYS*86400000),
 });
 return token;
}
export async function revokeInvite(db,token){
 if(!INVITE_RE.test(token))throw Error('Mã lời mời không hợp lệ.');
 await deleteDoc(inviteRef(db,token));
}
/** Atomic one-use redemption: self-access and invite claim must be committed together. */
export async function redeemInvite(db,token,user){
 if(!INVITE_RE.test(token))throw Error('Link mời không hợp lệ. Hãy nhờ Admin tạo link mới.');
 if(!user?.uid)throw Error('Cần đăng nhập Google trước khi nhận lời mời.');
 const invite=inviteRef(db,token),access=accessRef(db,user.uid);
 return runTransaction(db,async tx=>{
  const [inv,existing]=await Promise.all([tx.get(invite),tx.get(access)]);
  if(existing.exists())return 'already-member';
  if(!inv.exists())throw Error('Link mời không tồn tại hoặc đã bị thu hồi.');
  const data=inv.data();
  if(data.claimedBy||!data.expiresAt||data.expiresAt.toMillis()<=Date.now())throw Error('Link đã được sử dụng hoặc hết hạn. Hãy nhờ Admin tạo link mới.');
  tx.set(access,{
   uid:user.uid,email:user.email||'',role:'member',active:true,inviteId:token,joinedAt:serverTimestamp(),
  });
  tx.update(invite,{claimedBy:user.uid,claimedAt:serverTimestamp()});
  return 'joined';
 });
}


export function watchGroup(firestore,onData,onError){
 const data={members:[],sessions:[],settings:{unit:'nghìn đồng',archiveDays:7},meta:{mode:'setup'}};
 const ready=new Set(); const emit=k=>{ready.add(k);if(ready.size===4)onData({db:{...emptyCloudDb(),members:data.members,sessions:data.sessions,settings:data.settings},meta:data.meta})};
 const handles=[
  onSnapshot(collection(firestore,...ROOT,'members'),s=>{data.members=s.docs.map(d=>d.data()).sort((a,b)=>a.name.localeCompare(b.name,'vi'));emit('m')},onError),
  onSnapshot(collection(firestore,...ROOT,'sessions'),s=>{data.sessions=s.docs.map(d=>d.data()).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));emit('s')},onError),
  onSnapshot(settingsRef(firestore),s=>{data.settings={unit:'nghìn đồng',archiveDays:7,...(s.data()||{})};emit('c')},onError),
  onSnapshot(mainRef(firestore),s=>{data.meta=s.data()||{mode:'setup'};emit('x')},onError)
 ];
 return ()=>handles.forEach(f=>f());
}

/** All ordinary UI mutations are one-document Firestore transactions. Never write whole database. */
export async function commitMutation(firestore,before,action,actorUid){
 const after=action(before); const change=diffSingle(before,after);
 if(change.kind==='members' && change.next && JSON.stringify(change.next).length>850000)throw new Error('Ảnh QR quá lớn để lưu trong Firestore.');
 const ref=change.kind==='settings'?settingsRef(firestore):change.kind==='members'?playerRef(firestore,change.id):sessionRef(firestore,change.id);
 await runTransaction(firestore,async tx=>{
  const [meta,snap]=await Promise.all([tx.get(mainRef(firestore)),tx.get(ref)]);
  if(meta.exists() && meta.data()?.mode==='migrating')throw Error('Sổ đang chuyển dữ liệu, chưa thể chỉnh sửa.');
  // Rebase safe edits (distinct rounds or transfers) on the latest Firestore version.
  // Firestore itself retries this transaction if another write races the commit.
  const nextValue=reconcileChange(change,snap.exists()?snap.data():undefined);
  if(nextValue===null){tx.delete(ref);return;}
  const next={...nextValue,updatedAt:nowIso(),updatedBy:actorUid};
  if(change.kind==='sessions')Object.assign(next,normalizeSession(next));
  if(change.kind==='settings')delete next.schema;
  tx.set(ref,next);
 });
 return change;
}

async function fingerprint(data){const b=new TextEncoder().encode(JSON.stringify(data));const d=await crypto.subtle.digest('SHA-256',b);return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,'0')).join('');}
/** Admin-only, idempotently resumable migration. Source localStorage is not altered. */
export async function importLegacy(firestore,data,uid,onProgress=()=>{}){
 const planned=prepareImport(data);const importId=await fingerprint(data);
 const meta=mainRef(firestore);const [members,sessions]=await Promise.all([getDocs(collection(firestore,...ROOT,'members')),getDocs(collection(firestore,...ROOT,'sessions'))]);
 const state=(await getDoc(meta)).data();
 if(state?.mode!=='migrating' && (!members.empty||!sessions.empty))throw Error('Sổ Firestore đã có dữ liệu. Để tránh ghi đè, chỉ nhập vào sổ trống.');
 if(state?.mode==='migrating'&&(state.migrationId!==importId||state.migrationOwner!==uid))throw Error('Có phiên chuyển dữ liệu khác chưa hoàn thành. Hãy dùng đúng bản sao lưu và tài khoản ban đầu.');
 await runTransaction(firestore,async tx=>{
  const snap=await tx.get(meta);const value=snap.data();
  if(value?.mode==='migrating' && (value.migrationId!==importId||value.migrationOwner!==uid))throw Error('Có tiến trình chuyển dữ liệu khác.');
  tx.set(meta,{mode:'migrating',migrationId:importId,migrationOwner:uid,startedAt:value?.startedAt||nowIso()});
 });
 const operations=[...planned.members.map(x=>({ref:playerRef(firestore,x.id),value:x})),...planned.sessions.map(x=>({ref:sessionRef(firestore,x.id),value:x})),{ref:settingsRef(firestore),value:planned.settings}];
 // max 5 docs per batch, protecting the 10 MiB batch cap even with large base64 QR images.
 for(let i=0;i<operations.length;i+=5){const batch=writeBatch(firestore);for(const op of operations.slice(i,i+5))batch.set(op.ref,op.value);await batch.commit();onProgress(Math.min(i+5,operations.length),operations.length)}
 await setDoc(meta,{mode:'ready',migrationId:importId,migratedAt:nowIso(),migrationOwner:uid,memberCount:planned.members.length,sessionCount:planned.sessions.length});
 return {members:planned.members.length,sessions:planned.sessions.length};
}

export async function ensureMeta(firestore){
 const ref=mainRef(firestore);await runTransaction(firestore,async tx=>{const snap=await tx.get(ref);if(!snap.exists())tx.set(ref,{mode:'ready',createdAt:nowIso()});});
}
export async function grantAccess(firestore,{uid,email,role,active=true},actorUid){
 const clean=uid.trim();if(!/^[a-zA-Z0-9:_-]{10,128}$/.test(clean))throw Error('UID không hợp lệ. Hãy sao chép UID từ trang đăng nhập.');
 if(!['admin','editor','viewer','member'].includes(role))throw Error('Vai trò không hợp lệ.');
 if(clean===actorUid&&(!active||role!=='admin'))throw Error('Không thể tự gỡ quyền Admin của chính mình.');
 await setDoc(accessRef(firestore,clean),{uid:clean,role,active,email:(email||'').trim().slice(0,150),updatedAt:nowIso()},{merge:true});
}
export async function revokeAccess(firestore,uid,actorUid){
 if(uid===actorUid)throw Error('Không thể tự xóa quyền truy cập của chính mình.');
 await deleteDoc(accessRef(firestore,uid));
}
