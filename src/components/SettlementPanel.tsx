import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';
import {AlertTriangle,CheckCircle2,ClipboardCheck,Printer,RefreshCw,ShieldCheck,Wallet} from 'lucide-react';
import {getJson,requestJson} from '../api/http';
import {hotelPath,readSession} from '../api/session';
import {useHotelAuth} from './AuthProvider';
import {QueryFeedback} from './QueryFeedback';
import {BillingActions} from './BillingActions';
import './settlement-print.css';

const id=z.string().regex(/^[1-9]\d*$/);
const charge=z.object({
 id,type:z.string(),description:z.string(),stayDate:z.string().nullable(),
 amountMinor:z.number().int(),
});
const adjustment=z.object({
 id,kind:z.string(),description:z.string(),amountMinor:z.number().int(),
});
const payment=z.object({
 id,method:z.string(),reference:z.string(),amountMinor:z.number().int(),
 status:z.string(),verificationStatus:z.string().nullable(),
 verificationId:id.nullable(),verificationPreparedBy:id.nullable(),
 evidenceKind:z.string().nullable(),evidenceReference:z.string().nullable(),
});
const allocation=z.object({
 id,paymentId:id,folioEntryId:id.nullable(),payerKind:z.string(),
 payerReference:z.string(),amountMinor:z.number().int(),
});
const refund=z.object({
 id,paymentId:id,amountMinor:z.number().int(),reason:z.string(),
 status:z.string(),requestedBy:id,reviewedBy:id.nullable(),
 evidenceId:id.nullable(),evidenceStatus:z.string().nullable(),
 evidenceRecordedBy:id.nullable(),evidenceReviewedBy:id.nullable(),
 externalReference:z.string().nullable(),
});
const tax=z.object({
 folioEntryId:id,stayDate:z.string(),status:z.string(),grossMinor:z.number(),
 vatMinor:z.number(),roomRevenueMinor:z.number(),folioCreditMinor:z.number(),benefitKind:z.string(),
});
const statement=z.object({
 hotelId:id,bookingId:id,folioId:id,reservationReference:z.string(),
 checkIn:z.string(),checkOut:z.string(),status:z.string(),currency:z.string(),
 charges:z.array(charge),adjustments:z.array(adjustment),payments:z.array(payment),
 allocations:z.array(allocation),taxAllocations:z.array(tax),
 refunds:z.array(refund),verifiedRefundsMinor:z.number().int(),
 netRecordedChargesMinor:z.number().int(),
 verifiedPaymentsMinor:z.number().int(),verifiedAllocatedMinor:z.number().int(),
 unallocatedVerifiedDepositsMinor:z.number().int(),remainingMinor:z.number().int(),
 blockers:z.array(z.string()),canSignOff:z.boolean(),signed:z.boolean(),
 signedSnapshotIntegrity:z.boolean(),signedSnapshotSha256:z.string().nullable(),
 signedAt:z.string().nullable(),signedBy:id.nullable(),
 isTaxInvoice:z.literal(false),bankOrGatewayApiVerified:z.literal(false),
 paymentEvidenceIndependentlyReviewed:z.boolean(),settlementWorkflowEnabled:z.boolean(),
});
type Statement=z.infer<typeof statement>;
type Payment=z.infer<typeof payment>;
function money(value:number,currency:string){
 return currency==='PHP'
  ?new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(value/100)
  :value.toLocaleString()+' '+currency+' minor units';
}
function KeyValue({label,value}:{label:string;value:string}){
 return <div className="settlement-metric"><small>{label}</small><strong>{value}</strong></div>;
}

