import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,Banknote,CheckCircle2,ClipboardCheck,RefreshCw} from 'lucide-react';
import {useHotelAuth} from '../components/AuthProvider';
import {Heading,Panel} from '../components/ui';
import {QueryFeedback} from '../components/QueryFeedback';
import {readSession} from '../api/session';
import {getCashShiftHistory,openCashierShift,receiveCash,reconcileCashShift,submitCashCount,useCashierShifts,useCashierShiftDetails} from '../api/cashierShifts';
import type {CashierShift} from '../api/cashierShifts';

const validMoney=(s:string)=>/^\d+(\.\d{1,2})?$/.test(s)&&Number.isSafeInteger(Math.round(Number(s)*100))&&Number(s)<=1_000_000_000;
const minor=(s:string)=>Math.round(Number(s)*100);
const money=(n:number,currency:string)=>currency==='PHP'
 ?new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100)
 :n.toLocaleString()+' '+currency+' minor units';

function ShiftRow({shift,manager,onChange}:{shift:CashierShift;manager:boolean;onChange:()=>void}){
 const {hotelId}=useHotelAuth();
 const [count,setCount]=useState('');
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false);
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
    await submitCashCount(hotelId,shift.id,minor(count),note);
   }else{
    if(note.trim().length<5)throw new Error('Provide a manager review note of at least five characters.');
    await reconcileCashShift(hotelId,shift.id,action,note.trim());
   }
   if(readSession().hotelId===hotelId){setResult('Shift updated.');onChange();}
  }catch(e){setError(e instanceof Error?e.message:'Outcome unclear; refresh before retrying.');}
  finally{setBusy(false);}
 }
 return <article className="ex-record" aria-label={'Cash shift '+shift.id}>
  <div className="desk-tools"><strong>Shift #{shift.id} · {shift.status.replaceAll('_',' ')}</strong>
   <span>Cashier #{shift.cashierId}</span></div>
  <p>Opened {shift.openedAt} · Opening float: {money(shift.openingFloatMinor,shift.currency)}
   {' · '}{shift.receiptCount} recorded cash receipt(s)</p>
  {shift.status==='open'&&<p className="desk-muted">Expected cash is hidden until count submission. Count physical notes and coins independently.</p>}
  {shift.expectedCashMinor!==null&&<div className="desk-tools">
   <strong>Expected {money(shift.expectedCashMinor,shift.currency)}</strong>
   <strong>Counted {money(shift.countedCashMinor!,shift.currency)}</strong>
   <strong>Variance {money(shift.varianceMinor!,shift.currency)}</strong></div>}
  {shift.unconfirmedReceiptCount>0&&<p className="desk-attention"><AlertTriangle size={15}/>
   {shift.unconfirmedReceiptCount} payment(s) not staff-confirmed. Manager must investigate before reconciling.</p>}
  {!manager&&shift.status==='open'&&<div className="wizard-fields">
   <label>Counted cash (major currency units)
    <input className="wizard-input" type="text" inputMode="decimal" value={count}
     onChange={e=>setCount(e.target.value)} placeholder="0.00"/></label>
   <label>Closing note<input className="wizard-input" value={note} maxLength={1000}
    onChange={e=>setNote(e.target.value)} placeholder="Drawer handover notes"/></label>
   <button className="btn-primary" type="button" disabled={busy||!validMoney(count)}
    onClick={()=>void run('close')}>Submit counted cash</button>
  </div>}
  {manager&&shift.status==='submitted'&&<div>
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
  {shift.managerNote&&<p><strong>Manager note:</strong> {shift.managerNote}</p>}
  <button type="button" className="btn-inline" onClick={()=>setHistoryOpen(v=>!v)}
   aria-expanded={historyOpen}>{historyOpen?'Hide':'Show'} audit events</button>
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
 const [booking,setBooking]=useState('');
 const [reference,setReference]=useState('');
 const [amount,setAmount]=useState('');
 const [openBusy,setOpenBusy]=useState(false);
 const [paymentBusy,setPaymentBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const key=useRef<string|null>(null);
 const shifts=useCashierShifts(allowed,page,status==='all'?undefined:status as CashierShift['status']);
 const openShifts=useCashierShifts(allowed,1,'open');
 const active=openShifts.data?.data.find(s=>s.status==='open' && String(s.cashierId)===String(user?.id));
 const refresh=()=>hotelId&&client.invalidateQueries({queryKey:['live','cashier-shifts',hotelId]});
 async function start(){
  if(!hotelId||openBusy||!validMoney(float))return;
  setOpenBusy(true);setError('');setMessage('');
  try{await openCashierShift(hotelId,minor(float));setMessage('Shift opened.');void refresh();}
  catch(e){setError(e instanceof Error?e.message:'Unable to open shift.');}
  finally{setOpenBusy(false);}
 }
 async function collect(){
  if(!hotelId||!active||paymentBusy||!validMoney(amount)||minor(amount)<1
   ||!(/^[1-9]\d*$/.test(booking))||reference.trim().length<3)return;
  setPaymentBusy(true);setError('');setMessage('');
  if(!key.current)key.current=crypto.randomUUID();
  try{
   const result=await receiveCash(hotelId,active.id,booking,{
    requestKey:key.current,reference:reference.trim(),amountMinor:minor(amount),
   });
   if(readSession().hotelId!==hotelId)return;
   key.current=null;setBooking('');setReference('');setAmount('');
   setMessage('Cash recorded against folio payment #'+result.paymentId+'. Manager payment review remains required.');
   void refresh();
  }catch(e){setError(e instanceof Error?e.message:'Payment outcome uncertain; retry the same key.');}
  finally{setPaymentBusy(false);}
 }
 if(!allowed)return <><Heading title="Cashier shifts" description="Only active receptionists and hotel managers can view cashier records."/>
  <Panel title="Restricted"><p>Laravel enforces cashier permissions for this property.</p></Panel></>;
 return <>
  <Heading title={manager?'Cash reconciliation':'Cashier shift'} description={manager
   ?'Independently reconcile submitted drawers and investigate discrepancies.'
   :'Record every cash receipt to a priced reservation and count your drawer before closing.'}/>
  {!manager&&<Panel title="My cash drawer">
   {!active&&<div className="wizard-fields">
    <label>Opening float (e.g. 500.00)
     <input className="wizard-input" value={float} inputMode="decimal" onChange={e=>setFloat(e.target.value)}/></label>
    <button type="button" className="btn-primary" disabled={openBusy||!validMoney(float)}
     onClick={()=>void start()}><Banknote size={16}/> Open cashier shift</button>
   </div>}
   {active&&<div>
    <p><ClipboardCheck size={17}/> Current open shift #{active.id}. Payment evidence remains pending independent review.</p>
    <div className="wizard-fields">
     <label>Priced reservation ID
      <input className="wizard-input" value={booking} disabled={paymentBusy} onChange={e=>{setBooking(e.target.value);key.current=null;}} inputMode="numeric"/></label>
     <label>Unique cash receipt reference
      <input className="wizard-input" value={reference} disabled={paymentBusy} onChange={e=>{setReference(e.target.value);key.current=null;}} maxLength={120}/></label>
     <label>Cash collected (major currency units)
      <input className="wizard-input" value={amount} disabled={paymentBusy} onChange={e=>{setAmount(e.target.value);key.current=null;}} inputMode="decimal"/></label>
     <button type="button" className="btn-primary" disabled={paymentBusy||!validMoney(amount)||minor(amount)<1||!(/^[1-9]\d*$/.test(booking))||reference.trim().length<3}
      onClick={()=>void collect()}>{paymentBusy?'Saving…':'Record cash receipt'}</button>
    </div>
   </div>}
   {message&&<p role="status">{message}</p>}
   {error&&<p className="auth-error" role="alert">{error} Check the current shift before retrying.</p>}
  </Panel>}
  <Panel title={manager?'All hotel cashier shifts':'My shift history'}>
   <div className="desk-tools">
    <label>Filter by status <select className="wizard-input" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>
     <option value="all">All</option><option value="open">Open</option>
     <option value="submitted">Awaiting manager review</option><option value="reconciled">Reconciled</option>
     <option value="flagged">Flagged</option>
    </select></label>
    <button className="btn-inline" onClick={()=>void shifts.refetch()}><RefreshCw size={15}/> Refresh</button>
   </div>
   <QueryFeedback loading={shifts.isPending} error={shifts.error} empty={shifts.isSuccess&&shifts.data.data.length===0}/>
   {shifts.data?.data.map(shift=><ShiftRow key={hotelId+'-'+shift.id} shift={shift}
    manager={manager} onChange={()=>void refresh()}/>)}
   {shifts.data&&<div className="desk-tools"><span>Page {shifts.data.meta.page} / {Math.max(1,shifts.data.meta.totalPages)}</span>
    <div className="desk-date-nav">
     <button className="btn-inline" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button>
     <button className="btn-inline" disabled={page>=shifts.data.meta.totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
    </div></div>}
  </Panel>
  <p className="desk-preview-note"><AlertTriangle size={17}/> Cash reconciliation tracks registered collections only. It cannot detect a guest who stays or pays entirely outside the PMS. Rejected payment evidence does not automatically prove cash was returned.</p>
 </>;
}
