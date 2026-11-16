import {useState} from 'react';import {Search,Users} from 'lucide-react';
import {useGuests} from '../api/queries';import {DemoNotice,Heading,Panel} from '../components/ui';import {QueryFeedback} from '../components/QueryFeedback';import {dateLabel} from '../lib/format';
export function Guests(){
 const [search,setSearch]=useState('');const q=useGuests({search,perPage:50});
 return <><DemoNotice/><Heading title="Guest directory" description="Guest profiles and contact details will be retrieved from Laravel once available." action={<button disabled className="btn-primary"><Users size={16}/> Add guest (planned)</button>}/>
 <Panel title="Guest profiles" action={<span className="table-count">{q.data?.meta.total??'—'} profiles</span>}><div className="table-toolbar"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search guests" placeholder="Search guest name or email"/></label></div>
 <QueryFeedback loading={q.isPending} error={q.error} empty={q.data?.data.length===0}/>
 {q.data&&q.data.data.length>0&&<div className="table-scroll"><table><thead><tr><th>Guest</th><th>Email</th><th>Phone</th><th>Nationality</th><th>Created</th></tr></thead><tbody>{q.data.data.map(g=><tr key={g.id}><td><strong>{g.firstName} {g.lastName}</strong></td><td>{g.email??'—'}</td><td>{g.phone??'—'}</td><td>{g.nationality??'—'}</td><td>{dateLabel(g.createdAt.slice(0,10))}</td></tr>)}</tbody></table></div>}</Panel></>;
}
