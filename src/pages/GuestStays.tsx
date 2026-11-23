import {Link,useParams} from '@tanstack/react-router';
import {ArrowLeft} from 'lucide-react';
import {dataMode} from '../api';
import {useSelectedGuest} from '../api/liveSelectedGuest';
import {GuestStayHistory} from '../components/GuestStayHistory';
import {QueryFeedback} from '../components/QueryFeedback';
import {Heading} from '../components/ui';

export function GuestStays(){
 const {guestId}=useParams({from:'/guests/$guestId/stays'});
 const valid=dataMode==='api'&&/^[1-9]\d*$/.test(guestId);
 const guest=useSelectedGuest(valid?guestId:null);
 const name=guest.data?guest.data.firstName+' '+guest.data.lastName:'Customer stays';

 return <>
  <Heading title={name} description="Reservations at the selected hotel." action={<Link className="btn-inline" to="/guests">
   <ArrowLeft size={16}/> Guest directory
  </Link>}/>
  {valid?<QueryFeedback loading={guest.isPending} error={guest.error} onRetry={()=>void guest.refetch()}/>
   :<p role="status">Open a guest from the live guest directory to view their stays.</p>}
  {guest.isSuccess&&<GuestStayHistory key={guest.data.hotelId+':'+guestId} guestId={guestId} name={name}/>}
 </>;
}
