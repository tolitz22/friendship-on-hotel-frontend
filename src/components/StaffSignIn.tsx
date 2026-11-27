import {useState,type FormEvent} from 'react';
import {Link} from '@tanstack/react-router';
import {LockKeyhole,LogIn} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';
import {isCookieAuth} from '../api/http';

export function StaffSignIn(){
 const {signIn,pending}=useHotelAuth();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');
  try{await signIn(email.trim(),password);}catch{setError('Unable to sign in. Check your email and password, then try again.');}
 }
 return <div className="auth-shell"><div className="auth-card">
  <div className="auth-brand">FO</div>
  <h1>Friendship On Hotel</h1>
  <p>{isCookieAuth()?'Secure staff sign-in':'Staff sign-in'}</p>
  <form onSubmit={submit}>
   <label>Email address<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} disabled={pending}/></label>
   <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={pending}/></label>
   {error&&<div role="alert" className="auth-error">{error}</div>}
   <button type="submit" className="btn-primary" disabled={pending}><LogIn size={16}/>{pending?'Signing in…':'Sign in'}</button>
  </form>
  <p className="auth-footnote"><Link to="/forgot-password">Forgot your password?</Link></p>
  <p className="auth-footnote"><LockKeyhole size={14}/>{isCookieAuth()?'Your secure session can stay active across refreshes and browser restarts until it expires. Always sign out on shared devices.' :import.meta.env.VITE_AUTH_PERSISTENCE!=='memory'?'This tab remembers your login across refreshes. Closing the tab ends local access; always sign out on shared devices.':'For your security, refreshing this page signs you out.'}</p>
  <p className="auth-footnote">Your access and records are limited to the hotel you select. Some billing and management tasks are handled in separate sections.</p>
 </div></div>;
}
