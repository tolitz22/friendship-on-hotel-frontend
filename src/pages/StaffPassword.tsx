import {useState,type FormEvent} from 'react';
import {Link} from '@tanstack/react-router';
import {changeStaffPassword,requestPasswordReset,resetStaffPassword} from '../api/auth';
import {useHotelAuth} from '../components/AuthProvider';
import {ApiError} from '../api/http';
import {Heading,Panel} from '../components/ui';

function AuthMessage({error,success}:{error:string;success:string}){
 return <>{error&&<div className="auth-error" role="alert">{error}</div>}
  {success&&<p className="guest-info" role="status">{success}</p>}</>;
}

export function ForgotPassword(){
 const [email,setEmail]=useState('');
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending)return;
  setPending(true);setError('');setSuccess('');
  try{
   const response=await requestPasswordReset(email.trim());
   setSuccess(response.message);
  }catch(caught){
   setError(caught instanceof Error?caught.message:'Could not submit the reset request.');
  }finally{setPending(false);}
 }
 return <div className="auth-shell"><div className="auth-card">
  <div className="auth-brand">FO</div><h1>Reset your staff password</h1>
  <p>Enter your account email address. If an active account exists, we will email a reset link.</p>
  <form onSubmit={e=>void submit(e)}>
   <label>Email address<input required type="email" autoComplete="email" maxLength={255}
    value={email} onChange={e=>setEmail(e.target.value)} disabled={pending}/></label>
   <AuthMessage error={error} success={success}/>
   <button type="submit" disabled={pending} className="btn-primary">{pending?'Sending…':'Send reset instructions'}</button>
  </form>
  <p className="auth-footnote"><Link to="/">Return to sign in</Link></p>
 </div></div>;
}

export function ResetPassword(){
 const query=new URLSearchParams(window.location.search);
 const token=query.get('token')??'';
 const initialEmail=query.get('email')??'';
 const [email,setEmail]=useState(initialEmail);
 const [password,setPassword]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending)return;
  if(password!==confirmation){setError('Your passwords do not match.');return;}
  setPending(true);setError('');setSuccess('');
  try{
   const result=await resetStaffPassword(email.trim(),token,password,confirmation);
   setPassword('');setConfirmation('');
   setSuccess(result.message);
  }catch(caught){setError(caught instanceof Error?caught.message:'Could not reset your password.');}
  finally{setPending(false);}
 }
 return <div className="auth-shell"><div className="auth-card">
  <div className="auth-brand">FO</div><h1>Choose a new password</h1>
  <p>Use at least 12 characters, with uppercase and lowercase letters and a number.</p>
  {!token?<><p className="auth-error" role="alert">Reset token missing. Request a new reset email.</p>
   <p><Link to="/forgot-password">Request reset email</Link></p></>:<form onSubmit={e=>void submit(e)}>
    <label>Account email<input type="email" maxLength={255} autoComplete="email" required
     value={email} onChange={e=>setEmail(e.target.value)} disabled={pending}/></label>
    <label>New password<input type="password" minLength={12} autoComplete="new-password" required
     value={password} onChange={e=>setPassword(e.target.value)} disabled={pending}/></label>
    <label>Confirm password<input type="password" minLength={12} autoComplete="new-password" required
     value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={pending}/></label>
    <AuthMessage error={error} success={success}/>
    {!success&&<button type="submit" className="btn-primary" disabled={pending}>{pending?'Resetting…':'Reset password'}</button>}
   </form>}
  <p className="auth-footnote"><Link to="/">Return to sign in</Link></p>
 </div></div>;
}

export function ChangePassword(){
 const {signOut}=useHotelAuth();
 const [current,setCurrent]=useState('');
 const [password,setPassword]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending)return;
  if(password!==confirmation){setError('Your passwords do not match.');return;}
  setPending(true);setError('');
  try{
   await changeStaffPassword(current,password,confirmation);
   setCurrent('');setPassword('');setConfirmation('');
   // The backend revoked every token. Clear the client session immediately.
   await signOut();
  }catch(caught){
   setError(caught instanceof ApiError?caught.message:caught instanceof Error?caught.message:'Could not change password.');
  }finally{setPending(false);}
 }
 return <>
  <Heading title="Change password" description="Update your account password and revoke existing API sessions"/>
  <Panel title="Account security">
   <p className="guest-info">You will be signed out on all devices after a successful password change.</p>
   <form className="password-change-form" onSubmit={e=>void submit(e)}>
    <label>Current password<input type="password" autoComplete="current-password" required
     value={current} onChange={e=>setCurrent(e.target.value)} disabled={pending}/></label>
    <label>New password<input type="password" autoComplete="new-password" minLength={12} required
     value={password} onChange={e=>setPassword(e.target.value)} disabled={pending}/></label>
    <label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} required
     value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={pending}/></label>
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <button type="submit" className="btn-primary" disabled={pending}>{pending?'Updating…':'Change password and sign out'}</button>
   </form>
  </Panel>
 </>;
}
