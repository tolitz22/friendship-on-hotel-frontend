import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,ArrowRight,Banknote,CheckCircle2,Clock3,History,Info,RefreshCw,Wallet,X} from 'lucide-react';
import {Link,useSearch} from '@tanstack/react-router';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {readSession} from '../api/session';
import {getCashShiftHistory,openCashierShift,reconcileCashShift,submitCashCount,useCashierShifts,useCashierShiftDetails,useCurrentCashierShift} from '../api/cashierShifts';
import type {CashierShift} from '../api/cashierShifts';
import {readableDateTime} from '../lib/format';
import {listHotelStaff} from '../api/liveStaff';
import {ReadableCashAuditEvent,auditActorName} from '../components/ReadableAuditEvent';

const validMoney=(s:string)=>/^\d+(\.\d{1,2})?$/.test(s)&&Number.isSafeInteger(Math.round(Number(s)*100))&&Number(s)<=1_000_000_000;
const minor=(s:string)=>Math.round(Number(s)*100);
const money=(n:number,currency:string)=>currency==='PHP'
 ?new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100)
 :n.toLocaleString()+' '+currency+' minor units';

function ShiftRow({shift,manager,ownShift,onChange}:{shift:CashierShift;manager:boolean;ownShift:boolean;onChange:()=>void}){
 const {hotelId,user}=useHotelAuth();
 const staff=useQuery({queryKey:['hotel-staff',hotelId],queryFn:listHotelStaff,enabled:manager&&!!hotelId});
 const cashierName=auditActorName(shift.cashierId,staff.data?.data.find(member=>member.userId===shift.cashierId)?.name,user?.id,user?.name);
 const [count,setCount]=useState('');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false);
 const [closingOpen,setClosingOpen]=useState(false);
 const [countConfirmed,setCountConfirmed]=useState(false);
 const detail=useCashierShiftDetails(manager&&shift.status==='submitted',shift.id);
 const log=useQuery({
  queryKey:['live','cashier-shift-history',hotelId,shift.id],
  enabled:historyOpen&&!!hotelId,
  queryFn:()=>getCashShiftHistory(hotelId!,shift.id),retry:false,
 });
 async function run(action:'close'|'reconcile'|'flag'){
  if(!hotelId||busy)return;
  setBusy(true);setError('');setResult('');
  try{
   if(action==='close'){
    if(!validMoney(count))throw new Error('Enter a cash count with up to two decimal places.');
    if(!ownShift||shift.status!=='open'||!countConfirmed)throw new Error('Count and confirm the cash before submitting your shift.');
    await submitCashCount(hotelId,shift.id,minor(count),note);
   }else{
    if(note.trim().length<5)throw new Error('Provide a manager review note of at least five characters.');
    await reconcileCashShift(hotelId,shift.id,action,note.trim());
   }
   if(readSession().hotelId===hotelId){setResult(action==='close'?'Cash count submitted. Another manager will review your shift.':'Manager review recorded.');setClosingOpen(false);setCountConfirmed(false);onChange();}
  }catch(e){setError(e instanceof Error?e.message:'Outcome unclear; refresh before retrying.');}
  finally{setBusy(false);}
 }
 return <article className="cash-shift-card" aria-label={'Cash shift '+shift.id}>
  <div className="cash-shift-card-header">
   <div><span className="rr-eyebrow">SHIFT #{shift.id}</span>
    <h3>{ownShift?'Your cash drawer':'Cash drawer · '+cashierName}</h3>
    <p>Opened {readableDateTime(shift.openedAt)}</p></div>
   <span className={'cash-shift-pill cash-shift-'+shift.status}>{shift.status==='open'?'Open':shift.status==='submitted'?'Awaiting review':shift.status==='reconciled'?'Reconciled':'Flagged for review'}</span>
  </div>
  <div className="cash-shift-metrics">
   <div><small>Opening cash</small><strong>{money(shift.openingFloatMinor,shift.currency)}</strong></div>
   <div><small>Cash receipts recorded</small><strong>{shift.receiptCount}</strong></div>
   <div><small>Needs payment review</small><strong>{shift.unconfirmedReceiptCount}</strong></div>
  </div>
  {shift.status==='open'&&<p className="cash-shift-explainer"><Info size={15}/>
   The expected drawer total stays hidden until you submit your physical cash count.
   Cash receipts increase the drawer by the net payment only (cash tendered minus change given).</p>}
  {shift.expectedCashMinor!==null&&<div className="cash-shift-metrics cash-shift-reconciliation">
   <div><small>Expected cash</small><strong>{money(shift.expectedCashMinor,shift.currency)}</strong></div>
   <div><small>Counted cash</small><strong>{money(shift.countedCashMinor??0,shift.currency)}</strong></div>
   <div><small>Difference</small><strong>{money(shift.varianceMinor??0,shift.currency)}</strong></div></div>}
  {shift.unconfirmedReceiptCount>0&&<p className="cash-shift-alert"><AlertTriangle size={16}/>
   {shift.unconfirmedReceiptCount} receipt{shift.unconfirmedReceiptCount===1?'':'s'} still need independent payment review.</p>}
  {ownShift&&shift.status==='open'&&<>
   <button type="button" className="cash-shift-close-toggle cash-shift-end-action"
    aria-expanded={closingOpen} onClick={()=>{setClosingOpen(true);setCountConfirmed(false);}}>
    <span><strong>End cashier shift</strong>
     <small>Count cash and submit for manager review when your shift is finished</small></span>
    <ArrowRight size={17}/>
   </button>
   {closingOpen&&<div className="billing-modal-backdrop">
    <section role="dialog" aria-modal="true" aria-label="End cashier shift"
     className="billing-action-modal cashier-close-dialog">
     <div className="billing-action-modal-header">
      <div><span className="rr-eyebrow">SHIFT #{shift.id}</span>
       <h3>End shift and count cash</h3>
       <p>Enter the physical amount in your drawer. Expected cash remains hidden until submission.</p>
      </div>
      <button type="button" className="billing-modal-dismiss" aria-label="Cancel ending shift"
       disabled={busy} onClick={()=>{setClosingOpen(false);setCountConfirmed(false);}}><X size={20}/></button>
     </div>
     <div className="cash-shift-close-form">
      <label>Actual cash counted (₱)
       <input className="wizard-input" type="text" inputMode="decimal" autoFocus
        value={count} disabled={busy}
        onChange={e=>{setCount(e.target.value);setCountConfirmed(false);}} placeholder="0.00"/></label>
      <label>Handover note (optional)
       <input className="wizard-input" value={note} maxLength={1000} disabled={busy}
        onChange={e=>setNote(e.target.value)} placeholder="Any handover details"/></label>
      <label className="cash-shift-confirm"><input type="checkbox" checked={countConfirmed}
       disabled={busy} onChange={e=>setCountConfirmed(e.target.checked)}/>
       I counted the physical cash and understand this shift will stop accepting payments.</label>
      <div className="cash-shift-close-buttons">
       <button type="button" className="btn-primary" disabled={busy||!validMoney(count)||!countConfirmed}
        onClick={()=>void run('close')}>{busy?'Submitting…':'Submit count and end shift'}</button>
       <button type="button" className="btn-inline" disabled={busy}
        onClick={()=>{setClosingOpen(false);setCountConfirmed(false);}}>Cancel</button>
      </div>
      {error&&<p role="alert" className="auth-error">{error} Check the shift before retrying.</p>}
     </div>
    </section>
   </div>}
  </>}
  {manager&&!ownShift&&shift.status==='submitted'&&<div>
   <h4>Recorded receipts for independent verification</h4>
   <QueryFeedback loading={detail.isPending} error={detail.error} onRetry={()=>void detail.refetch()}/>
   {detail.data&&<div className="table-scroll"><table><thead><tr><th>Payment</th><th>Reservation</th><th>Reference</th><th>Net payment</th><th>Cash handed over</th><th>Change given</th><th>Review status</th></tr></thead><tbody>
    {(detail.data.receipts??[]).map(receipt=><tr key={receipt.id}><td>{receipt.paymentId}</td><td><Link to="/billing"
     search={{booking:receipt.bookingId}}>Review guest bill <ArrowRight size={13}/></Link></td>
     <td>{receipt.reference}</td><td>{money(receipt.amountMinor,shift.currency)}</td>
     <td>{receipt.cashTenderedMinor===null?'Not captured (older receipt)':
      money(receipt.cashTenderedMinor,shift.currency)}</td>
     <td>{receipt.changeGivenMinor===null?'Not captured (older receipt)':
      money(receipt.changeGivenMinor,shift.currency)}</td>
     <td>{receipt.paymentStatus}</td></tr>)}
   </tbody></table></div>}
   {detail.data?.receipts?.length===0&&<p>No cash receipts recorded; verify opening float separately.</p>}
   <label className="wizard-label">Independent manager review note
    <textarea className="wizard-input" rows={2} value={note} maxLength={1000}
     onChange={e=>setNote(e.target.value)} placeholder="Explain physical count and evidence checked"/></label>
   <div className="desk-tools">
    <button type="button" className="btn-primary" disabled={busy||!detail.isSuccess||note.trim().length<5||shift.varianceMinor!==0||shift.unconfirmedReceiptCount>0}
     onClick={()=>void run('reconcile')}><CheckCircle2 size={16}/> Reconcile balanced shift</button>
    <button type="button" className="btn-inline" disabled={busy||!detail.isSuccess||note.trim().length<5}
     onClick={()=>void run('flag')}><AlertTriangle size={16}/> Flag discrepancy</button>
   </div>
  </div>}
  {ownShift&&shift.status==='submitted'&&<p className="cash-shift-alert"><Clock3 size={15}/> This shift is awaiting review by another manager. A new shift cannot start until this is resolved.</p>}
  {shift.managerNote&&<p><strong>Manager review:</strong> {shift.managerNote}</p>}
  <button type="button" className="cash-shift-history-toggle" onClick={()=>setHistoryOpen(v=>!v)}
   aria-expanded={historyOpen}><History size={15}/>{historyOpen?'Hide':'View'} shift activity</button>
  {historyOpen&&<div><QueryFeedback loading={log.isPending} error={log.error}/>
   {log.data?.data.map(event=><ReadableCashAuditEvent key={event.id} event={event}
    actorName={event.actorName??staff.data?.data.find(member=>member.userId===event.actorId)?.name}
    currentUserId={user?.id} currentUserName={user?.name}/>)}</div>}
  {error&&<p role="alert" className="auth-error">{error}. Refresh the shift before retrying.</p>}
  {result&&<p role="status">{result}</p>}
 </article>;
}

