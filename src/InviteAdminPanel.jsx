import React,{useMemo,useState} from 'react';
import {inviteExpired,inviteLink,INVITE_TTL_DAYS} from './invites.js';

function timeOf(value){
 if(!value)return '—';
 const millis=value.toMillis?.()??(typeof value.seconds==='number'?value.seconds*1000:NaN);
 return Number.isFinite(millis)?new Date(millis).toLocaleString('vi-VN'):'—';
}
function CopyLink({url}){
 const [copied,setCopied]=useState(false);
 return <button type="button" className="btn outline compact" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true)}catch{window.prompt('Sao chép link này:',url)}}}>{copied?'Đã sao chép':'Sao chép link'}</button>;
}
export default function InviteAdminPanel({invites,onCreate,onRevoke}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[newUrl,setNewUrl]=useState('');
 const active=useMemo(()=>invites.filter(i=>!i.claimedBy&&!inviteExpired(i.expiresAt)).sort((a,b)=>((b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))),[invites]);
 const create=async()=>{setBusy(true);setError('');try{const token=await onCreate();setNewUrl(inviteLink(token,window.location.origin,import.meta.env.BASE_URL));}catch(e){setError(e.message||'Không tạo được link mời.')}finally{setBusy(false)}};
 const revoke=async token=>{if(!window.confirm('Thu hồi link mời này? Người chưa dùng link sẽ không thể tham gia.'))return;setBusy(true);setError('');try{await onRevoke(token);setNewUrl('')}catch(e){setError(e.message||'Không thu hồi được link.')}finally{setBusy(false)}};
 return <section className="settings-card card gap-above invite-card">
  <h3>Link mời thành viên</h3>
  <p>Admin tạo link dùng <b>một lần</b>, có hạn <b>{INVITE_TTL_DAYS} ngày</b>. Người được mời mở link, đăng nhập Google và tự nhận quyền <b>Member</b>. Không cần gửi UID thủ công.</p>
  <button type="button" className="btn primary" disabled={busy} onClick={create}>Tạo link mời Member</button>
  {newUrl&&<div className="invite-link-box"><label htmlFor="invite-created-link">Link mời vừa tạo</label><input id="invite-created-link" aria-label="Link mời" readOnly value={newUrl} onFocus={e=>e.target.select()}/><CopyLink url={newUrl}/><small>Chỉ gửi cho đúng người được mời. Ai mở link trước và đăng nhập thành công sẽ nhận quyền.</small></div>}
  {error&&<p className="auth-error" role="alert">{error}</p>}
  <h4>Link chưa sử dụng ({active.length})</h4>
  {active.length===0?<p className="muted-inline">Chưa có link mời đang hoạt động.</p>:<div className="invite-list">{active.map(i=>{
    const url=inviteLink(i.id,window.location.origin,import.meta.env.BASE_URL);
    return <div className="invite-list-item" key={i.id}><div><strong>Member · Link dùng một lần</strong><small>Hết hạn: {timeOf(i.expiresAt)}</small></div><div className="invite-list-actions"><CopyLink url={url}/><button type="button" className="btn outline compact" disabled={busy} onClick={()=>revoke(i.id)}>Thu hồi</button></div></div>
  })}</div>}
  <p className="settings-warning">Không chia sẻ link mời trong nhóm công khai. Sau khi người được mời sử dụng, link tự vô hiệu. Admin vẫn có thể thu hồi quyền trong danh sách truy cập.</p>
 </section>;
}