export function SettlementPanel({bookingId}:{bookingId:string}){
 const {hotelId,user}=useHotelAuth();
 const client=useQueryClient();
 const manager=!!hotelId&&!!user?.hotels.some(h=>h.id===hotelId&&h.role==='admin');
 const [selected,setSelected]=useState('');
 const [reference,setReference]=useState('');
 const [reviewNote,setReviewNote]=useState('');
 const [payerKind,setPayerKind]=useState('guest');
 const [payerRef,setPayerRef]=useState('');
 const [amount,setAmount]=useState('');
 const [entryId,setEntryId]=useState('');
 const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
 const [refundPayment,setRefundPayment]=useState('');
 const [refundAmount,setRefundAmount]=useState('');
 const [refundReason,setRefundReason]=useState('');
 const [refundKey,setRefundKey]=useState(()=>crypto.randomUUID());
 const [refundEvidence,setRefundEvidence]=useState('');
 const [refundNote,setRefundNote]=useState('');

 const [ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const valid=!!hotelId&&/^[1-9]\d*$/.test(bookingId);
 const endpoint='/bookings/'+bookingId;
 useEffect(()=>{
  setSelected('');setReference('');setReviewNote('');setPayerKind('guest');
  setPayerRef('');setAmount('');setEntryId('');setAck(false);setBusy(false);
  setError('');setSuccess('');setRequestKey(crypto.randomUUID());
  setRefundPayment('');setRefundAmount('');setRefundReason('');
  setRefundKey(crypto.randomUUID());setRefundEvidence('');setRefundNote('');
 },[hotelId,bookingId]);
 const query=useQuery({
  queryKey:['live','settlement-statement',hotelId,bookingId],
  enabled:valid,
  queryFn:async():Promise<Statement>=>{
   const result=z.object({data:statement}).parse(
    await getJson<unknown>(hotelPath(endpoint+'/settlement-statement'))).data;
   if(result.hotelId!==hotelId||result.bookingId!==bookingId)
    throw new Error('Unexpected reservation or hotel in settlement statement.');
   return result;
  },
  retry:false,
 });
 const data=query.data;
 const paymentRow=data?.payments.find(p=>p.id===selected);
 const accounted=data?.allocations.filter(a=>a.paymentId===selected)
  .reduce((sum,a)=>sum+a.amountMinor,0)??0;
 const available=paymentRow?paymentRow.amountMinor-accounted:0;
 const active=()=>!!hotelId&&readSession().hotelId===hotelId;
 async function mutation(path:string,body:Record<string,unknown>,message:string):Promise<boolean>{
  if(!active()||!manager||!data?.settlementWorkflowEnabled||busy||data.signed)return false;
  setBusy(true);setError('');setSuccess('');
  try{
   await requestJson<unknown>(hotelPath(path),{method:'POST',body});
   if(!active())return false;
   setAck(false);setReviewNote('');setSuccess(message);
   // Financial write already succeeded. Cache refresh failures must not
   // make a committed action appear unsaved or invite duplicate submission.
   void Promise.all([
    client.invalidateQueries({queryKey:['live','settlement-statement',hotelId,bookingId]}),
    client.invalidateQueries({queryKey:['live','folio-ledger',hotelId]}),
    client.invalidateQueries({queryKey:['live','billing-folios',hotelId]}),
    client.invalidateQueries({queryKey:['live','cashier-shifts',hotelId]}),
   ]).catch(()=>{});
   return true;
  }catch(e){if(active())setError(e instanceof Error?e.message:'Settlement action failed.');return false;}
  finally{setBusy(false);}
 }
 function selectPayment(p:Payment){
  setSelected(p.id);setReference(p.evidenceReference??'');setAmount(String(p.amountMinor));
  setPayerRef('');setPayerKind('guest');setEntryId('');setAck(false);
  setError('');setSuccess('');
 }
 if(!valid)return null;
 return <section className="settlement-page">
  <div className="desk-tools settlement-tools">
   <h3>Itemized settlement & checkout statement</h3>
   <button type="button" className="btn-inline" disabled={busy} onClick={()=>void query.refetch()}>
    <RefreshCw size={15}/> Refresh statement
   </button>
  </div>
  <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
  {data&&<>
   <div className="settlement-print-area" aria-label="Printable guest checkout statement">
    <div className="settlement-heading">
     <div><p className="eyebrow">FRIENDSHIP ON HOTEL · RESERVATION ACCOUNT</p>
      <h3>Guest folio statement</h3>
      <p>Booking {data.reservationReference} · Folio #{data.folioId} · {data.currency}</p>
     </div>
     <strong className="settlement-status">{data.signed?'SIGNED ACCOUNT':'PROVISIONAL · NOT SETTLED'}</strong>
    </div>
    <div className="settlement-metrics">
     <KeyValue label="Arrival" value={data.checkIn}/>
     <KeyValue label="Departure" value={data.checkOut}/>
     <KeyValue label="Recorded charges" value={money(data.netRecordedChargesMinor,data.currency)}/>
     <KeyValue label="Verified allocations" value={money(data.verifiedAllocatedMinor,data.currency)}/>
     <KeyValue label="Remaining / credit" value={money(data.remainingMinor,data.currency)}/>
     <KeyValue label="Unallocated deposits" value={money(data.unallocatedVerifiedDepositsMinor,data.currency)}/>
    </div>
    <h4>Accommodation and additional charges</h4>
    <div className="table-scroll"><table className="settlement-table">
     <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
     <tbody>{data.charges.map(c=><tr key={c.id}>
      <td>{c.stayDate??'—'}</td><td>{c.description} <small>#{c.id}</small></td>
      <td>{money(c.amountMinor,data.currency)}</td>
     </tr>)}{data.charges.length===0&&<tr><td colSpan={3}>No posted charges.</td></tr>}</tbody>
    </table></div>
    {data.taxAllocations.length>0&&<>
     <h4>Approved room-night tax allocations (informational)</h4>
     <div className="table-scroll"><table className="settlement-table">
      <thead><tr><th>Night</th><th>VAT portion</th><th>Net room revenue</th><th>Benefit</th></tr></thead>
      <tbody>{data.taxAllocations.map(t=><tr key={t.folioEntryId}>
       <td>{t.stayDate} · {t.status}</td>
       <td>{money(t.vatMinor,data.currency)}</td>
       <td>{money(t.roomRevenueMinor,data.currency)}</td>
       <td>{t.benefitKind} · {money(t.folioCreditMinor,data.currency)}</td>
      </tr>)}</tbody>
     </table></div>
    </>}
    {data.adjustments.length>0&&<>
     <h4>Credits and adjustments</h4>
     <div className="table-scroll"><table className="settlement-table">
      <thead><tr><th>Type</th><th>Reason</th><th>Amount</th></tr></thead>
      <tbody>{data.adjustments.map(a=><tr key={a.id}>
       <td>{a.kind}</td><td>{a.description}</td>
       <td>{a.kind==='credit'?'−':'+'}{money(a.amountMinor,data.currency)}</td>
      </tr>)}</tbody>
     </table></div>
    </>}
    <h4>Recorded payment evidence</h4>
    <div className="table-scroll"><table className="settlement-table">
     <thead><tr><th>Method / reference</th><th>Status</th><th>Amount</th></tr></thead>
     <tbody>{data.payments.map(p=><tr key={p.id}>
      <td>{p.method} · {p.reference}</td>
      <td>{p.status} · {p.verificationStatus??'not reviewed'}</td>
      <td>{money(p.amountMinor,data.currency)}</td>
     </tr>)}{data.payments.length===0&&<tr><td colSpan={3}>No payment evidence recorded.</td></tr>}</tbody>
    </table></div>
    {data.allocations.length>0&&<>
     <h4>Guest / company / group payment attribution</h4>
     <div className="table-scroll"><table className="settlement-table">
      <thead><tr><th>Payer</th><th>Payment / charge</th><th>Allocated</th></tr></thead>
      <tbody>{data.allocations.map(a=><tr key={a.id}>
       <td>{a.payerKind} · {a.payerReference}</td>
       <td>Payment #{a.paymentId}{a.folioEntryId?' · Night #'+a.folioEntryId:''}</td>
       <td>{money(a.amountMinor,data.currency)}</td>
      </tr>)}</tbody>
     </table></div>
    </>}
    {data.refunds.length>0&&<>
     <h4>Refund requests and external disbursement evidence</h4>
     <div className="table-scroll"><table className="settlement-table">
      <thead><tr><th>Payment / reason</th><th>Review status</th><th>Amount</th></tr></thead>
      <tbody>{data.refunds.map(r=><tr key={r.id}>
       <td>Payment #{r.paymentId} · {r.reason}</td>
       <td>{r.status} · {r.evidenceStatus??'no disbursement proof'}</td>
       <td>{money(r.amountMinor,data.currency)}</td>
      </tr>)}</tbody>
     </table></div>
    </>}
    <div className="settlement-signature">
     <p>{data.signed?'Signed settlement: '+data.signedAt+' · Manager #'+data.signedBy:
      'This statement is not yet an approved settlement.'}</p>
     {data.signed&&<p><small>Signed financial snapshot SHA-256: {data.signedSnapshotSha256}</small></p>}
     <small>This is an internal PMS guest-account statement, NOT a BIR tax invoice, bank receipt,
      payment gateway confirmation, or proof that a refund has been disbursed.
      Payment evidence has been reviewed by staff, not confirmed via a live bank/PSP API.</small>
    </div>
   </div>
   <div className="desk-tools settlement-controls">
    <button type="button" className="btn-inline"
     disabled={data.signed&&!data.signedSnapshotIntegrity}
     onClick={()=>window.print()}>
     <Printer size={16}/> Print guest statement
    </button>
    {data.signed&&!data.signedSnapshotIntegrity?<p role="alert" className="stay-feedback-error">
     <AlertTriangle size={16}/> Signed statement integrity failed. Printing and checkout are blocked pending independent investigation.
    </p>:data.signed?<p className="night-audit-clean"><CheckCircle2 size={16}/>
     Signed by manager #{data.signedBy}. Financial snapshot integrity confirmed.</p>
     :<p className="desk-muted">Printable for review. Unsigned statements remain provisional.</p>}
   </div>
   {data.blockers.length>0&&<div className="night-audit-issues" role="status">
    <h4><AlertTriangle size={17}/> Settlement blockers</h4>
    <ul>{data.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul>
   </div>}
   <BillingActions bookingId={bookingId} signed={data.signed}/>
   {manager&&!data.signed&&<>
    {!data.settlementWorkflowEnabled&&<div className="night-audit-warning" role="status">
     <AlertTriangle size={18}/>
     Final settlement is not yet enabled for this hotel. A finance administrator must complete the required checks before activating it. You can still review the recorded statement.
    </div>}
    <h4>Manager payment verification & allocation</h4>
    <p className="desk-muted">Bank transfer evidence requires a different administrator to verify the supporting statement. Cash evidence requires a reconciled shift. These controls never initiate a bank payment or refund.</p>
    <div className="settlement-payment-choice">
     {data.payments.map(p=><button type="button" key={p.id} className={'btn-inline'+(selected===p.id?' active':'')}
      disabled={busy} onClick={()=>selectPayment(p)}>
      <Wallet size={15}/> #{p.id} · {p.method} · {money(p.amountMinor,data.currency)} · {p.verificationStatus??'needs review'}
     </button>)}
    </div>
    {paymentRow&&<div className="settlement-action-panel">
     <h4>Payment #{paymentRow.id}: {paymentRow.method}</h4>
     <p>Verified: {paymentRow.verificationStatus??'not yet'} · Unallocated payment balance: {money(available,data.currency)}</p>
     {paymentRow.status!=='staff_confirmed'
      ?<p role="status">This payment must first be confirmed through the existing manager payment review process.</p>
      :paymentRow.verificationStatus===null?<>
       <label>Verification reference
        <input className="wizard-input" value={reference} maxLength={160}
         onChange={e=>setReference(e.target.value)}
         placeholder={paymentRow.method==='cash'?'shift-123':'Internal bank statement evidence reference'}/>
       </label>
       <button type="button" className="btn-primary"
        disabled={busy||!data.settlementWorkflowEnabled||reference.trim().length<6}
        onClick={()=>void mutation(endpoint+'/payment-records/'+paymentRow.id+'/verification',{
         evidenceKind:paymentRow.method==='cash'?'cash_shift':'bank_statement',
         evidenceReference:reference.trim(),
        },'Verification submitted. Independent manager review is required.')}>
        Submit independent verification request
       </button>
      </>:paymentRow.verificationStatus==='pending'?<>
       <p>Prepared by manager #{paymentRow.verificationPreparedBy}. A different manager must approve it.</p>
       <label>Independent review note
        <textarea className="wizard-input" rows={2} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/>
       </label>
       <div className="desk-tools">
        <button type="button" className="btn-primary" disabled={busy||!data.settlementWorkflowEnabled||
         reviewNote.trim().length<10||paymentRow.verificationPreparedBy===user?.id}
         onClick={()=>void mutation(endpoint+'/settlement-verifications/'+paymentRow.verificationId+'/review',{
          decision:'verify',note:reviewNote.trim(),
         },'Supporting payment evidence independently reviewed.')}>
         <ShieldCheck size={15}/> Verify evidence
        </button>
        <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||reviewNote.trim().length<10}
         onClick={()=>void mutation(endpoint+'/settlement-verifications/'+paymentRow.verificationId+'/review',{
          decision:'reject',note:reviewNote.trim(),
         },'Payment evidence rejected; manager follow-up required.')}>
         Reject evidence
        </button>
       </div>
      </>:paymentRow.verificationStatus==='verified'?<>
       <p className="night-audit-clean"><CheckCircle2 size={15}/> Independently reviewed evidence. Allocate this verified payment to the guest, company, or group.</p>
       <div className="desk-tools">
        <label>Payer
         <select className="wizard-input" value={payerKind} onChange={e=>setPayerKind(e.target.value)}>
          <option value="guest">Guest</option><option value="company">Company</option><option value="group">Group</option>
         </select>
        </label>
        <label>Payer reference
         <input className="wizard-input" value={payerRef} maxLength={120}
          onChange={e=>setPayerRef(e.target.value)} placeholder="Guest/organization reference"/>
        </label>
        <label>Allocation amount (centavos)
         <input className="wizard-input" inputMode="numeric" value={amount}
          onChange={e=>setAmount(e.target.value)}/>
        </label>
        <label>Charge line (optional)
         <select className="wizard-input" value={entryId} onChange={e=>setEntryId(e.target.value)}>
          <option value="">Unspecified / deposit allocation</option>
          {data.charges.map(c=><option value={c.id} key={c.id}>
           #{c.id} · {c.description}
          </option>)}
         </select>
        </label>
       </div>
       <button type="button" className="btn-primary"
        disabled={busy||!data.settlementWorkflowEnabled||available<1||
         !/^\d+$/.test(amount)||Number(amount)<1||Number(amount)>available||payerRef.trim().length<3}
        onClick={()=>void (async()=>{
         const priorKey=requestKey;
         const ok=await mutation(endpoint+'/payment-records/'+paymentRow.id+'/allocations',{
          requestKey:priorKey,payerKind,payerReference:payerRef.trim(),
          amountMinor:Number(amount),folioEntryId:entryId?Number(entryId):null,
         },'Verified payment allocation recorded.');
         if(ok){
          // The same key must not be reused for a different allocation.
          setRequestKey(crypto.randomUUID());
          setAmount('');
         }
        })()}>
        Allocate verified payment
       </button>
      </>:<p role="alert">Rejected verification cannot be allocated. Manager investigation required.</p>}
    </div>}
    <div className="settlement-action-panel">
     <h4>Refunds · reviewed external bank disbursement only</h4>
     <p className="desk-muted">The PMS does NOT send refunds. First request and independently approve a refund of an unallocated bank deposit, then record a bank reference and obtain an independent evidence review.</p>
     <div className="desk-tools">
      <label>Verified bank payment
       <select className="wizard-input" value={refundPayment} onChange={e=>setRefundPayment(e.target.value)}>
        <option value="">Select bank payment</option>
        {data.payments.filter(p=>p.method==='bank_transfer'&&p.verificationStatus==='verified')
         .map(p=><option key={p.id} value={p.id}>#{p.id} · {money(p.amountMinor,data.currency)}</option>)}
       </select>
      </label>
      <label>Refund amount (centavos)
       <input className="wizard-input" inputMode="numeric" value={refundAmount}
        onChange={e=>setRefundAmount(e.target.value)} placeholder="Amount within unallocated deposit"/>
      </label>
     </div>
     <label>Refund justification
      <textarea className="wizard-input" rows={2} value={refundReason} maxLength={500}
       onChange={e=>setRefundReason(e.target.value)}/>
     </label>
     <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||
      !refundPayment||!/^\d+$/.test(refundAmount)||Number(refundAmount)<1||refundReason.trim().length<5}
      onClick={()=>void (async()=>{
       const ok=await mutation(endpoint+'/refund-requests',{
        requestKey:refundKey,paymentRecordId:Number(refundPayment),
        amountMinor:Number(refundAmount),reason:refundReason.trim(),
       },'Refund requested. A different administrator must approve before any external payout.');
       if(ok){setRefundKey(crypto.randomUUID());setRefundAmount('');setRefundReason('');}
      })()}>
      Request documented refund
     </button>
     {data.refunds.map(r=><div className="ex-record" key={r.id}>
      <strong>Refund #{r.id} · {money(r.amountMinor,data.currency)} · {r.status}</strong>
      <p className="desk-muted">{r.reason} · Requested by #{r.requestedBy}
       {r.reviewedBy?' · Approved/reviewed by #'+r.reviewedBy:''}</p>
      {r.status==='requested'&&<>
       <label>Independent refund review note
        <textarea className="wizard-input" rows={2} value={refundNote}
         onChange={e=>setRefundNote(e.target.value)}/>
       </label>
       <div className="desk-tools">
        <button type="button" className="btn-inline" disabled={busy||r.requestedBy===user?.id||
         !data.settlementWorkflowEnabled||refundNote.trim().length<5}
         onClick={()=>void mutation(endpoint+'/refund-requests/'+r.id+'/review',{
          decision:'approve',note:refundNote.trim(),
         },'Refund request approved. External funds have NOT been sent.')}>Approve request</button>
        <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||refundNote.trim().length<5}
         onClick={()=>void mutation(endpoint+'/refund-requests/'+r.id+'/review',{
          decision:'reject',note:refundNote.trim(),
         },'Refund request rejected.')}>Reject request</button>
       </div>
      </>}
      {r.status==='approved'&&!r.evidenceId&&<>
       <label>External bank refund reference
        <input className="wizard-input" value={refundEvidence} maxLength={160}
         onChange={e=>setRefundEvidence(e.target.value)} placeholder="Externally issued refund identifier"/>
       </label>
       <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||refundEvidence.trim().length<8}
        onClick={()=>void mutation(endpoint+'/refund-requests/'+r.id+'/disbursement-evidence',{
         externalReference:refundEvidence.trim(),
        },'External refund evidence recorded. A second administrator must independently verify it.')}>
        Record external disbursement evidence
       </button>
      </>}
      {r.evidenceStatus==='pending'&&r.evidenceId&&<>
       <p>Recorded by #{r.evidenceRecordedBy}. A different administrator must confirm the bank evidence.</p>
       <label>Independent evidence review note
        <textarea className="wizard-input" rows={2} value={refundNote}
         onChange={e=>setRefundNote(e.target.value)}/>
       </label>
       <div className="desk-tools">
        <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||
         r.evidenceRecordedBy===user?.id||refundNote.trim().length<10}
         onClick={()=>void mutation(endpoint+'/refund-disbursements/'+r.evidenceId+'/review',{
          decision:'verify',note:refundNote.trim(),
         },'External refund evidence independently reviewed.')}>
         Verify disbursement evidence
        </button>
        <button type="button" className="btn-inline" disabled={busy||!data.settlementWorkflowEnabled||refundNote.trim().length<10}
         onClick={()=>void mutation(endpoint+'/refund-disbursements/'+r.evidenceId+'/review',{
          decision:'reject',note:refundNote.trim(),
         },'Refund evidence rejected pending investigation.')}>Reject evidence</button>
       </div>
      </>}
      {r.evidenceStatus==='verified'&&<p className="night-audit-clean"><CheckCircle2 size={16}/>
       External refund evidence reviewed · {r.externalReference}. No funds were sent by the PMS.</p>}
     </div>)}
    </div>
    <div className="settlement-signoff">
     <h4>Final settlement authorization</h4>
     <p>Signing freezes the statement and prevents ordinary corrections, new collections, and refund reviews. The booking must be checked in and at or after its departure date.</p>
     <label className="night-review-ack"><input type="checkbox" checked={ack} disabled={busy}
      onChange={e=>setAck(e.target.checked)}/>
      <span>I independently reviewed the folio, tax treatment, verified payment evidence, deposit allocations, outstanding refunds, and the remaining balance.</span>
     </label>
     <button type="button" className="btn-primary"
      disabled={!ack||!data.canSignOff||!data.settlementWorkflowEnabled||busy}
      onClick={()=>void mutation(endpoint+'/settlement-signoff',{acknowledged:true},
       'Guest folio signed. Checkout may proceed if all stay controls pass.')}>
      <ClipboardCheck size={16}/> Sign final settlement statement
     </button>
    </div>
   </>}
   {success&&<p className="stay-feedback-success" role="status">{success}</p>}
   {error&&<p className="stay-feedback-error" role="alert"><AlertTriangle size={16}/>{error}</p>}
  </>}
 </section>;
}