export function CashierShifts(){
 const {hotelId,user}=useHotelAuth();
 const context=useSearch({from:'/cashier-shifts'});
 const originBooking=context.hotel&&context.hotel!==hotelId?undefined:context.booking;
 const role=user?.hotels.find(h=>h.id===hotelId)?.role;
 const manager=role==='admin';
 const allowed=manager||role==='front_desk';
 const client=useQueryClient();
 const [page,setPage]=useState(1);
 const [status,setStatus]=useState('all');
 const [float,setFloat]=useState('0.00');

 const [openBusy,setOpenBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
  setPage(1);setStatus('all');setFloat('0.00');setMessage('');setError('');
 },[hotelId]);
 const shifts=useCashierShifts(allowed,page,status==='all'?undefined:status as CashierShift['status']);
 const ownOpenShift=useCurrentCashierShift(allowed);
 const ownPendingShifts=useCashierShifts(allowed&&!manager,1,'submitted');
 const managerReviewQueue=useCashierShifts(manager,1,'submitted');
 const linkedShift=useCashierShiftDetails(allowed&&!!context.shift,context.shift??'');
 const active=ownOpenShift.data??null;
 const refresh=()=>hotelId&&Promise.all([
  client.invalidateQueries({queryKey:['live','cashier-shifts',hotelId]}),
  client.invalidateQueries({queryKey:['live','current-cashier-shift',hotelId]}),
  client.invalidateQueries({queryKey:['live','cashier-shift-detail',hotelId]}),
 ]);
 async function start(){
  if(!hotelId||openBusy||ownOpenShift.isFetching||!ownOpenShift.isSuccess||active||!validMoney(float))return;
  setOpenBusy(true);setError('');setMessage('');
  try{await openCashierShift(hotelId,minor(float));setMessage('Your cashier shift is now open. You can record guest cash payments.');void refresh();}
  catch(e){setError(e instanceof Error?e.message:'Unable to open shift.');}
  finally{setOpenBusy(false);}
 }
 if(context.hotel&&context.hotel!==hotelId)return <Panel title="Select the original property">
  <p role="alert">This drawer link belongs to another hotel. Select the original property before continuing.</p>
 </Panel>;
 if(!allowed)return <><Heading title="Cashier shifts" description="Only active receptionists and hotel managers can view cashier records."/>
  <Panel title="Restricted"><p>Only staff with cashier permissions for this hotel can access this page.</p></Panel></>;
 return <>
  <div className="cashier-page-heading"><span className="rr-eyebrow">CASH OPERATIONS</span>
   <Heading title="Cashier shifts" description="Track your cash drawer, collect guest payments, and finish your shift securely."/></div>
  {originBooking&&<div className="checkout-return-context">
   <div><strong>Linked to a guest account</strong>
    <p>Review the cashier shift without recording the guest payment a second time. Return to Guest Billing when the shift task is finished.</p></div>
   <Link className="btn-primary" to="/billing" search={{booking:originBooking}}>
    Return to guest bill <ArrowRight size={16}/></Link>
  </div>}
  {context.shift&&<section className="cashier-linked-task" aria-label="Payment-linked cashier shift">
   <div className="cashier-linked-title">
    <div><span className="rr-eyebrow">FROM GUEST BILLING</span>
     <h2>Cash shift #{context.shift}</h2>
     <p>This is the cash drawer linked to the guest's recorded payment. Review this shift; do not record the payment again.</p>
    </div>
   </div>
   <QueryFeedback loading={linkedShift.isPending} error={linkedShift.error}
    onRetry={()=>void linkedShift.refetch()}/>
   {linkedShift.data&&linkedShift.data.id!==active?.id&&
    <ShiftRow shift={linkedShift.data} manager={manager}
     ownShift={linkedShift.data.cashierId===user?.id} onChange={()=>void refresh()}/>}
   {linkedShift.data&&linkedShift.data.id===active?.id&&
    <p className="cashier-linked-own">This is your open cash shift. Use <strong>Count cash and submit shift</strong> below when your shift is finished.</p>}
   {linkedShift.data&&linkedShift.data.status==='open'&&linkedShift.data.cashierId!==user?.id&&
    <p className="cashier-linked-wait">Waiting for the assigned cashier to count and submit this shift. No manager can reconcile an open shift yet.</p>}
  </section>}
  {!context.shift&&<section className="cashier-journey" aria-label="Cashier shift process">
   <div><span>1</span><strong>Open shift</strong><small>{active?'Your drawer is open':'Start your own cash drawer'}</small></div>
   <div><span>2</span><strong>Record receipts</strong><small>{active
    ?active.receiptCount+' linked cash receipt'+(active.receiptCount===1?'':'s')
    :'Collect cash through Guest Billing'}</small></div>
   <div><span>3</span><strong>Count & submit</strong><small>Hide expected cash until you submit your physical count</small></div>
   <div><span>4</span><strong>Independent review</strong><small>A different manager reconciles or flags the shift</small></div>
  </section>}
  {(!context.shift||linkedShift.data?.id===active?.id)&&<section className="cashier-drawer-panel" aria-label="My cash drawer"><div className="cashier-panel-heading">
   <div><h2>My cash drawer</h2><p>One shift per cashier. Opening cash is the money already in your drawer for giving change.</p></div>
   <button type="button" className="rr-secondary-action" disabled={ownOpenShift.isFetching} onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button></div>
   <QueryFeedback loading={ownOpenShift.isPending} error={ownOpenShift.error} onRetry={()=>void ownOpenShift.refetch()}/>
   {ownOpenShift.isSuccess&&!active&&<div className="wizard-fields">
    {!manager&&ownPendingShifts.isSuccess&&ownPendingShifts.data.data.length>0&&
     <p className="desk-attention"><AlertTriangle size={15}/> Your previous cash shift is awaiting manager reconciliation. You cannot open another one yet.</p>}
    <label>Opening cash in drawer (₱)
     <input className="wizard-input" value={float} inputMode="decimal" disabled={openBusy}
      onChange={e=>setFloat(e.target.value)} placeholder="0.00"/></label>
    <p className="desk-muted">Enter the cash already in your drawer for giving change. Enter 0.00 if it's empty.</p>
    <button type="button" className="btn-primary" disabled={openBusy||!validMoney(float)||
     (!manager&&ownPendingShifts.isSuccess&&ownPendingShifts.data.data.length>0)}
     onClick={()=>void start()}><Banknote size={16}/> {openBusy?'Opening…':'Open my cashier shift'}</button>
    {manager&&<p className="desk-muted">If your previous shift is awaiting review, another manager must reconcile it before you can open a new one.</p>}
   </div>}
   {active&&<div className="cashier-active-workflow">
    {!(originBooking&&context.shift===active.id)&&<div className="cashier-collect-next">
     <div className="cashier-collect-heading"><span className="cashier-collect-icon"><Wallet size={21}/></span>
      <div><strong>Ready to accept guest cash payments</strong>
       <p>Your shift is open. Payments entered from a guest's bill are automatically linked to this drawer.</p></div></div>
     <Link to="/billing" search={{booking:originBooking}} className="btn-primary cashier-billing-link">
      {originBooking?'Continue guest payment':'Find a guest and record payment'} <ArrowRight size={16}/></Link>
    </div>}
    <ShiftRow shift={active} manager={manager} ownShift onChange={()=>void refresh()}/>
   </div>}
   {message&&<p role="status" className="cashier-feedback-success">{message}</p>}
   {error&&<p className="auth-error" role="alert">{error} Check your shift before trying again.</p>}
  </section>}
  {manager&&!context.shift&&<section className="cashier-manager-queue" aria-label="Independent cash reconciliation queue">
   <div className="cashier-panel-heading">
    <div><span className="rr-eyebrow">MANAGER · INDEPENDENT REVIEW</span>
     <h2>Shifts awaiting reconciliation</h2>
     <p>Review each receipt in Guest Billing, then check the physical count.
      The cashier cannot approve their own shift.</p></div>
    <button type="button" className="rr-secondary-action" disabled={managerReviewQueue.isFetching}
     onClick={()=>void managerReviewQueue.refetch()}><RefreshCw size={15}/> Refresh queue</button>
   </div>
   <QueryFeedback loading={managerReviewQueue.isPending} error={managerReviewQueue.error}
    onRetry={()=>void managerReviewQueue.refetch()}/>
   {managerReviewQueue.data?.data.filter(shift=>shift.cashierId!==user?.id
    &&shift.id!==linkedShift.data?.id).length===0&&!linkedShift.data&&
    <p className="cashier-queue-empty"><CheckCircle2 size={16}/>
     No eligible submitted shifts to review. Your own submitted shift requires another manager.</p>}
   {managerReviewQueue.data?.data.filter(shift=>shift.cashierId!==user?.id
    &&shift.id!==linkedShift.data?.id).map(shift=>
    <ShiftRow key={'manager-'+shift.id} shift={shift} manager ownShift={false}
     onChange={()=>void refresh()}/>)}
   {managerReviewQueue.data&&managerReviewQueue.data.meta.totalPages>1&&
    <p className="desk-muted">Showing the first {managerReviewQueue.data.data.length} submitted shifts.
     Open shift history for additional pages.</p>}
  </section>}
  <details className="cashier-history-disclosure">
   <summary><span><History size={18}/><strong>{manager?'Review other shifts and history':'Previous cashier shifts'}</strong></span>
    <small>Open shift history</small></summary>
   <Panel title={manager?'Shift review & history':'Previous shifts'}>
   <div className="desk-tools">
    <label>Filter by status <select className="wizard-input" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
     <option value="all">All</option><option value="open">Open</option>
     <option value="submitted">Awaiting manager review</option><option value="reconciled">Reconciled</option>
     <option value="flagged">Flagged</option>
    </select></label>
    <button className="btn-inline" onClick={()=>void shifts.refetch()}><RefreshCw size={15}/> Refresh</button>
   </div>
   <QueryFeedback loading={shifts.isPending} error={shifts.error} empty={shifts.isSuccess&&shifts.data.data.length===0}/>
   {shifts.data?.data.filter(shift=>shift.id!==active?.id).map(shift=><ShiftRow key={hotelId+'-'+shift.id} shift={shift}
    manager={manager} ownShift={String(shift.cashierId)===String(user?.id)} onChange={()=>void refresh()}/>)}
   {shifts.data&&<div className="desk-tools"><span>Page {shifts.data.meta.page} / {Math.max(1,shifts.data.meta.totalPages)}</span>
    <div className="desk-date-nav">
     <button className="btn-inline" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button>
     <button className="btn-inline" disabled={page>=shifts.data.meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
    </div></div>}
   </Panel>
  </details>
  <p className="desk-preview-note"><AlertTriangle size={17}/> Only registered cash payments are included in reconciliation. Always record every stay and guest payment in the hotel system.</p>
 </>;
}
