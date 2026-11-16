import {useState} from 'react';import {Search,Wallet} from 'lucide-react';
import {useFolios} from '../api/queries';import {DemoNotice,Heading,Panel,Status} from '../components/ui';import {QueryFeedback} from '../components/QueryFeedback';import {currency,statusLabel} from '../lib/format';
export function Billing(){
 const [search,setSearch]=useState('');const q=useFolios({search,perPage:50});
 return <><DemoNotice/><Heading title="Guest folios" description="Illustrative balances only; no live charges, payments, receipts or refunds." action={<button disabled className="btn-primary"><Wallet size={16}/> Add charge (planned)</button>}/>
 <Panel title="Folio overview" action={<span className="table-count">{q.data?.meta.total??'—'} folios</span>}><div className="table-toolbar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search folios" placeholder="Search guest, reference or status"/></label></div>
 <QueryFeedback loading={q.isPending} error={q.error} empty={q.data?.data.length===0}/>
 {q.data&&q.data.data.length>0&&<div className="table-scroll"><table><thead><tr><th>Reservation</th><th>Guest</th><th>Charges</th><th>Payments</th><th>Balance</th><th>Status</th></tr></thead><tbody>{q.data.data.map(f=><tr key={f.id}><td className="table-id">{f.reservationReference}</td><td><strong>{f.guestName}</strong></td><td>{currency(f.totalCharges)}</td><td>{currency(f.totalPayments)}</td><td>{currency(f.balance)}</td><td><Status value={statusLabel(f.status)}/></td></tr>)}</tbody></table></div>}</Panel></>;
}
