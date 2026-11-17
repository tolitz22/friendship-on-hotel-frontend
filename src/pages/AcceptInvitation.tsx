import {useEffect,useState,type FormEvent} from 'react';
import {Link} from '@tanstack/react-router';
import {acceptStaffInvitation} from '../api/auth';

export function AcceptInvitation(){
 const [token]=useState(()=>{
  const p=new URLSearchParams(window.location.search);
  return p.get('token')??'';
 });
 const [password,setPassword]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 useEffect(()=>{
  // Remove one-use credentials from browser history and the address bar.
  if(token)window.history.replaceState(window.history.state,'',window.location.pathname);
 },[token]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending)return;
  if(password!==confirmation){setError('Passwords do not match.');return;}
  setError('');setPending(true);
  try{
   const response=await acceptStaffInvitation(token,password,confirmation);
   setPassword('');setConfirmation('');
   setSuccess(response.message);
  }catch(e){setError(e instanceof Error?e.message:'The invitation could not be accepted.');}
  finally{setPending(false);}
 }
 return <div className="auth-shell"><div className="auth-card">
  <div className="auth-brand">FO</div><h1>Accept your staff invitation</h1>
  <p>Set your own password to create your hotel staff account. Your email address is verified using this one-time invitation link.</p>
  {!token?<p className="auth-error" role="alert">Invitation link missing. Ask the hotel administrator for a new email.</p>:
   success?<p className="guest-info" role="status">{success}</p>:
   <form onSubmit={e=>void submit(e)}>
    <label>New password<input type="password" autoComplete="new-password" required minLength={12}
      value={password} disabled={pending} onChange={e=>setPassword(e.target.value)}/></label>
    <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={12}
      value={confirmation} disabled={pending} onChange={e=>setConfirmation(e.target.value)}/></label>
    <p className="guest-info">At least 12 characters, uppercase and lowercase letters, and a number.</p>
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <button type="submit" className="btn-primary" disabled={pending}>{pending?'Creating account…':'Accept invitation'}</button>
   </form>}
  <p className="auth-footnote"><Link to="/">Return to staff sign-in</Link></p>
 </div></div>;
}
