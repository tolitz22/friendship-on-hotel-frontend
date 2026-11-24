import {useState} from 'react';
import {SupplierAgingReport} from './SupplierAgingReport';
import {useQueryClient} from '@tanstack/react-query';
import {useHotelAuth} from './AuthProvider';
import {SupplierInvoiceDialog,SupplierPaymentDialog} from './SupplierBillDialogs';
import {Link} from '@tanstack/react-router';
import {Wallet,AlertTriangle,Receipt} from 'lucide-react';
import {useSupplierBills,useSupplierBill} from '../api/supplierBills';
import type {BillFilters} from '../api/supplierBills';
import {Panel,Stat,Status} from './ui';
import {QueryFeedback} from './QueryFeedback';
import {readableDate,statusLabel} from '../lib/format';

const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n/100);
export function SupplierBillRegister({hotel}:{hotel:string}){
 const {user}=useHotelAuth();
 const client=useQueryClient();
 const [agingOpen,setAgingOpen]=useState(false);
 const [invoiceOpen,setInvoiceOpen]=useState(false);
 const [paymentOpen,setPaymentOpen]=useState(false);
 const [message,setMessage]=useState('');
 function refresh(){for(const key of ['supplier-aging','supplier-bills','supplier-bill','cashier-shifts','cashier-shift-detail','current-cashier-shift','cashier-shift-history','expenses','night-audit-reconciliation'])void client.invalidateQueries({queryKey:['live',key,hotel]});}
 const [filters,setFilters]=useState<BillFilters>({page:1,status:'all'});
 const [selected,setSelected]=useState<string|null>(null);
 const query=useSupplierBills(hotel,filters);
 const detail=useSupplierBill(hotel,selected);
 const summary=query.data?.summary;
 const canWrite=!!user?.id&&query.isSuccess&&query.data.postingEnabled;
 const pendingPayment=!!user?.id&&!!selected&&(()=>{try{return !!sessionStorage.getItem('foh.supplier-payment.pending.'+hotel+'.'+user.id+'.'+selected);}catch{return false;}})();
 const filter=(status:BillFilters['status'])=>setFilters(p=>({...p,status,page:1}));
 return <>
  {message&&<p role="status" className="cashier-feedback-success">{message}</p>}
  {invoiceOpen&&canWrite&&user?.id&&summary?.businessDate&&<SupplierInvoiceDialog hotel={hotel} userId={user.id} businessDate={summary.businessDate} onClose={()=>setInvoiceOpen(false)} onSaved={id=>{setInvoiceOpen(false);setSelected(id);setMessage('Supplier invoice recorded.');refresh();}}/>}
  <div className="expense-summary">
   <Stat label="Outstanding payable" value={summary?money(summary.outstandingMinor):'—'} detail={summary?summary.outstandingCount+' outstanding invoices':'Awaiting supplier data'} icon={<Wallet size={20}/>}/>
   <button type="button" className="expense-summary-button" onClick={()=>filter('overdue')}><Stat label="Overdue payable" value={summary?.overdueMinor==null?'—':money(summary.overdueMinor)} detail={summary?.overdueCount==null?'Financial business date required':summary.overdueCount+' overdue invoices'} icon={<AlertTriangle size={20}/>}/></button>
   <button type="button" className="expense-summary-button" onClick={()=>filter('inconsistent')}><Stat label="Balance exceptions" value={summary?String(summary.inconsistentCount):'—'} detail="Invoices requiring investigation" icon={<Receipt size={20}/>}/></button>
  </div>
  {query.data&&!query.data.postingEnabled&&<p className="notice">Supplier billing writes are not enabled for this deployment. Existing invoices remain available for inspection.</p>}
  {summary?.businessDate&&<div className="desk-tools"><button type="button" className="btn-inline" aria-expanded={agingOpen} onClick={()=>setAgingOpen(v=>!v)}>{agingOpen?'Hide aging report':'View accounts payable aging'}</button></div>}
  {agingOpen&&summary?.businessDate&&<SupplierAgingReport hotel={hotel} businessDate={summary.businessDate}/>}
  <Panel title="Supplier bill register" action={canWrite&&summary?.businessDate?<button type="button" className="btn-primary" onClick={()=>{setMessage('');setInvoiceOpen(true);}}>Record supplier bill</button>:undefined}>
   <p className="desk-muted">Outstanding amounts reflect recorded payments. {summary?.businessDate?'Overdue as of '+readableDate(summary.businessDate)+'.':'No financial business date configured.'}</p>
   <div className="expense-filters">
    <label>Search bills<input className="wizard-input" placeholder="Supplier, invoice or description" value={filters.search??''} onChange={e=>setFilters(p=>({...p,search:e.target.value||undefined,page:1}))}/></label>
    <label>Payment status<select className="wizard-input" value={filters.status} onChange={e=>filter(e.target.value as BillFilters['status'])}><option value="all">All bills</option><option value="unpaid">Unpaid</option><option value="partially_paid">Partially paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="inconsistent">Balance exceptions</option></select></label>
   </div>
   <QueryFeedback loading={query.isPending} error={query.error} onRetry={()=>void query.refetch()}/>
   {query.data?.data.length===0&&<p>No supplier bills match these filters.</p>}
   {!!query.data?.data.length&&<div className="table-scroll"><table><thead><tr><th>Supplier / invoice</th><th>Due date</th><th>Invoice amount</th><th>Paid</th><th>Outstanding</th><th>Status</th><th>Action</th></tr></thead><tbody>
    {query.data.data.map(b=><tr key={b.id}><td><strong>{b.supplierName}</strong><small className="expense-payee">{b.invoiceReference} · {b.description}</small></td><td>{readableDate(b.dueDate)}</td><td>{money(b.amountMinor)}</td><td>{money(b.paidMinor)}</td><td><strong>{money(b.outstandingMinor)}</strong></td><td><Status value={statusLabel(b.paymentStatus)}/>{b.overdue&&<small className="expense-payee">Overdue</small>}</td><td><button type="button" className="btn-inline" onClick={()=>{setPaymentOpen(false);setSelected(b.id);}}>View bill</button></td></tr>)}
   </tbody></table></div>}
   {query.data&&<div className="desk-tools"><button type="button" className="btn-inline" disabled={filters.page<=1} onClick={()=>setFilters(p=>({...p,page:p.page-1}))}>Previous</button><span>Page {query.data.meta.page} of {Math.max(1,query.data.meta.totalPages)}</span><button type="button" className="btn-inline" disabled={filters.page>=query.data.meta.totalPages} onClick={()=>setFilters(p=>({...p,page:p.page+1}))}>Next</button></div>}
  </Panel>
  {selected&&<Panel title="Supplier invoice" action={<button type="button" className="btn-inline" onClick={()=>{setPaymentOpen(false);setSelected(null);}}>Close bill</button>}>
   <QueryFeedback loading={detail.isPending} error={detail.error} onRetry={()=>void detail.refetch()}/>
   {detail.data&&<><h3>{detail.data.supplierName} · {detail.data.invoiceReference}</h3><p>{detail.data.description}</p>
    <dl className="expense-detail-grid"><div><dt>Invoice amount</dt><dd>{money(detail.data.amountMinor)}</dd></div><div><dt>Total paid</dt><dd>{money(detail.data.paidMinor)}</dd></div><div><dt>Outstanding</dt><dd>{money(detail.data.outstandingMinor)}</dd></div><div><dt>Invoice date</dt><dd>{readableDate(detail.data.invoiceDate)}</dd></div><div><dt>Due date</dt><dd>{readableDate(detail.data.dueDate)}</dd></div><div><dt>Business date</dt><dd>{readableDate(detail.data.businessDate)}</dd></div><div><dt>Department</dt><dd>{statusLabel(detail.data.department)}</dd></div><div><dt>Journal</dt><dd>#{detail.data.journalId}</dd></div></dl>
    {canWrite&&user?.id&&(detail.data.outstandingMinor>0||pendingPayment)&&<button type="button" className="btn-primary" onClick={()=>{setMessage('');setPaymentOpen(true);}}>{pendingPayment?'Recover supplier payment':'Record supplier payment'}</button>}
    {paymentOpen&&canWrite&&user?.id&&<SupplierPaymentDialog key={detail.data.id} hotel={hotel} userId={user.id} bill={detail.data} onClose={()=>setPaymentOpen(false)} onSaved={()=>{setPaymentOpen(false);setMessage('Supplier payment recorded.');refresh();}}/>}
    <h3>Payment history</h3>
    {!detail.data.payments.length&&<p>No payments recorded.</p>}
    {detail.data.payments.map(p=><article key={p.id} className="readable-audit-event"><strong>{money(p.amountMinor)} · {statusLabel(p.paymentSource)}</strong><p>{readableDate(p.businessDate)} · {p.recordedByName??'Staff name unavailable'}</p><p>Evidence: {p.evidenceReference} · Journal #{p.journalId}</p>{p.shiftId&&<Link to="/cashier-shifts" search={{shift:p.shiftId,hotel}}>View cashier shift</Link>}</article>)}
   </>}
  </Panel>}
 </>;
}
