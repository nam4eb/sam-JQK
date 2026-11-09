import React,{useCallback,useEffect,useRef,useState} from 'react';
import {onAuthStateChanged,signInWithPopup,signOut} from 'firebase/auth';
import {collection,onSnapshot} from 'firebase/firestore';
import {auth,firestore,googleProvider,configured} from './firebase.js';
import {accessRef,watchGroup,emptyCloudDb,commitMutation,importLegacy,ensureMeta,grantAccess,revokeAccess,canWrite,legacyFromDevice,GROUP_ID} from './cloud.js';
import {STORE_KEY,closeSession} from './ledger.js';
import LedgerUI from './App.jsx';

export default function CloudShell(){
 const [user,setUser]=useState(undefined),[access,setAccess]=useState(undefined),[db,setDb]=useState(emptyCloudDb),[meta,setMeta]=useState({mode:'ready'}),[ready,setReady]=useState(false);
 const [memberships,setMemberships]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const latest=useRef(db);latest.current=db;
 useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,u=>{setUser(u);setAccess(undefined);setReady(false)},e=>setError(e.message));},[]);
 useEffect(()=>{if(!user||!firestore)return;return onSnapshot(accessRef(firestore,user.uid),snap=>setAccess(snap.exists()?snap.data():null),e=>setError('Không kiểm tra được quyền truy cập: '+e.message));},[user?.uid]);
 const role=access?.active===true?access.role:null;
 useEffect(()=>{if(!role||!firestore){setReady(false);return;}
  const stop=watchGroup(firestore,r=>{latest.current=r.db;setDb(r.db);setMeta(r.meta);setReady(true)},e=>setError('Lỗi đồng bộ Firestore: '+e.message));
  // Only an admin can bootstrap the shared metadata document. All other content remains private.
  if(role==='admin')ensureMeta(firestore).catch(e=>setError('Không khởi tạo được sổ: '+e.message));
  return ()=>{stop();setReady(false)};
 },[role]);
 useEffect(()=>{if(role!=='admin'||!firestore)return;return onSnapshot(collection(firestore,'groups',GROUP_ID,'access'),s=>setMemberships(s.docs.map(d=>d.data()).sort((a,b)=>(a.email||'').localeCompare(b.email||''))),e=>setError('Không đọc được danh sách quyền: '+e.message));},[role]);
 const mutate=useCallback(async fn=>{
  if(!canWrite(role))throw Error('Chỉ Admin và Editor được sửa sổ.');
  if(meta.mode!=='ready')throw Error('Sổ đang khởi tạo hoặc chuyển dữ liệu, chưa thể chỉnh sửa.');
  return await commitMutation(firestore,latest.current,fn,user.uid);
 },[role,meta.mode,user?.uid]);
 const migrate=useCallback(async data=>{
  if(role!=='admin')throw Error('Chỉ Admin được chuyển dữ liệu cũ lên cloud.');
  if(busy)throw Error('Đang có tác vụ xử lý.');
  setBusy(true);setProgress('Đang kiểm tra bản sao lưu…');
  try{const r=await importLegacy(firestore,data,user.uid,(done,total)=>setProgress(`Đã ghi ${done}/${total} mục vào Firestore`));setProgress(`Hoàn tất: ${r.members} thành viên, ${r.sessions} phiên.`);return r;}finally{setBusy(false)}
 },[role,user?.uid,busy]);
 const grant=useCallback(async info=>{if(role!=='admin')throw Error('Chỉ Admin được cấp quyền.');await grantAccess(firestore,info,user.uid)},[role,user?.uid]);
 const revoke=useCallback(async uid=>{if(role!=='admin')throw Error('Chỉ Admin được thu hồi quyền.');await revokeAccess(firestore,uid,user.uid)},[role,user?.uid]);
 useEffect(()=>{if(!ready||!canWrite(role)||meta.mode!=='ready')return;
  let checking=false;
  const run=async()=>{
   if(checking||!navigator.onLine)return;checking=true;
   try{const state=latest.current;const days=Math.max(1,Math.min(365,+state.settings.archiveDays||7));
    const expired=state.sessions.filter(s=>s.status==='active'&&s.rounds?.length>0&&Date.now()-new Date(s.createdAt).getTime()>=days*86400000);
    for(const s of expired.slice(0,10)){
     try{await commitMutation(firestore,latest.current,d=>closeSession(d,s.id,true),user.uid)}catch{ /* Another device may have closed it first. */ }
    }
   }finally{checking=false}
  };
  const t=setInterval(run,90000);run();return()=>clearInterval(t);
 },[ready,role,meta.mode,user?.uid]);
 if(!configured)return <Gate title="Cần cấu hình Firebase" text="Source React đã có sẵn Firebase nhưng chưa có thông số Web App. Tạo project Spark và khai báo 4 biến FIREBASE_* trong GitHub Actions → Variables theo file FIREBASE_SETUP.md."/>;
 if(user===undefined)return <Gate title="Đang mở Sâm JQK" text="Đang kiểm tra đăng nhập Google…"/>;
 if(user===null)return <Login onLogin={async()=>{setBusy(true);setError('');try{await signInWithPopup(auth,googleProvider)}catch(e){setError(e.message)}finally{setBusy(false)}}} error={error} busy={busy}/>;
 if(access===undefined)return <Gate title="Đang kiểm tra quyền" text={`Đã đăng nhập ${user.email}, đang tải danh sách thành viên được phép truy cập…`}/>;
 if(!role)return <Gate title="Tài khoản chưa được duyệt" text={`Đã đăng nhập: ${user.email}. Nhờ Admin thêm UID bên dưới vào danh sách truy cập (role Editor hoặc Viewer). Đăng nhập Google không tự cấp quyền xem tiền của nhóm.`} user={user} onLogout={()=>signOut(auth)} error={error}/>;
 if(!ready)return <Gate title="Đang đồng bộ Firestore" text="Đang tải thành viên, phiên chơi và cấu hình chung…" user={user} onLogout={()=>signOut(auth)} error={error}/>;
 if(meta.mode==='setup')return <Gate title="Đang khởi tạo sổ nhóm" text={role==='admin'?'Tài khoản Admin đang tạo cấu hình Firestore lần đầu…':'Chưa có cấu hình nhóm. Nhờ Admin đăng nhập để khởi tạo.'} user={user} onLogout={()=>signOut(auth)} error={error}/>;
 return <><LedgerUI db={db} mutate={mutate} importCloud={migrate} role={role} user={user} memberships={memberships} grant={grant} revoke={revoke} signOut={()=>signOut(auth)} legacy={legacyFromDevice(STORE_KEY)} busy={busy} progress={progress}/>{error&&<div className="cloud-error-banner" role="alert">{error} <button onClick={()=>setError('')}>Đóng</button></div>}{meta.mode==='migrating'&&<div className="cloud-error-banner">Sổ đang chuyển dữ liệu. {progress||'Chỉ Admin được ghi cho đến khi hoàn tất.'}</div>}</>;
}
function Gate({title,text,user,onLogout,error}){return <div className="auth-screen"><div className="auth-card"><div className="auth-logo">SJ<span>.</span></div><h1>{title}</h1><p>{text}</p>{user&&<><div className="uid-box"><small>Firebase UID của bạn</small><code>{user.uid}</code><button className="btn outline compact" onClick={()=>navigator.clipboard.writeText(user.uid)}>Sao chép UID</button></div><p><small>{user.email}</small></p></>}{error&&<p className="auth-error">{error}</p>}{onLogout&&<button className="btn outline" onClick={onLogout}>Đổi tài khoản Google</button>}</div></div>}
function Login({onLogin,error,busy}){return <div className="auth-screen"><div className="auth-card"><div className="auth-logo">SJ<span>.</span></div><span className="eyebrow">SỔ CHƠI CHUNG · NHÓM BẠN</span><h1>Sâm JQK</h1><p>Tính tiền từng ván, đối soát chuyển khoản và xem kết quả chung trên mọi điện thoại.</p><button disabled={busy} className="btn primary auth-login" onClick={onLogin}>{busy?'Đang mở Google…':'Đăng nhập bằng Google'}</button><p className="auth-hint">Chỉ tài khoản được Admin cấp quyền mới xem và sửa sổ. Điện thoại cần kết nối Internet.</p>{error&&<p className="auth-error">{error}</p>}</div></div>}
