import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,ArrowRight,Banknote,CheckCircle2,ClipboardCheck,Clock3,History,Info,RefreshCw,Wallet} from 'lucide-react';
import {Link} from '@tanstack/react-router';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {readSession} from '../api/session';
import {getCashShiftHistory,openCashierShift,reconcileCashShift,submitCashCount,useCashierShifts,useCashierShiftDetails,useCurrentCashierShift} from '../api/cashierShifts';
import type {CashierShift} from '../api/cashierShifts';

const validMoney=(s:string)=>/^\d+(\.\d{1,2})?$/.test(s)&&Number.isSafeInteger(Math.round(Number(s)*100))&&Number(s)<=1_000_000_000;
const minor=(s:string)=>Math.round(Number(s)*100);
const money=(n:number,currency:string)=>currency==='PHP'
 ?new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100)
 :n.toLocaleString()+' '+currency+' minor units';

function ShiftRow({shift,manager,ownShift,onChange}:{shift:CashierShift;manager:boolean;ownShift:boolean;onChange:()=>void}){
 const {hotelId}=useHotelAuth();
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
    <h3>{ownShift?'Your cash drawer':'Cash drawer · Staff #'+shift.cashierId}</h3>
    <p>Opened {shift.openedAt}</p></div>
   <span className={'cash-shift-pill cash-shift-'+shift.status}>{shift.status==='open'?'Open':shift.status==='submitted'?'Awaiting review':shift.status==='reconciled'?'Reconciled':'Flagged for review'}</span>
  </div>
  <div className="cash-shift-metrics">
   <div><small>Opening cash</small><strong>{money(shift.openingFloatMinor,shift.currency)}</strong></div>
   <div><small>Cash receipts recorded</small><strong>{shift.receiptCount}</strong></div>
   <div><small>Needs payment review</small><strong>{shift.unconfirmedReceiptCount}</strong></div>
  </div>
  {shift.status==='open'&&<p className="cash-shift-explainer"><Info size={15}/>
   The expected drawer total stays hidden until you submit your physical cash count.</p>}
  {shift.expectedCashMinor!==null&&<div className="cash-shift-metrics cash-shift-reconciliation">
   <div><small>Expected cash</small><strong>{money(shift.expectedCashMinor,shift.currency)}</strong></div>
   <div><small>Counted cash</small><strong>{money(shift.countedCashMinor??0,shift.currency)}</strong></div>
   <div><small>Difference</small><strong>{money(shift.varianceMinor??0,shift.currency)}</strong></div></div>}
  {shift.unconfirmedReceiptCount>0&&<p className="cash-shift-alert"><AlertTriangle size={16}/>
   {shift.unconfirmedReceiptCount} receipt{shift.unconfirmedReceiptCount===1?'':'s'} still need independent payment review.</p>}
  {ownShift&&shift.status==='open'&&<section className="cash-shift-close">
   <button type="button" className="cash-shift-close-toggle" aria-expanded={closingOpen}
    onClick={()=>setClosingOpen(v=>!v)}>
    <span><strong>Finish shift and count cash</strong><small>Only at the end of your shift · This stops new cash payments</small></span>
    <ArrowRight size={17} aria-hidden="true"/></button>
   {closingOpen&&<div className="cash-shift-close-form">
    <p>Count the physical notes and coins in your drawer. Do not use a calculated expected total as your count.</p>
    <label>Actual cash counted (₱)
     <input className="wizard-input" type="text" inputMode="decimal" value={count}
      onChange={e=>{setCount(e.target.value);setCountConfirmed(false);}} placeholder="0.00"/></label>
    <label>Handover note (optional)
     <input className="wizard-input" value={note} maxLength={1000}
      onChange={e=>setNote(e.target.value)} placeholder="Any handover details"/></label>
    <label className="cash-shift-confirm"><input type="checkbox" checked={countConfirmed}
     onChange={e=>setCountConfirmed(e.target.checked)}/>
     I counted the actual cash in the drawer and understand that this shift will be submitted for manager review.</label>
    <div className="cash-shift-close-buttons">
     <button type="button" className="btn-primary" disabled={busy||!validMoney(count)||!countConfirmed}
      onClick={()=>void run('close')}>{busy?'Submitting…':'Submit cash count and end shift'}</button>
     <button type="button" className="btn-inline" onClick={()=>setClosingOpen(false)}>Cancel</button>
    </div>
   </div>}
  </section>}
  {manager&&!ownShift&&shift.status==='submitted'&&<div>
   <h4>Recorded receipts for independent verification</h4>
   <QueryFeedback loading={detail.isPending} error={detail.error} onRetry={()=>void detail.refetch()}/>
   {detail.data&&<div className="table-scroll"><table><thead><tr><th>Payment</th><th>Reservation</th><th>Reference</th><th>Amount</th><th>Review status</th></tr></thead><tbody>
    {(detail.data.receipts??[]).map(receipt=><tr key={receipt.id}><td>{receipt.paymentId}</td><td>{receipt.bookingId}</td><td>{receipt.reference}</td><td>{money(receipt.amountMinor,shift.currency)}</td><td>{receipt.paymentStatus}</td></tr>)}
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
   {log.data?.data.map(row=><p key={row.id} className="desk-muted">
    {row.event.replaceAll('_',' ')} · User #{row.actorId} · {row.createdAt}
   </p>)}</div>}
  {error&&<p role="alert" className="auth-error">{error}. Refresh the shift before retrying.</p>}
  {result&&<p role="status">{result}</p>}
 </article>;
}

export function CashierShifts(){
 const {hotelId,user}=useHotelAuth();
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
 const active=ownOpenShift.data??null;
 const refresh=()=>hotelId&&Promise.all([
  client.invalidateQueries({queryKey:['live','cashier-shifts',hotelId]}),
  client.invalidateQueries({queryKey:['live','current-cashier-shift',hotelId]}),
 ]);
 async function start(){
  if(!hotelId||openBusy||ownOpenShift.isFetching||!ownOpenShift.isSuccess||active||!validMoney(float))return;
  setOpenBusy(true);setError('');setMessage('');
  try{await openCashierShift(hotelId,minor(float));setMessage('Your cashier shift is now open. You can record guest cash payments.');void refresh();}
  catch(e){setError(e instanceof Error?e.message:'Unable to open shift.');}
  finally{setOpenBusy(false);}
 }
 if(!allowed)return <><Heading title="Cashier shifts" description="Only active receptionists and hotel managers can view cashier records."/>
  <Panel title="Restricted"><p>Only staff with cashier permissions for this hotel can access this page.</p></Panel></>;
 return <>
  <div className="cashier-page-heading"><span className="rr-eyebrow">CASH OPERATIONS</span>
   <Heading title="Cashier shifts" description="Track your cash drawer, collect guest payments, and finish your shift securely."/></div>
  <section className="cashier-drawer-panel" aria-label="My cash drawer"><div className="cashier-panel-heading">
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
    <div className="cashier-collect-next">
     <div className="cashier-collect-heading"><span className="cashier-collect-icon"><Wallet size={21}/></span>
      <div><strong>Ready to accept guest cash payments</strong>
       <p>Your shift is open. Payments entered from a guest's bill are automatically linked to this drawer.</p></div></div>
     <Link to="/billing" search={{}} className="btn-primary cashier-billing-link">
      Find a guest and record payment <ArrowRight size={16}/></Link>
    </div>
    <ShiftRow shift={active} manager={manager} ownShift onChange={()=>void refresh()}/>
   </div>}
   {message&&<p role="status" className="cashier-feedback-success">{message}</p>}
   {error&&<p className="auth-error" role="alert">{error} Check your shift before trying again.</p>}
  </section>
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
  <p className="desk-preview-note"><AlertTriangle size={17}/> Only registered cash payments are included in reconciliation. Always record every stay and guest payment in the hotel system.</p>
 </>;
}
