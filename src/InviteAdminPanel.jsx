import React,{useEffect,useMemo,useState} from 'react';
import {inviteIsReusable,inviteLink,inviteValidUntil,INVITE_TTL_MINUTES} from './invites.js';

function timeOf(value){
 if(!Number.isFinite(value))return '—';
 return new Date(value).toLocaleString('vi-VN');
}
function remaining(deadline,now){
 const sec=Math.max(0,Math.ceil((deadline-now)/1000));
 if(sec===0)return 'Đã hết hạn';
 return `${Math.floor(sec/60)} phút ${sec%60} giây`;
}
function CopyLink({url}){
 const [copied,setCopied]=useState(false);
 return <button type="button" className="btn outline compact" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true)}catch{window.prompt('Sao chép link này:',url)}}}>{copied?'Đã sao chép':'Sao chép link'}</button>;
}
export default function InviteAdminPanel({invites,onCreate,onRevoke}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[newUrl,setNewUrl]=useState('');
 const [clock,setClock]=useState(Date.now());
 useEffect(()=>{const t=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(t)},[]);
 const active=useMemo(()=>invites.filter(i=>inviteIsReusable(i,clock)).sort((a,b)=>((b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))),[invites,clock]);
 const create=async()=>{setBusy(true);setError('');try{const token=await onCreate();setNewUrl(inviteLink(token,window.location.origin,import.meta.env.BASE_URL));}catch(e){setError(e.message||'Không tạo được link mời.')}finally{setBusy(false)}};
 const revoke=async token=>{if(!window.confirm('Thu hồi link mời này? Người chưa tham gia sẽ không thể dùng link để vào nhóm.'))return;setBusy(true);setError('');try{await onRevoke(token);setNewUrl('')}catch(e){setError(e.message||'Không thu hồi được link.')}finally{setBusy(false)}};
 return <section className="settings-card card gap-above invite-card">
  <h3>Link mời thành viên</h3>
  <p>Admin tạo <b>một link dùng chung cho nhiều người</b> trong vòng <b>{INVITE_TTL_MINUTES} phút</b>. Mỗi người mở link, đăng nhập Google và tự nhận quyền <b>Member</b>; không cần gửi UID.</p>
  <button type="button" className="btn primary" disabled={busy} onClick={create}>Tạo link mời 1 giờ</button>
  {newUrl&&<div className="invite-link-box"><label htmlFor="invite-created-link">Link mời vừa tạo</label><input id="invite-created-link" aria-label="Link mời" readOnly value={newUrl} onFocus={e=>e.target.select()}/><CopyLink url={newUrl}/><small>Có thể gửi cùng một link cho tất cả bạn bè trong 1 giờ. Mỗi người phải đăng nhập bằng tài khoản Google riêng.</small></div>}
  {error&&<p className="auth-error" role="alert">{error}</p>}
  <h4>Link còn hiệu lực ({active.length})</h4>
  {active.length===0?<p className="muted-inline">Chưa có link mời đang hoạt động. Các link cũ dùng một lần sẽ không hoạt động lại.</p>:<div className="invite-list">{active.map(i=>{
    const url=inviteLink(i.id,window.location.origin,import.meta.env.BASE_URL);
    const deadline=inviteValidUntil(i);
    return <div className="invite-list-item" key={i.id}><div><strong>Member · Dùng được cho nhiều người</strong><small>Hết hạn: {timeOf(deadline)} · Còn {remaining(deadline,clock)}</small></div><div className="invite-list-actions"><CopyLink url={url}/><button type="button" className="btn outline compact" disabled={busy} onClick={()=>revoke(i.id)}>Thu hồi</button></div></div>
  })}</div>}
  <p className="settings-warning">Ai có link trong thời hạn đều có thể tự nhận quyền Member. Chỉ gửi trong nhóm tin cậy. Hết hạn/thu hồi link không xóa quyền của người đã tham gia; Admin gỡ tài khoản riêng trong danh sách truy cập.</p>
 </section>;
}
