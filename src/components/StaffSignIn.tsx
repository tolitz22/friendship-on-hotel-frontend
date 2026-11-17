import {useState,type FormEvent} from 'react';
import {Link} from '@tanstack/react-router';
import {LockKeyhole,LogIn} from 'lucide-react';
import {useHotelAuth} from './AuthProvider';

export function StaffSignIn(){
 const {signIn,pending}=useHotelAuth();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');
  try{await signIn(email.trim(),password);}catch(e){setError(e instanceof Error?e.message:'Sign-in failed.');}
 }
 return <div className="auth-shell"><div className="auth-card">
  <div className="auth-brand">FO</div>
  <h1>Friendship On Hotel</h1>
  <p>Staff sign-in · Laravel API development environment</p>
  <form onSubmit={submit}>
   <label>Email address<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} disabled={pending}/></label>
   <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={pending}/></label>
   {error&&<div role="alert" className="auth-error">{error}</div>}
   <button type="submit" className="btn-primary" disabled={pending}><LogIn size={16}/>{pending?'Signing in…':'Sign in'}</button>
  </form>
  <p className="auth-footnote"><Link to="/forgot-password">Forgot your password?</Link></p>
  <p className="auth-footnote"><LockKeyhole size={14}/> Access token kept only in memory. Refreshing the page signs you out. Use HTTPS outside localhost.</p>
  <p className="auth-footnote">Reservations, payments, and operational workflows are not live.</p>
 </div></div>;
}
