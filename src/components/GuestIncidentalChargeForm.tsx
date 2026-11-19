import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {parseBillingAmount,formatBillingMoney} from '../api/billing';
import {useHotelAuth} from './AuthProvider';

const categories=['Extra service','Food and drinks','Minibar','Laundry','Extra person','Other incidental'] as const;
type Category=typeof categories[number];

export function GuestIncidentalChargeForm({bookingId,currency,currentChargesMinor,recordedPaymentMinor,
 onSaved}:{bookingId:string;currency:string;currentChargesMinor:number;recordedPaymentMinor:number;
 onSaved:()=>void}){
 const {hotelId}=useHotelAuth();
 const client=useQueryClient();
 const [category,setCategory]=useState<Category>('Extra service');
 const [description,setDescription]=useState('');
 const [amount,setAmount]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const key=useRef(crypto.randomUUID());
 const parsed=currency==='PHP'?parseBillingAmount(amount):null;
 const valid=parsed!==null&&parsed>0&&parsed<=100000000
  &&description.trim().length>=3&&confirmed&&!busy&&!!hotelId;
 async function submit(){
  if(!valid||!hotelId||parsed===null)return;
  setBusy(true);setError('');
  try{
   await requestJson<unknown>(hotelPath('/bookings/'+bookingId+'/incidental-charges'),{
    method:'POST',body:{requestKey:key.current,category,
     description:description.trim(),amountMinor:parsed},
   });
   if(readSession().hotelId!==hotelId)return;
   key.current=crypto.randomUUID();
   await Promise.all([
    client.invalidateQueries({queryKey:['live','settlement-statement',hotelId,bookingId]}),
    client.invalidateQueries({queryKey:['live','folio-ledger',hotelId,bookingId]}),
    client.invalidateQueries({queryKey:['live','billing-folios',hotelId]}),
   ]);
   onSaved();
  }catch(e){if(readSession().hotelId===hotelId)
   setError((e instanceof Error?e.message:'Could not save this charge.')+
    ' If the request may have succeeded, refresh the bill before retrying.');}
  finally{setBusy(false);}
 }
 return <div className="billing-action-form" aria-label="Additional charge form">
  <p className="desk-muted">Add a normal service or incidental used during this stay. This increases the bill but does not take a payment. Discounts, damage claims and corrections need separate manager review.</p>
  <label>Type of charge
   <select className="wizard-input" value={category} disabled={busy}
    onChange={e=>{setCategory(e.target.value as Category);setConfirmed(false);}}>
    {categories.map(c=><option value={c} key={c}>{c}</option>)}
   </select>
  </label>
  <label>What did the guest purchase?
   <textarea className="wizard-input" rows={2} value={description}
    maxLength={250} disabled={busy} placeholder="e.g. 2 bottled waters"
    onChange={e=>{setDescription(e.target.value);setConfirmed(false);}}/>
  </label>
  <label>Charge amount (₱)
   <input className="wizard-input" inputMode="decimal" value={amount}
    placeholder="0.00" disabled={busy}
    onChange={e=>{setAmount(e.target.value);setConfirmed(false);}}/>
  </label>
  <div className="billing-adjust-preview" aria-live="polite">
   <strong>Updated guest bill</strong>
   <div><span>Current charges</span>
    <b>{formatBillingMoney(currentChargesMinor,currency)}</b></div>
   <div><span>Additional charge</span>
    <b>{parsed===null?'—':'+ '+formatBillingMoney(parsed,currency)}</b></div>
   <div className="billing-adjust-new-total"><span>New bill total</span>
    <b>{formatBillingMoney(currentChargesMinor+(parsed??0),currency)}</b></div>
   <div><span>Payment already recorded</span>
    <b>{formatBillingMoney(recordedPaymentMinor,currency)}</b></div>
   <div><span>Remaining to collect (based on recorded payments)</span>
    <b>{formatBillingMoney(Math.max(0,currentChargesMinor+(parsed??0)-recordedPaymentMinor),currency)}</b></div>
  </div>
  <label className="billing-confirm">
   <input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>
   I checked the service, description and amount before charging this guest.
  </label>
  {error&&<p role="alert" className="auth-error">{error}</p>}
  <button type="button" className="btn-primary" disabled={!valid}
   onClick={()=>void submit()}>{busy?'Adding charge…':'Add charge to guest bill'}</button>
 </div>;
}
